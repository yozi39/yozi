# yozi.win V2.0

Yozi 的个人技术站：算法、C++、项目、服务器实验和笔记。

V2 是按两张概念图重做的：

- **暗色模式 = 概念图一**：极客终端风。像素山与月亮、绿色发光终端、四张卡片（算法 / 精选仓库 / 风景 / 链接）、贡献热力图。
- **浅色模式 = 概念图二**：Apple 式极简。大号 “Yozi”、雾中雪山、白色卡片、黑色胶囊按钮、“Get in Touch” 横幅。

首页依次是：首屏 + 终端 → 四张卡片 → 贡献热力图 → Algorithm Journey → “Still learning. Still building.” 风景横幅 → Get in Touch。

两种模式共用同一份 HTML，只靠 CSS 切换风格。技术上是**零依赖的静态站**（HTML + CSS + 原生 ES Modules），不需要 npm，也不需要构建。

## 目录结构

```text
public/                      ← Cloudflare Pages 输出目录
├── index.html               首页（全部内容都在这里）
├── 404.html · _headers · robots.txt · sitemap.xml · site.webmanifest
└── assets/
    ├── css/site.css         顶部：字体与颜色令牌（暗 / 亮两套）
    ├── js/theme.js          首屏前执行：明 / 暗 / 跟随系统，无闪烁
    ├── js/main.js           导航高亮、滚动出现、移动菜单、按钮动作
    ├── js/terminal.js       交互式终端
    ├── js/palette.js        命令面板（Ctrl/⌘ + K 或 /）
    ├── js/util.js           DOM 小工具、提示条、复制链接
    ├── fonts/               Inter、JetBrains Mono（自托管，OFL 许可证同目录）
    ├── favicon.svg
    └── social.png           1200×630 分享图
scripts/
├── fetch_github.py          抓取 GitHub 公开数据，写入 index.html
├── gen_scenery.py           生成首屏两套山景 SVG（--write 直接写入）
├── serve.py                 本地预览（模拟 Pages 的 _headers 与 404）
└── og/                      重新生成 social.png
```

## 本地预览

只需要 Python 3：

```sh
python scripts/serve.py        # http://127.0.0.1:8080/
```

## 部署（Cloudflare Pages + GitHub）

1. 用 ZIP 内容替换仓库里的 `public/`、`README.md`，并加入 `scripts/` 和 `.gitignore`。V1 的 `public/assets/site.css`、`site.js`、`theme.js`、`landscape.webp` 不再使用，可以删掉。
2. Pages 构建设置：

| 设置 | 值 |
| --- | --- |
| Framework preset | None |
| Build command | `python3 scripts/fetch_github.py`（可选，见下文；留空也能正常部署） |
| Build output directory | `public` |
| Root directory | 留空 |

3. 建议先推到预览分支，在 `*.pages.dev` 上检查，再合并到生产分支。
4. 上线后检查：

```sh
curl -I https://yozi.win/                  # 200，带 CSP 等安全头
curl -I https://yozi.win/does-not-exist    # 404
```

### GitHub 数据（真实，无需 Token）

“Selected Repos” 卡片和贡献热力图都来自 `github.com/yozi39` 的公开数据，由 `scripts/fetch_github.py` 写进 `index.html` 里 `<!-- gh:… -->` 标记之间。展示哪些仓库由脚本顶部的 `CURATED` 列表**手动挑选**（目前是 Coding Time Tracker 和 Unity Minesweeper），Star 数每次自动刷新。页面上不显示仓库总数之类的统计数字。

- ZIP 里已经包含一份当前快照，即使不设置构建命令，页面也有数据。
- 把 Build command 设为 `python3 scripts/fetch_github.py`，每次部署都会自动刷新。抓取失败时脚本会保留快照，并且始终以 0 退出，不会让部署失败。
- 想定期刷新，可以在 Cloudflare Pages 里创建 Deploy Hook，再用定时任务（比如 GitHub Actions 的 cron）定期调用它。
- 数据只在构建时抓取。访客的浏览器不会请求 GitHub，CSP 也保持 `default-src 'none'`。

