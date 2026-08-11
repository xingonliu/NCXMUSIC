<script setup lang="ts">
import { Heart, Send, Trash2 } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import type {
  MusicCommentResourceType,
  MusicReadResult,
  StandardMusicComment
} from '../../../../shared/schemas/music'
import {
  CommonAlertDialog,
  CommonButton,
  CommonEmptyState,
  CommonErrorState,
  CommonIconButton,
  CommonSpinner,
  CommonTextarea
} from '../../../design-system/components'
import { showToast } from '../../../design-system/use-toast'
import { useAccountSessionStore } from '../../account/account-session-store'
import { mutateMusic } from '../music-actions'
import Cover from './Cover.vue'

// ========= 类型 =========

/** 评论 Section 的四态模型。 */
type CommentsSectionState = 'loading' | 'empty' | 'error' | 'ready'

/** 评论区域的容器形态。 */
type CommentsSectionMode = 'surface' | 'drawer'

// ========= 属性 =========

/** 评论 Section 输入属性。 */
const props = withDefaults(defineProps<{
  /** 评论所属标准资源类型。 */
  resourceType: MusicCommentResourceType
  /** 评论所属标准资源 ID。 */
  resourceId: string
  /** 评论区域所在的容器形态。 */
  mode?: CommentsSectionMode
}>(), {
  mode: 'surface'
})

// ========= 变量 =========

/** 当前账户公开状态，用于评论写入门禁。 */
const account = useAccountSessionStore()

/** 评论 Section 当前状态。 */
const state = ref<CommentsSectionState>('loading')

/** 普通评论列表。 */
const comments = ref<StandardMusicComment[]>([])

/** 热门评论列表。 */
const hotComments = ref<StandardMusicComment[]>([])

/** 上游标准化后的评论总数。 */
const total = ref<number>(0)

/** 是否仍有下一页评论。 */
const hasMore = ref<boolean>(false)

/** 评论读取错误文案。 */
const errorMessage = ref<string>('')

/** 评论输入内容。 */
const draft = ref<string>('')

/** 是否正在提交评论。 */
const submitting = ref<boolean>(false)

/** 正在执行点赞写入的评论 ID。 */
const likingCommentId = ref<string | null>(null)

/** 等待确认删除的本人评论。 */
const deleteTarget = ref<StandardMusicComment | null>(null)

/** 是否正在删除评论。 */
const deleting = ref<boolean>(false)

/** 是否正在读取下一页。 */
const loadingMore = ref<boolean>(false)

/** 当前有效的评论读取 requestId。 */
let activeRequestId = ''

/** 每次读取的标准分页大小。 */
const PAGE_SIZE = 20

/** 评论输入最大长度，与跨进程契约保持一致。 */
const MAX_COMMENT_LENGTH = 1_000

/** 当前账户是否允许执行评论写入。 */
const canMutate = computed<boolean>(() => account.snapshot.value?.canMutateMusic === true)

/** 当前输入是否满足发表评论契约。 */
const canSubmit = computed<boolean>(() => {
  /** 去除首尾空白后的实时评论正文。 */
  const content = draft.value.trim()
  return canMutate.value && content.length > 0 && content.length <= MAX_COMMENT_LENGTH && !submitting.value
})

/** Section 标题中的评论数量文本。 */
const countText = computed<string>(() => total.value > 0 ? `${total.value} 条` : '评论')

// ========= 函数 =========

/** 按评论 ID 合并分页结果并保持原有顺序。 */
function mergeComments(
  current: StandardMusicComment[],
  incoming: StandardMusicComment[]
): StandardMusicComment[] {
  /** 当前合并结果中已经出现的评论 ID。 */
  const seen = new Set<string>()
  return [...current, ...incoming].filter((comment) => {
    if (seen.has(comment.id)) return false
    seen.add(comment.id)
    return true
  })
}

/** 校验评论集合响应是否属于当前资源。 */
function normalizeCommentsResult(
  result: MusicReadResult
): Extract<MusicReadResult, { kind: 'commentCollection' }> | null {
  if (
    result.kind !== 'commentCollection' ||
    result.resourceType !== props.resourceType ||
    result.resourceId !== props.resourceId
  ) {
    return null
  }
  return result
}

