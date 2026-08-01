# GitHub 免费 AI 执行器说明

这个项目已经接入一个不需要自建服务器的免费 AI 代码执行器。它使用 GitHub Actions 运行，用 GitHub Models 读取 Issue 需求，自动生成代码改动、运行检查，并创建 Pull Request。

## 工作方式

1. 管理员在后台 `/admin/free-dashboard` 提交迭代请求。
2. 后台接口用 `GITHUB_TOKEN` 创建一个标题以 `AI 自动迭代请求：` 开头的 GitHub Issue。
3. `.github/workflows/free-ai-issue-executor.yml` 自动触发。
4. `scripts/free-ai-issue-executor.mjs` 读取 Issue、收集相关代码文件、调用 GitHub Models。
5. 如果生成了代码改动，工作流会运行 `npm run lint` 和 `npm run build`。
6. 工作流提交新分支并创建 PR。
7. 管理员检查 PR，确认没问题后合并。

## 免费依赖

1. GitHub Actions 免费额度。
2. GitHub Models。工作流使用仓库自动提供的 `GITHUB_TOKEN`，权限里已经声明 `models: read`。
3. 不需要单独购买服务器。
4. 不需要在代码里保存 AI API Key。

## 需要配置

推荐在后台页面配置：

1. 打开后台 `/admin/settings/security`。
2. 找到“GitHub API Token”。
3. 粘贴新生成的 Token 并保存。
4. 回到 `/admin/free-dashboard`，看“AI 自动迭代实验”是否显示已接入 GitHub 免费 AI 执行器。

也可以继续在 Vercel 环境变量里配置：

1. `GITHUB_TOKEN`：用于后台创建 GitHub Issue。
2. `DATABASE_URL`、`JWT_SECRET` 等项目原有必需变量。

`GITHUB_TOKEN` 建议使用新生成的 Token，不要使用已经在聊天、日志或截图里暴露过的 Token。权限至少需要能给当前仓库创建 Issue；如果使用 fine-grained token，请给目标仓库开启 Contents 只读、Issues 读写、Metadata 只读。

## 触发条件

工作流会在这些情况下执行：

1. 新 Issue 标题以 `AI 自动迭代请求：` 开头。
2. Issue 带有 `ai-iteration` 标签。
3. 在 GitHub Actions 页面手动运行 `Free AI issue executor`，并输入 Issue 编号。

## 安全边界

允许自动迭代：

1. 免费订单。
2. 免费授权。
3. 普通用户权限。
4. 后台页面、表单、列表、搜索、筛选。
5. 文档和配置说明。

禁止自动处理：

1. 真实支付、扣款、退款、外部计费。
2. GitHub Token、数据库密码、OAuth Secret、Vercel Token。
3. 删除生产数据。
4. 删除表、删除字段、批量清空或不可回滚的数据迁移。
5. 任何会产生付费资源的操作。

## 注意事项

这个执行器是免费优先方案，适合处理小到中等规模的迭代。复杂需求可能需要多次提交 Issue，或者由人工补充上下文后再运行。

GitHub Models 和 GitHub Actions 都可能有免费额度或速率限制。如果触发失败，先看 Actions 日志，再决定是否重新运行。
