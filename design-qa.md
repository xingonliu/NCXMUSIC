# 沉浸歌词页下拉手势 Design QA

**Source Visual Truth**

- Path: conversation attachment `Image #1`（原始本地临时路径未写入仓库）。
- Pixels: 1280 × 800。
- CSS size / density: 参考图未提供设备缩放信息，按 1280 × 800、1x 视觉基准记录。
- State: 沉浸歌词页已播放歌曲，短杆静止；用户补充要求覆盖短杆 Hover 和下拉关闭状态。

**Implementation Evidence**

- Screenshot path: conversation attachment `Image #1`（用户于本轮提供的 1280 × 800 拖拽中截图；原始临时路径未写入仓库）。
- Target viewport: 1280 × 800。
- Automated state evidence: `tests/unit/immersive-player.test.ts` 覆盖辅助元素渐隐、源目标封面几何插值、距离与速度阈值、单根 SVG 横线，以及达到阈值后在当前拖拽位置直接请求共享元素关闭。
- Primary interactions tested: 下拉进度、封面向 PlayerBar 的位置/尺寸/圆角插值、回弹判定、快速下甩、阈值关闭请求、单线 SVG 结构。
- Console errors checked: unavailable；当前 Electron 应用没有可用的匹配播放状态截图通道。

**Full-view Comparison Evidence**

- 参考图已打开并核对 1280 × 800 构图。
- 用户提供的实现截图显示旧实现把整个沉浸内容纵向平移：短杆与大封面沿同一 X 轴下落，大封面在底部被窗口裁切，没有在拖动中横向靠近 PlayerBar 封面。

**Focused Region Comparison Evidence**

- 目标区域为左侧封面上方短杆、封面本体和底部 PlayerBar 封面终点。
- 已确认旧实现的封面缩放停留在大尺寸且只向下移动；修正后的同状态截图或录屏仍缺失，因此无法完成修正后聚焦区域的并排复核。

**Findings**

- [P1] 缺少同状态渲染证据
  - Location: 沉浸歌词页短杆、封面与 PlayerBar 共享元素过渡。
  - Evidence: 用户截图证明旧实现存在垂直下坠问题，但当前环境仍无法捕获修正后带真实播放曲目的 Electron 状态；Windows 自动化接口的文档入口不可用，无法安全继续控制应用。
  - Impact: 代码和组件测试可证明交互路径，但不能替代对泛光强度、缩放观感和共享元素终点的视觉确认。
  - Fix: 在可用的 Electron 播放状态下捕获 1280 × 800 静止、Hover、拖拽中和释放后四个状态，再与参考图并排复核。

**Required Fidelity Surfaces**

- Fonts and typography: 本次未改字体、字号、行高、字重或文案层级；缺少实现截图，视觉复核阻塞。
- Spacing and layout rhythm: 短杆 SVG 从 56px 双线结构收敛为 44px 视框内 30px 单线，命中区仍为 68 × 32；缺少实现截图，实际视觉节奏复核阻塞。
- Colors and visual tokens: Hover 使用白色双层 `drop-shadow` 泛光且背景保持透明；缺少实现截图，强度复核阻塞。
- Image quality and asset fidelity: 沿用真实歌曲封面与既有 `MediaArtwork`，没有新增或替换位图资产；旧实现截图中封面保持清晰，修正后连续缩放清晰度仍待复核。
- Copy and content: 未改歌曲、歌手、歌词或控制器文案。

**Comparison History**

1. Earlier finding: 首版达到阈值后先把内容滑出视口，再触发关闭，封面无法从沉浸页当前位置自然过渡到 PlayerBar。
2. Fix made: 删除滑出视口的提交动画和等待定时器；阈值成立时保留当前拖拽位移并立即发出关闭请求，由既有 `ncx-now-playing-artwork` View Transition 完成封面到 PlayerBar 的共享元素过渡。
3. Second finding: 用户提供的 1280 × 800 拖拽中截图显示整个沉浸内容仍直线向下，封面没有在手势过程中向 PlayerBar 目标移动。
4. Second fix made: 移除 `.immersive-content` 整体 Y 轴平移；按下时读取沉浸封面与 PlayerBar 封面的真实矩形，拖动中让封面沿纵向跟手、横向平滑收拢，并同步插值尺寸和视觉圆角。短杆单独跟手，其他元素只渐隐。
5. Post-fix evidence: 7 个专项测试通过，其中几何测试确认代表性 1280 × 800 布局在半程同时产生 136.5px 横向移动、273.5px 纵向移动和约 0.556 倍缩放；修正后渲染截图仍不可用。

**Implementation Checklist**

- 在带播放曲目的 Electron 窗口中检查短杆 Hover 泛光且无底色。
- 慢速下拉检查封面连续缩小、其余元素连续渐隐和未达阈值回弹。
- 达到阈值释放，检查封面从当前拖拽位置落到 PlayerBar 封面，而非直接向下离场。
- 检查动画期间无控制器闪烁、背景跳变或浏览器控制台错误。

**Follow-up Polish**

- 可在真实屏幕观感确认后微调泛光半径和 220px 关闭阈值。

final result: blocked
