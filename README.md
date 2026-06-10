# BrowseMemory

BrowseMemory 是一个本地优先的 Chrome 浏览记忆扩展。

## 功能概览

### Phase 1 — 核心记忆

- 自动记录符合条件的网页正文与阅读时长
- IndexedDB 本地存储（Dexie）
- 中英文 BM25 离线搜索
- OpenAI 兼容的单轮 RAG 问答与来源引用
- AES-GCM 加密 API Key
- 紧凑的 Quiet Glass 侧边栏与设置页
- SPA 页面检测（pushState + popstate + MutationObserver）

### Phase 2 — 智能增强

- **语义搜索（可选）**：接入 Embedding API（如 BAAI/bge-m3），与 BM25 通过 RRF 融合排序，提供更精准的搜索结果
- **离线任务队列**：Embedding 生成、页面摘要、报告生成均通过持久化任务队列异步调度，支持最多 3 次重试与指数退避
- **AI 页面摘要**：新入库页面自动生成 100 字以内的摘要
- **Query Rewriting**：多轮对话中自动将代词还原为具体实体
- **AI 报告仪表盘**：日报 / 周报 / 月报自动生成，在侧边栏内以 iframe 蒙层展示
- **混合检索**：BM25 + 向量检索 + RRF 融合，Embedding 不可用时静默降级为纯 BM25
- **设置页增强**：语义搜索配置卡片（开关、地址、模型、Key 复用、索引状态）、报告设置卡片
- **10 语言 i18n**：简体中文、English、日本語、한국어、Deutsch、Español、Français、العربية、Português、Русский

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

构建产物位于 `.output/chrome-mv3`。测试套件覆盖 33 个文件、150 个用例。

## 安装未打包扩展

1. 运行 `pnpm build`。
2. 打开 `chrome://extensions`。
3. 开启右上角的「开发者模式」。
4. 点击「加载已解压的扩展程序」。
5. 选择项目中的 `.output/chrome-mv3`。
6. 点击工具栏中的 BrowseMemory 图标打开侧边栏。

## AI 配置

### 对话服务

在扩展设置页填写：

- API 地址，例如 `https://api.deepseek.com`
- API Key
- 模型，例如 `deepseek-v4-flash`

BrowseMemory 调用 `${baseUrl}/v1/chat/completions`。未配置 API Key 或离线时，
搜索仍可使用，问答会降级为本地 BM25 结果摘要。

### 语义搜索（可选）

在设置页的「语义搜索」卡片中：

- 开启「启用语义搜索」开关
- 填写 Embedding 地址，例如 `https://api.siliconflow.cn`
- 选择 Embedding 模型，例如 `BAAI/bge-m3`
- 可选择复用对话 API Key，无需单独配置

BrowseMemory 调用 `${embeddingBaseUrl}/v1/embeddings`。新入库页面会异步生成 Embedding 向量。
未配置 Embedding 或 API 报错时，搜索自动降级为纯 BM25，所有 Phase 1 功能不受影响。

## 报告仪表盘

点击侧边栏的「查看报告」按钮，在应用内打开报告仪表盘。支持：

- 日报 / 周报 / 月报 Tab 切换
- 报告列表按日期排列
- Markdown 格式报告正文渲染
- 主题聚类标签展示
- 手动生成报告

报告通过 Chrome Alarms 定时自动生成（日报默认凌晨 3 点）。

## 架构

```
entrypoints/
  background.ts        Service Worker（ alarms + TaskRunner 调度）
  sidepanel/           侧边栏 UI（记录 + 对话 + 报告蒙层）
  options/             设置页 UI
  dashboard/           报告仪表盘 UI
src/
  ai/                  OpenAI 客户端、Embedding、摘要、Query Rewriter
  background/          应用层（消息路由 + 依赖注入）
  capture/             页面采集、会话状态机
  extraction/          正文提取
  i18n/                国际化（10 语言）
  queue/               离线任务队列 + 调度器
  reports/             报告生成服务
  search/              BM25、混合检索、RRF 融合
  security/            AES-GCM 密钥管理
  shared/              类型、常量、消息协议
  storage/             Dexie 数据库、各 Repository
  ui/                  客户端封装（runtime / options / dashboard）
```

## 隐私

- 浏览正文、索引和设置保存在扩展自身的 IndexedDB。
- API Key 使用不可导出的 AES-GCM 密钥加密。
- 仅当用户主动提问时，最多五条相关页面的受限上下文会发送给配置的 AI 服务。
- Embedding 生成仅在用户显式启用后，对新入库页面异步执行。
- 扩展不申请 `history`、`cookies` 或 `webRequest` 权限。
- 隐身页面默认不采集。

## Embedding 降级策略

| 场景 | 行为 |
|------|------|
| 未配置 Embedding | 纯 BM25 搜索，与 Phase 1 完全一致 |
| 配置 Embedding 后新入库 | 异步入队生成 Embedding，不阻塞入库 |
| Embedding API 报错 | 静默失败，降级为纯 BM25 |
| 离线状态 | 使用已缓存向量 + BM25，跳过新 Embedding |
| 从 Phase 1 升级 | 数据库自动迁移（Dexie v3），所有功能不变 |
