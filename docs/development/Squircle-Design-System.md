# Squircle 形状规范

Ncxmusic 的可见圆角统一采用 Squircle。设计基准来自 `D:\临时文件夹-xx\ios-squircle-demo.html`，全局平滑度固定为 60%，与参考 demo 的 iOS / Figma Corner Smoothing 取值一致。

## 实现约束

- Renderer 通过 Electron 原生 `-electron-corner-smoothing` 实现连续曲率；全局规则位于 `src/renderer/design-system/styles/global.css`。
- 独立的语音胶囊窗口不加载 Renderer 样式，因此在 `src/main/index.ts` 的隔离页面样式中应用同一规则。
- 不使用 SVG `clip-path` 裁切普通组件。裁切会同时截断外阴影、焦点轮廓和溢出内容，不适合作为全局组件方案。
- `border-radius` 只负责尺寸，形状统一由 60% 平滑度决定。尺寸过大时 Electron 会根据元素边界自动回退，胶囊和等宽形状仍可使用 `full`。
- 新代码不得写非零的圆角字面量、百分比或带 fallback 的旧 token；只允许以下 Squircle token、`0` 或 `inherit`。

## 尺寸阶梯

| Token | 数值 | 推荐用途 |
| --- | ---: | --- |
| `--ncx-squircle-radius-xs` | 6px | 微型状态、细节和窄轨道 |
| `--ncx-squircle-radius-sm` | 10px | 紧凑控件和小型封面 |
| `--ncx-squircle-radius-md` | 14px | 默认控件、列表项和输入框 |
| `--ncx-squircle-radius-lg` | 18px | 卡片、菜单和常规面板 |
| `--ncx-squircle-radius-xl` | 24px | 大型容器和页面区块 |
| `--ncx-squircle-radius-2xl` | 30px | 展示层和主容器 |
| `--ncx-squircle-radius-full` | 9999px | 胶囊、轨道和等宽形状 |

## 使用方式

```css
.panel {
  border-radius: var(--ncx-squircle-radius-lg);
}
```

需要只保留部分角时，仍使用同一尺寸 token：

```css
.panel-start {
  border-radius: var(--ncx-squircle-radius-lg) 0 0 var(--ncx-squircle-radius-lg);
}
```

尺寸阶梯可在 Design System UI Lab 的“容器与高级布局类组件”中直接检查。Electron 属性说明见 [Electron Corner Smoothing CSS](https://www.electronjs.org/docs/latest/api/corner-smoothing-css)。
