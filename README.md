# mediaBrowser-for-pr

一个 Adobe Premiere Pro 的 **CEP 扩展面板**——「媒体浏览器」。在 Premiere 里以「左侧 Bin 树 + 右侧素材网格」浏览当前项目的素材，双击进源监视器或时间线。本地个人自用，无需 Creative Cloud 侧载，只靠文件扫描加载。

> 前身是同功能的 UXP 版本，因无法脱离 Creative Cloud 侧载（会影响 PR↔ME 链接）、且在 Premiere 26.0 上撞到 UXP 面板空白的已知 bug 而放弃，改用 CEP 重建。

---

## 功能

- **Bin 树浏览**：左侧显示项目 Bin 树，展开/折叠，按需加载（展开某节点时才读它的子 Bin，大项目打开面板不卡）。
- **素材网格**：点选 Bin，右侧网格显示直接子项；子 Bin 卡片与素材卡片视觉区分，双击子 Bin 下钻。
- **图片真实缩略图**：浏览器原生格式图片（jpg/jpeg/png/webp/gif/bmp）通过 `file://` 显示真实画面，加载失败降级为类型封面。
- **类型封面**：视频/音频/序列/非浏览器原生格式图片显示清晰的类型图标。
- **离线标记**：离线素材显示离线标识（基于 `isOffline()`）。
- **双击打开**：视频/音频/图片进源监视器；序列进时间线；打开失败给面板内非阻塞提示。
- **单击选中**：状态栏显示名称、类型、离线状态。
- **自动刷新**：当前展开/选中层按内容指纹轮询（约 1.5s），变化时重建；切换/打开/关闭项目自动重建；另有手动刷新按钮。快速切换时用代次 + 项目 key 丢弃过期结果。
- **大 Bin 承载**：分页 120/页 + 加载更多 + 分批渲染，数百项也不卡。
- **状态提示**：无活动项目 / 空 Bin / 加载中 / 读取失败均有清晰文案。

## 环境要求

- Adobe Premiere Pro，CSXS 12（Premiere Pro 2024+，已在 26.x 上验证）。
- Windows。开发/测试需 Node.js（用于运行纯逻辑单测，无第三方依赖）。
- 需开启 CEP 调试模式（加载未签名扩展）：注册表 `HKCU\Software\Adobe\CSXS.12` 的 `PlayerDebugMode=1`。

## 安装 / 部署

本仓库是开发源。运行时需把运行文件同步到 Premiere 的 CEP 扩展目录，二者物理隔离（避免 Premiere 运行时锁文件污染 git）。

1. **检查调试模式**（只读，不改注册表）：

   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\check-cep-debug.ps1
   ```

   若提示未开启，在 `HKCU\Software\Adobe\CSXS.12` 手动新建 DWORD `PlayerDebugMode=1`，重启 Premiere。

2. **同步运行文件到扩展目录**：

   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\sync-cep.ps1 -Source "<仓库绝对路径>"
   ```

   默认部署到 `%APPDATA%\Adobe\CEP\extensions\com.mediaBrowser.pr\`，只复制运行文件（`CSXS/`、`index.html`、`css/`、`js/`、`jsx/`、`.debug`），不含文档与 `.git`。

3. 重启 Premiere，从菜单 **窗口 → 扩展 → 媒体浏览器** 打开面板。

> 远程调试：`.debug` 声明端口 `8088`，面板加载后浏览器打开 `http://localhost:8088` 可看 CEF 控制台。

## 使用

- 左侧点节点前的箭头展开/折叠 Bin；点节点名把它的子项显示到右侧网格。
- 右侧单击卡片选中（状态栏显示信息）；双击素材进源监视器、双击序列进时间线、双击子 Bin 下钻。
- 顶部「刷新」按钮强制刷新当前层；素材增删后面板也会自动刷新。

## 项目结构

