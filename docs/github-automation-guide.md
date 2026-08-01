# GitHub 免费自动化说明

这份文档说明当前仓库已经接入的免费自动化能力，以及哪些事情可以完全自动，哪些仍然需要人工确认。

## 已接入能力

### Dependabot 依赖更新

配置文件：`.github/dependabot.yml`

当前策略：

1. 每周一检查 npm 依赖。
2. 小版本和补丁更新会分组提交 PR。
3. `next`、`react`、`react-dom` 的大版本更新不会自动升级。
4. 依赖 PR 会自动打上 `dependencies` 和 `dependabot` 标签。

### PR 检查

配置文件：`.github/workflows/pr-ci.yml`

每个 PR 会自动执行：

1. `npm ci`
2. `npm run lint`
3. `npm run build`

### Dependabot 自动合并

配置文件：`.github/workflows/dependabot-auto-merge.yml`

规则：

1. 只处理 `dependabot[bot]` 创建的 PR。
2. 补丁更新和小版本更新会开启自动合并。
3. 大版本更新不会自动合并，必须人工看。
4. 使用 squash merge，避免依赖 PR 产生太多提交。

### 免费 AI Issue 执行器

配置文件：`.github/workflows/free-ai-issue-executor.yml`

规则：

1. 标题以 `AI 自动迭代请求：` 开头的 Issue 会触发执行。
2. 工作流使用 GitHub Models 生成代码改动，不需要单独购买服务器。
3. 生成改动后会运行 `npm run lint` 和 `npm run build`。
4. 工作流不会直接合并代码，而是创建 PR 供管理员确认。
5. 免费订单、免费授权、普通权限和后台功能允许自动迭代；真实支付、密钥、生产数据删除和破坏性数据库变更仍然禁止自动处理。

## 还不能完全自动的部分

这些工具能自动处理“依赖更新”和“PR 合并”，但不能直接替代后台 AI 自动写代码：

1. 后台提交的业务功能迭代，会进入站内日志队列、GitHub Issue + 免费 AI 执行器，或外部 AI 执行器。
2. 如果没有配置 `GITHUB_TOKEN` 或 `AI_ITERATION_WEBHOOK_URL`，后台只会记录日志，不会自动修改仓库代码。
3. 免费执行器会创建 PR，但复杂需求仍建议人工检查和补充上下文。
4. 免费订单、免费授权、普通权限和后台业务功能可以进入自动迭代；真实支付、密钥、生产数据删除、破坏性数据库变更仍然需要人工确认。

## 推荐使用方式

1. 依赖更新交给 Dependabot 自动处理。
2. 小版本和补丁更新自动合并。
3. 业务需求先通过后台提交为 GitHub Issue，由免费 AI 执行器生成 PR。
4. 大版本更新、真实支付、密钥和破坏性数据库变更人工确认。
5. 后台 AI 自动迭代先生成 PR，确认安全后再合并上线。