/** 读取评论首页或追加下一页，并丢弃资源切换后的迟到响应。 */
async function loadComments(reset = true): Promise<void> {
  /** 本次评论读取的唯一请求 ID。 */
  const requestId = crypto.randomUUID()
  activeRequestId = requestId
  if (reset) {
    state.value = 'loading'
    errorMessage.value = ''
    comments.value = []
    hotComments.value = []
  } else {
    loadingMore.value = true
  }

  /** Utility 返回的标准评论读取响应。 */
  const response = await window.ncx.runtime.readMusic({
    operation: 'getComments',
    resourceType: props.resourceType,
    resourceId: props.resourceId,
    limit: PAGE_SIZE,
    offset: reset ? 0 : comments.value.length,
    requestId
  })

  if (requestId !== activeRequestId) return
  loadingMore.value = false
  if (!response.ok) {
    if (reset) {
      errorMessage.value = response.error.message
      state.value = 'error'
    } else {
      showToast(response.error.message, 'warning')
    }
    return
  }

  /** 校验资源归属后的标准评论集合。 */
  const result = normalizeCommentsResult(response.data)
  if (!result) {
    errorMessage.value = '评论响应类型不匹配。'
    state.value = 'error'
    return
  }

  comments.value = reset ? result.comments : mergeComments(comments.value, result.comments)
  if (reset) hotComments.value = result.hotComments
  total.value = result.total
  hasMore.value = result.more
  state.value = comments.value.length + hotComments.value.length === 0 ? 'empty' : 'ready'
}

/** 把指定评论的局部状态同步到普通与热门两个列表。 */
function updateComment(
  commentId: string,
  update: (comment: StandardMusicComment) => StandardMusicComment
): void {
  comments.value = comments.value.map((comment) => comment.id === commentId ? update(comment) : comment)
  hotComments.value = hotComments.value.map((comment) => comment.id === commentId ? update(comment) : comment)
}

/** 发表评论并在成功后重新读取标准评论首页。 */
async function submitComment(): Promise<void> {
  /** 去除首尾空白后的评论正文。 */
  const content = draft.value.trim()
  if (!canSubmit.value || !content) return
  submitting.value = true
  /** 标准发表评论回执。 */
  const response = await mutateMusic({
    operation: 'addComment',
    resourceType: props.resourceType,
    resourceId: props.resourceId,
    content
  })
  submitting.value = false
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  draft.value = ''
  showToast('评论已发布。', 'success')
  await loadComments(true)
}

/** 点赞或取消点赞指定评论，并仅在标准写入成功后更新本地状态。 */
async function toggleCommentLike(comment: StandardMusicComment): Promise<void> {
  if (!canMutate.value || likingCommentId.value) return
  /** 本次写入后的目标点赞状态。 */
  const liked = !comment.liked
  likingCommentId.value = comment.id
  /** 标准评论点赞写入回执。 */
  const response = await mutateMusic({
    operation: 'likeComment',
    resourceType: props.resourceType,
    resourceId: props.resourceId,
    commentId: comment.id,
    liked
  })
  likingCommentId.value = null
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  updateComment(comment.id, (current) => ({
    ...current,
    liked,
    likedCount: Math.max(0, current.likedCount + (liked ? 1 : -1))
  }))
}

/** 删除已经确认的本人评论。 */
async function deleteComment(): Promise<void> {
  /** 用户已经确认删除的评论。 */
  const target = deleteTarget.value
  if (!target || deleting.value) return
  deleting.value = true
  /** 标准删除评论回执。 */
  const response = await mutateMusic({
    operation: 'deleteComment',
    resourceType: props.resourceType,
    resourceId: props.resourceId,
    commentId: target.id
  })
  deleting.value = false
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  deleteTarget.value = null
  comments.value = comments.value.filter((comment) => comment.id !== target.id)
  hotComments.value = hotComments.value.filter((comment) => comment.id !== target.id)
  total.value = Math.max(0, total.value - 1)
  state.value = comments.value.length + hotComments.value.length === 0 ? 'empty' : 'ready'
  showToast('评论已删除。', 'success')
}

/** 把评论毫秒时间戳格式化为本地短日期时间。 */
function formatCommentTime(time: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(time))
}

// ========= 生命周期 =========