```
CSXS/manifest.xml   扩展清单（CSXS 12、Panel、bundle id com.mediaBrowser.pr）
.debug              远程调试端口声明
index.html          面板入口（从 file:// 加载）
css/styles.css      样式
js/CSInterface.js   Adobe CEP 接口库（宿主通信）
js/logic.js         纯逻辑函数（唯一单测接缝：类型判断/路径转 URL/指纹/信封/分页）
js/main.js          UI 渲染与交互
jsx/host.jsx        ExtendScript 宿主脚本，经 evalScript 访问 app.project.*
test/logic.test.mjs 纯逻辑单测（node:test）
tools/*.ps1         调试模式检查 / 部署同步脚本
docs/roadmap.md     需求与改进路线
```

**架构**：前端（CEF/Chromium，`index.html`+`js/`）负责 UI；后端（`jsx/host.jsx`，ExtendScript）经 `csInterface.evalScript()` 访问项目 API。前后端契约用「信封」：JSX 每个函数返回 `JSON.stringify({ok:true,data} | {ok:false,error})`，前端 `JSON.parse` 后按 `ok` 分支。

## 开发与测试

纯逻辑集中在 `js/logic.js`，是唯一可脱离 Premiere 的测试接缝：

```bash
node --test
```

覆盖：扩展名→素材类型判断、Windows/中文/空格/特殊字符路径转 `file://` URL、内容指纹生成与比对、信封解析、分页计算、双击动作分派。

`jsx/host.jsx`（依赖 Premiere 宿主）与 `js/main.js` 的 DOM 渲染走真机验收，不写单测。

## 待实现功能 / Roadmap

以下为 v1 之后的规划，详见 [`docs/roadmap.md`](docs/roadmap.md)。成本：小（半天内）/ 中（约一天）/ 大（一到两天以上）。

### 已提出需求

- [ ] **A1 视频静态缩略图**（首帧，需 Node+ffmpeg 抽帧 + 缓存）— 大
- [ ] **A2 视频悬停擦洗预览**（受编码支持限制）— 大
- [ ] **A3 素材拖入时间线**（HTML5 拖拽，需真机验证落点）— 中 · *投入产出比最高，建议 v2 首个*
- [ ] **A4 Bin 与素材按名称排序**（中文 localeCompare）— 小–中
- [ ] **A5 左右面板大小可拖拽调整** — 小–中
- [ ] **A6 面板美化 + 紧凑布局**（缩小/折叠头部等）— 小
- [ ] **A7 一键展开所有 Bin**（需进度提示/上限保护）— 中
- [ ] **A8 素材标签**：读取 PR 中素材标记并展示在缩略图下方 — 中
- [ ] **A9a 右键菜单：在项目中显示**（reveal 到项目面板）— 中
- [ ] **A9b 右键菜单：标记优质素材 / 评级**（需自建本地元数据存储）— 中–大

### 补充建议

- [ ] **S1 搜索/过滤框**（按名称过滤当前 Bin 或全项目）— 中
- [ ] **S2 面包屑路径 + 返回上级** — 小
- [ ] **S3 键盘导航**（方向键选中、回车打开、退格返回）— 中
- [ ] **S4 缩略图尺寸切换 + 网格/列表视图** — 中
- [ ] **S5 悬停/状态栏显示元数据**（时长/分辨率/帧率/大小/路径）— 中
- [ ] **S6 记住面板状态**（展开项、选中、面板宽度、视图模式）— 小
- [ ] **S7 按类型/离线筛选 + 更多排序键** — 小–中
- [ ] **S8 高亮「当前源监视器中打开」的素材** — 中

### 建议推进顺序

1. 一批纯前端快赢：A4 + A5 + A6 + S6 + S2（同块前端一次做完）
2. A3 拖入时间线（高价值，单独立项 + 真机验证）
3. S1 搜索 + S7 筛选/排序扩展
4. A7 一键展开、S3 键盘导航
5. A8 标签 / S5 元数据 / A9a 在项目中显示（先集中查证 API）
6. A9b 评级（先定本地元数据存储方案，单独立项）
7. A1 视频缩略图 → A2 悬停预览（重、受编码限制，放最后）

## License

MIT