## 功能

- **终端**：`help` `whoami` `about` `ls [repos/]` `cat about.txt|goals.txt|links.txt` `repos` `cd <github|repos|cp|links>` `neofetch` `theme [light|dark|system]` `github` `history` `date` `echo` `menu` `clear`。支持 Tab 补全、↑↓ 历史、Ctrl+L 清屏。所有命令都在本地匹配，不执行、不发送任何输入。
- **命令面板**：Ctrl/⌘ + K 或 `/` 打开，可以跳转区块、打开精选仓库、切换主题、聚焦终端、复制链接。完整支持键盘操作。
- **Links 卡片**：每个图标都是真实动作，分别是 GitHub、终端、命令面板、切换主题、复制链接、GitHub 活动。
- **风景卡片和横幅**：纯装饰，通过 `<use>` 复用首屏的山景，不额外增加图片体积，并跟随明暗主题切换。
- **明暗模式**：默认跟随系统；手动切换后记在 `localStorage`，用 `theme system` 恢复跟随系统。
- **响应式**：≥1240 四列；960–1240 两列；≤960 汉堡菜单；≤680 单列。已按 375 / 768 / 1448 宽度检查过。
- **可访问性**：跳转链接、语义化地标、`aria-live` 终端、可见焦点框，并支持 `prefers-reduced-motion`。

## 中英文切换

页头的 **中 / EN** 按钮可以切换语言，选择会保存在 `localStorage`。首次访问时按浏览器语言自动选择，也可以用链接指定：`https://yozi.win/?lang=zh`、`?lang=en`。终端命令 `lang zh|en` 和命令面板也能切换。

- **页面文字**：英文直接写在 HTML 里，中文写在同一个元素的属性上，两种语言挨在一起，改文案时一起改：
  - `data-zh="…"` 替换元素文字
  - `data-zh-html="…"` 替换含标签的内容（如 `<br>`）
  - `data-zh-aria-label` / `data-zh-title` / `data-zh-placeholder` / `data-zh-content` 替换对应属性
- **脚本里的文字**（终端输出、命令面板、提示条）：在 `terminal.js` / `palette.js` 里写成 `t('English', '中文')`。
- **仓库副标题**：在 `scripts/fetch_github.py` 的 `CURATED` 里一起填中文。
- 实现在 `assets/js/i18n.js`；语言在 `theme.js` 里于首屏绘制前确定，中文访客不会先闪一下英文。
- 搜索引擎主要收录英文（切换在浏览器里完成，不是独立的中文网址）。

## 更新内容

- **换展示的仓库**：编辑 `scripts/fetch_github.py` 顶部的 `CURATED`（仓库名、显示标题、副标题），然后运行 `python scripts/fetch_github.py`。
- **比赛**：目前只写 “Algorithm Contests · What I’m training for”，没有声称任何参赛经历或成绩。以后有了成绩，可以改 `#cp` 区块里第二个统计项，以及终端 `goals.txt`（`terminal.js`）。
- **配色和字体**：都在 `site.css` 顶部的 `:root`（暗色）和 `:root[data-theme="light"]` 中。
- **山景**：调整 `scripts/gen_scenery.py` 里的峰值参数，然后运行 `python scripts/gen_scenery.py --write`。卡片和横幅会自动跟着变。
- **分享图**：运行 `python scripts/og/render_og.py`，在浏览器打开 `http://127.0.0.1:8081/`，页面会自动覆盖 `public/assets/social.png`。

## 隐私

- 页面只公开昵称 Yozi、`github.com/yozi39`、两个精选仓库和公开的贡献热力图。没有真实姓名、学校、位置、邮箱、IP 或服务器信息，也不显示 GitHub 账号的显示名。
- 没有第三方请求：字体自托管，没有统计、Cookie、CDN 或嵌入组件。GitHub 数据只在构建时抓取。
- 页面上没有虚构内容：没有假的统计数字、文章或参赛经历。
- 热力图能看出每天的活跃程度。如果不想公开，删掉 `#github` 卡片即可，`fetch_github.py` 找不到标记时只会给出警告。
