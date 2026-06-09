# BrowseMemory Phase 1 Manual Verification

## Automated Gate

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

预期结果：

- ESLint 无错误
- TypeScript 无错误
- 所有 Vitest 测试通过
- `.output/chrome-mv3/manifest.json` 存在
- 构建总体积低于 500 KB

## Chrome Verification

1. 在 `chrome://extensions` 加载 `.output/chrome-mv3`。
2. 打开普通 HTTP/HTTPS 文章页面，保持标签页活跃至少 5 秒。
3. 切换到另一个标签页，使上一阅读会话完成并入库。
4. 打开 BrowseMemory 侧边栏。
5. 确认今日页数和阅读时长发生变化。
6. 使用文章标题中的英文和中文关键词搜索。
7. 确认结果包含标题、域名、阅读时长和正文片段。
8. 点击结果，确认原页面在新标签页打开。

## RAG Verification

1. 打开设置页。
2. 填写 OpenAI 兼容的 API 地址、Key 与模型。
3. 点击「测试连接」，确认显示连接成功。
4. 保存设置后返回侧边栏。
5. 在「对话」模式提出与已保存页面有关的问题。
6. 确认回答带有 `[1]` 样式来源，并能打开对应页面。
7. 断开网络后再次提问。
8. 确认界面明确显示离线模式，并返回本地 BM25 结果。

## Capture Edge Cases

- 低于设置阈值的访问不入库。
- 同一规范化 URL 在十分钟内重复访问累加时长，不新增记录。
- `chrome://` 等受限页面不入库。
- 黑名单域名不入库。
- SPA 的 `pushState`、`replaceState`、`popstate` 和标题变化会触发页面更新。
- Service Worker 休眠后，活动会话从 `chrome.storage.session` 恢复。

## Visual Verification

检查侧边栏宽度：

- 320px：快照为两列，无横向滚动。
- 400px：搜索、列表和底部导航不遮挡。
- 480px：快照为四列，信息密度保持紧凑。

同时检查：

- 浅色与深色系统模式
- 键盘焦点可见
- 减少动态效果设置
- 长标题、长域名和长回答不会溢出
- 底部「记忆 / 对话」导航始终可用

