# BrowseMemory

BrowseMemory 是一个本地优先的 Chrome 浏览记忆扩展。Phase 1 MVP 已打通：

- 自动记录符合条件的网页正文与阅读时长
- IndexedDB 本地存储
- 中英文 BM25 离线搜索
- OpenAI 兼容的单轮 RAG 问答与来源链接
- AES-GCM 加密 API Key
- 紧凑的 Quiet Glass 侧边栏与设置页

## 开发

要求 Node.js 22+ 与 pnpm。

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

构建产物位于 `.output/chrome-mv3`。

## 安装未打包扩展

1. 运行 `pnpm build`。
2. 打开 `chrome://extensions`。
3. 开启右上角的「开发者模式」。
4. 点击「加载已解压的扩展程序」。
5. 选择项目中的 `.output/chrome-mv3`。
6. 点击工具栏中的 BrowseMemory 图标打开侧边栏。

## AI 配置

在扩展设置页填写：

- API 地址，例如 `https://api.deepseek.com`
- API Key
- 模型，例如 `deepseek-v4-flash`

BrowseMemory 调用 `${baseUrl}/v1/chat/completions`。未配置 API Key 或离线时，
搜索仍可使用，问答会降级为本地 BM25 结果摘要。

## 隐私

- 浏览正文、索引和设置保存在扩展自身的 IndexedDB。
- API Key 使用不可导出的 AES-GCM 密钥加密。
- 仅当用户主动提问时，最多五条相关页面的受限上下文会发送给配置的 AI 服务。
- 扩展不申请 `history`、`cookies` 或 `webRequest` 权限。
- 隐身页面默认不采集。

## Phase 1 边界

当前不包含 Embedding、向量检索、自动报告、多轮对话、Firefox、本地备份服务、
高级可视化或云同步。

完整人工验收步骤见
[docs/testing/manual-phase-1.md](docs/testing/manual-phase-1.md)。

