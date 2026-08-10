# 沉浸歌词页顶部关闭短杆 Design QA

**Source Visual Truth**

- Path: `C:\Users\Administrator\AppData\Local\Temp\企业微信截图_17863332221714.png`。
- Pixels: 1280 × 800。
- CSS size / density: 1280 × 800、1x 视觉基准。
- State: 沉浸歌词页播放《失眠》，白色短杆位于页面最上方；红框标注新的顶部中央目标位置，中心约为 `x=640px, y=69px`。

**Implementation Evidence**

- Screenshot path: `C:\Users\Administrator\AppData\Local\Temp\ncxmusic-immersive-click-only-restored.png`。
- Comparison path: `C:\Users\Administrator\AppData\Local\Temp\ncxmusic-immersive-handle-comparison.png`。
- Pixels: 原始窗口捕获 1296 × 808；去除 8px 外框后按 1280 × 800 与参考图并排比较。
- CSS size / density: 应用内容 1280 × 800、1x。
- State: 与参考图相同的歌曲、歌词、窗口尺寸和静止交互状态。
- Primary interactions tested: Pointer 按下、移动和释放不触发关闭；点击唯一短杆触发一次 `close`；既有共享元素开合方向和动画生命周期测试继续通过。
- Console errors checked: Windows 窗口捕获接口不提供 Renderer Console；专项组件测试覆盖本次交互路径。

**Full-view Comparison Evidence**

- 已把参考图和修正后实机截图合成为同一张 2560 × 800 对照图查看。
- 封面、歌曲信息、播放控制、歌词列、窗口控制和队列按钮的位置与修正前一致，没有因短杆提升到根层而发生布局偏移。
- 修正后短杆保持页面水平中心，视觉中心约为 `x=640px, y=69px`，与红框目标中心一致。

**Focused Region Comparison Evidence**

- 聚焦区域为页面顶部中央 68 × 32px 关闭按钮命中区。
- 参考图红框覆盖约 `x=609–678px, y=62–76px`；实现中的白色横线覆盖约 `x=630–666px, y=66–72px`，完整落在目标框内并保持原有长度、粗细和圆头。

**Findings**

- 没有剩余 P0、P1 或 P2 视觉差异。
- [P3] Renderer Console 未由窗口捕获通道直接读取；本次属于验证工具限制，不影响可见结果或点击交互测试。

**Required Fidelity Surfaces**

- Fonts and typography: 本次未修改字体、字重、字号、行高、字距或歌词层级；并排图中无变化。
- Spacing and layout rhythm: 短杆从封面列移到根层顶部中央，`top: 53px` 配合 32px 命中区让横线中心落在 `y=69px`；其他页面间距保持不变。
- Colors and visual tokens: 保留白色短杆、透明背景和既有 Hover 泛光，没有新增底色或状态颜色。
- Image quality and asset fidelity: 沿用原歌曲封面、模糊背景和现有矢量短杆，没有新增或替换图像资产；并排图中封面清晰度与裁切一致。
- Copy and content: 歌曲、歌手、歌词、按钮标签和辅助功能文案均未改变。

**Comparison History**

1. Earlier finding: 第一版把短杆从封面列提升到根层后中心位于约 `y=20px`，高于用户第二张截图的红框目标。
2. Fix made: 将根层绝对定位从 `top: 4px` 调整为 `top: 53px`，保持 `left: 50%` 和 `translateX(-50%)`。
3. Post-fix evidence: 1280 × 800 实机捕获显示横线中心约为 `y=69px`，完整位于参考图红框内；全页其他内容无位移。

**Implementation Checklist**

- 顶部中央只渲染一个关闭短杆。
- Pointer 拖动不会移动短杆、封面或其他元素，也不会触发关闭。
- 点击短杆继续触发现有共享元素关闭动画。
- Hover 保持透明背景与白色泛光。

**Follow-up Polish**

- 无需额外视觉调整。

final result: passed