onMounted(() => {
  void account.initialize()
})

watch(
  () => [props.resourceType, props.resourceId] as const,
  (_resource, _previous, onCleanup) => {
    void loadComments(true)
    onCleanup(() => {
      if (activeRequestId) window.ncx.runtime.cancel(activeRequestId)
      activeRequestId = ''
    })
  },
  { immediate: true }
)
</script>

<template>
  <section
    class="music-comments-section"
    :class="{
      'music-surface': props.mode === 'surface',
      'music-comments-section--drawer': props.mode === 'drawer'
    }"
    aria-labelledby="music-comments-title"
  >
    <header class="music-comments-header">
      <div>
        <p
          v-if="props.mode === 'surface'"
          class="music-page-eyebrow"
        >
          乐评
        </p>
        <h2 id="music-comments-title">
          {{ countText }}
        </h2>
      </div>
      <CommonButton
        v-if="state === 'error'"
        variant="ghost"
        size="compact"
        @click="loadComments(true)"
      >
        重试
      </CommonButton>
    </header>

    <div class="music-comment-composer">
      <CommonTextarea
        v-model="draft"
        :disabled="!canMutate || submitting"
        :invalid="draft.length > MAX_COMMENT_LENGTH"
        :placeholder="canMutate ? '分享你对这段音乐的感受' : '登录网易云后即可发表评论'"
        :rows="3"
        resize="none"
        aria-label="评论内容"
      />
      <div class="music-comment-composer-footer">
        <span :class="{ 'music-comment-limit--invalid': draft.length > MAX_COMMENT_LENGTH }">
          {{ draft.length }} / {{ MAX_COMMENT_LENGTH }}
        </span>
        <CommonButton
          variant="primary"
          size="compact"
          :disabled="!canSubmit"
          :loading="submitting"
          @click="submitComment"
        >
          <Send :size="14" />
          发表
        </CommonButton>
      </div>
    </div>

    <div
      class="music-comments-body"
      aria-live="polite"
    >
      <div
        v-if="state === 'loading'"
        class="music-comments-state"
      >
        <CommonSpinner label="正在加载评论" />
        <span>正在加载评论</span>
      </div>
      <CommonErrorState
        v-else-if="state === 'error'"
        title="评论读取失败"
        :description="errorMessage"
        @retry="loadComments(true)"
      />
      <CommonEmptyState
        v-else-if="state === 'empty'"
        title="还没有评论"
        description="来写下第一条评论吧。"
      />
      <template v-else>
        <div
          v-if="hotComments.length > 0"
          class="music-comments-group"
        >
          <h3>热门评论</h3>
          <article
            v-for="comment in hotComments"
            :key="`hot-${comment.id}`"
            class="music-comment-card"
          >
            <Cover
              :src="comment.author.avatarUrl"
              :alt="comment.author.nickname"
              size="thumbnail"
              shape="circle"
              :hover-effect="false"
              :show-play-button="false"
            />
            <div class="music-comment-main">
              <div class="music-comment-meta">
                <strong>{{ comment.author.nickname }}</strong>
                <span>{{ formatCommentTime(comment.time) }}{{ comment.location ? ` · ${comment.location}` : '' }}</span>
              </div>
              <p>{{ comment.content }}</p>
              <div class="music-comment-actions">
                <CommonButton
                  variant="ghost"
                  size="compact"
                  :disabled="!canMutate || likingCommentId === comment.id"
                  @click="toggleCommentLike(comment)"
                >
                  <Heart
                    :size="13"
                    :fill="comment.liked ? 'currentColor' : 'none'"
                  />
                  {{ comment.likedCount }}
                </CommonButton>
                <CommonIconButton
                  v-if="comment.owner"
                  variant="ghost"
                  size="compact"
                  label="删除评论"
                  @click="deleteTarget = comment"
                >
                  <Trash2 :size="13" />
                </CommonIconButton>
              </div>
            </div>
          </article>
        </div>

        <div
          v-if="comments.length > 0"
          class="music-comments-group"
        >
          <h3>最新评论</h3>
          <article
            v-for="comment in comments"
            :key="comment.id"
            class="music-comment-card"
          >
            <Cover
              :src="comment.author.avatarUrl"
              :alt="comment.author.nickname"
              size="thumbnail"
              shape="circle"
              :hover-effect="false"
              :show-play-button="false"
            />
            <div class="music-comment-main">
              <div class="music-comment-meta">
                <strong>{{ comment.author.nickname }}</strong>
                <span>{{ formatCommentTime(comment.time) }}{{ comment.location ? ` · ${comment.location}` : '' }}</span>
              </div>
              <p>{{ comment.content }}</p>
              <div class="music-comment-actions">
                <CommonButton
                  variant="ghost"
                  size="compact"
                  :disabled="!canMutate || likingCommentId === comment.id"
                  @click="toggleCommentLike(comment)"
                >
                  <Heart
                    :size="13"
                    :fill="comment.liked ? 'currentColor' : 'none'"
                  />
                  {{ comment.likedCount }}
                </CommonButton>
                <CommonIconButton
                  v-if="comment.owner"
                  variant="ghost"
                  size="compact"
                  label="删除评论"
                  @click="deleteTarget = comment"
                >
                  <Trash2 :size="13" />
                </CommonIconButton>
              </div>
            </div>
          </article>
          <CommonButton
            v-if="hasMore"
            class="music-comments-more"
            variant="secondary"
            :loading="loadingMore"
            :disabled="loadingMore"
            @click="loadComments(false)"
          >
            加载更多
          </CommonButton>
        </div>
      </template>
    </div>

    <CommonAlertDialog
      :visible="Boolean(deleteTarget)"
      title="删除这条评论？"
      description="删除后无法恢复。"
      confirm-text="删除"
      @cancel="deleteTarget = null"
      @confirm="deleteComment"
    />
  </section>
