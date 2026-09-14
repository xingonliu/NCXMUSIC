# 液态玻璃材质

光学实现复用 `D:/code/chat/docs/liquid-glass/renderer.js` 的 WebGL 着色器与 `glass()` 绘制，以及 `app.js` 的按钮/Dialog 参数和按压形变。页面只选择档位，不传入折射数值。

## 分级

| 档位 | 光学 | 填充 | 按压 |
| --- | --- | --- | --- |
| `clear` | 完整按钮：`blur 2 / height 12 / amount 24` | 透明，或 `frost` 时白 30%–35% | 有 |
| `tinted` | 与 `clear` 相同 | 语义色 75% | 有 |
| `blur` | 仅高斯模糊，不建位移图 | 浅霜或带色 | 有 |
| `panel` | Dialog 面板：`blur 16 / height 24 / amount 48` + depth | `#FAFAFA 60%` | 无 |

完整档通过窗口截图把真实页面送进 demo 渲染器采样。截图失败时退回画布底色。不完整档只用 CSS `backdrop-filter`。

## 页面映射

- 封面播放、Hero 次操作、弹窗取消：`clear`（弹窗取消带 `frost`）
- Hero 主操作、弹窗确认：`tinted`
- Header 按钮、播放栏、设置页 primary/danger：`blur`
- Dialog、AlertDialog、Drawer、主导航侧栏：`panel`
- 设置侧栏、播放栏容器：`blur` 面板
- 窗口控制项、侧栏导航行、装饰图标、ghost 按钮：不上材质

`CommonButton` / `CommonIconButton` 默认不上材质。窗口控制组可以有一层不完整底，但组内按钮不跟手变形。

## 验证

- `pnpm test -- tests/unit/liquid-glass-presets.test.ts`
- 通用按钮与 PlayerBar 组件测试覆盖材质入口
- UI Lab 的 LiquidGlass 卡片提供完整/不完整/面板样例，背景使用 demo 同款渐变
