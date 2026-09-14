# 液态玻璃材质

## 分级

| material | 光学效果 | 适用场景 |
| --- | --- | --- |
| clear | 轻模糊、边缘折射、透明表面、高光 | 静态封面上的操作 |
| tinted | 与 clear 相同的折射，语义色填充 | 设置页主要操作 |
| blur | 仅高斯背景模糊 | Header、动态背景及普通页内操作 |
| dialog | 较强模糊、较厚中性填充、边缘深度折射 | Dialog、AlertDialog、模态 Drawer |

按压形变独立于材质，共用 `useGlassPress`。变形的是材质与内容层，原生按钮的布局和点击区域保持不变；普通装饰图标不应用材质。`tone` 只表达 neutral / accent / danger，不能改变操作语义。

## 渲染方式

光学曲线来自用户提供的 `D:/code/chat/docs/liquid-glass/renderer.js` 和 `app.js`：圆形剖面折射、边缘有限厚度、面板深度法线以及按压弹簧。迁移为背景 SVG 位移滤镜，让 Chromium 直接取样真实 DOM 背景，而不是把整个应用重画到示例的 WebGL 场景里。保留现有 Squircle 外形，光学距离场采用圆角矩形近似；高光与最终裁切遵循实际 CSS Squircle，不能声称与原 WebGL 示例逐像素一致。

按钮 blur/height/amount 起点为 2/12/24；Dialog 为 16/24/48。不会对文字和图标执行滤镜。折射图只在几何尺寸变化时重建，最长边限制 512 像素，最多缓存 24 个尺寸与材质组合。无静态逐帧渲染循环，也不截图冻结页面。内部内容滚动及背景更新由浏览器合成器处理。

`GlassSurface` 是无布局、无命中区域的材质层；宿主提供定位和圆角。页面只选择材质，不传入光学实现参数。`blur` 不创建位移图。无法生成位移图时降为模糊表面；减少透明度或强制颜色时切换实色，减少动态效果时关闭形变。

## 验证

- `pnpm test -- tests/unit/glass-optics.test.ts`：折射中心稳定、边缘对称、简化级零折射、小尺寸与大尺寸边界。
- `pnpm test:materials`：用项目 Electron 运行隔离材质场景，验证四种材质、亮暗主题、尺寸更新、真实像素差异、实时背景、按压回弹、键盘和禁用态、减少动态效果及强制颜色。
- 截图输出到 `output/playwright/materials/`。测试窗口与正常应用分离，不需要音乐服务或登录。
- 页面组合测试挂载真实 AppShell、MusicDetailHero、Cover、PlayerBar 与通用控件；仅将原生账户、窗口和快照存储桥替换为离线夹具，验证侧栏分级、Header 滚动显现和播放栏尺寸。此测试不验证音乐服务或真实播放。

先完成上述材质测试，再接入通用组件及页面。参考页面的浏览器预览因 file URL 策略不可用，迁移依据为用户指定源文件；本项目独立测试场景已在 Electron 中实测。

## 页面映射与接口

- `CommonButton`、`CommonIconButton` 默认 `material="blur"`。静态封面上的播放图标显式使用 `clear`；设置页 primary / danger 操作显式使用 `tinted`。其他图标保留原图形，不单独增加材质。
- `CommonHeaderButton` 固定简化级；`CommonHeaderGroupButton` 共享一个模糊底面，组内按钮只对内容应用形变。
- `CommonDialog`、`CommonAlertDialog`、`CommonDrawer` 面板使用 `dialog`，不继承按钮按压形变。弹窗焦点只识别真实链接，不能把滤镜的 `feImage[href]` 当成可聚焦元素。
- `PlayerBar` 使用 `<LiquidGlass material="blur" squircle-size="2xl">`，定位仍由播放栏自身控制。
- 主导航侧栏采用 Dialog 材质；常驻设置侧栏采用轻模糊级。两者使用真实背景合成，无需假定页面停止更新。歌手、歌单／专辑和歌曲 Hero 上的主要操作使用 tinted，辅助操作使用 clear。
- `LiquidGlass` 仅接受 `material`、`tone` 和 `squircleSize`，普通 class 作用于根节点；旧的独立折射、色散、亮度、深浅色参数已移除。所有已有调用同步迁移。
- UI Lab 的 LiquidGlass 展示区提供完整分级测试面板，可切换主题、运动背景、尺寸，以及打开真实弹窗和抽屉。

滚动页面的 Header 背景渐变属于布局系统，其原有滚动显现规则不由按钮材质改变。常驻导航侧栏与模态 Drawer 区分处理，不把整页内容卡片、输入框或文本自动玻璃化。