</template>

<style scoped>
.music-comments-section {
  display: grid;
  gap: var(--ncx-space-5);
  padding: var(--ncx-space-6);
}

.music-comments-section--drawer {
  min-height: 100%;
  padding: 0;
}

.music-comments-header,
.music-comment-composer-footer,
.music-comment-meta,
.music-comment-actions {
  display: flex;
  align-items: center;
}

.music-comments-header,
.music-comment-composer-footer,
.music-comment-meta {
  justify-content: space-between;
}

.music-comments-header h2 {
  margin: var(--ncx-space-1) 0 0;
  font-size: 20px;
  letter-spacing: -0.02em;
}

.music-comments-section--drawer .music-comments-header h2 {
  margin-top: 0;
  font-size: 15px;
}

.music-comment-composer {
  display: grid;
  gap: var(--ncx-space-2);
}

.music-comment-composer-footer {
  color: var(--ncx-color-text-tertiary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.music-comment-limit--invalid {
  color: var(--ncx-color-danger);
}

.music-comments-body,
.music-comments-group,
.music-comment-main {
  display: grid;
  min-width: 0;
}

.music-comments-body,
.music-comments-group {
  gap: var(--ncx-space-4);
}

.music-comments-state {
  display: flex;
  min-height: 140px;
  align-items: center;
  justify-content: center;
  gap: var(--ncx-space-2);
  color: var(--ncx-color-text-secondary);
}

.music-comments-group h3 {
  margin: 0;
  color: var(--ncx-color-text-secondary);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.01em;
}

.music-comment-card {
  display: grid;
  align-items: start;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--ncx-space-3);
  padding: var(--ncx-space-3) 0;
  border-bottom: 1px solid var(
    --music-page-edge,
    color-mix(in srgb, var(--ncx-color-text-primary) 7%, transparent)
  );
}

.music-comment-card:last-of-type {
  border-bottom: 0;
}

.music-comment-main {
  gap: var(--ncx-space-2);
}

.music-comment-meta {
  align-items: baseline;
  gap: var(--ncx-space-3);
}

.music-comment-meta strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.music-comment-meta span {
  flex-shrink: 0;
  color: var(--ncx-color-text-tertiary);
  font-size: 11px;
}

.music-comment-main > p {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--ncx-color-text-primary);
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.music-comment-actions {
  justify-content: flex-end;
  gap: var(--ncx-space-1);
}

.music-comments-more {
  justify-self: center;
}

@media (width < 1100px) {
  .music-comments-section {
    padding: var(--ncx-space-4);
  }
}

</style>
