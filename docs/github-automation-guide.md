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

## 还不能完全自动的部分

这些工具能自动处理“依赖更新”和“PR 合并”，但不能直接替代后台 AI 自动写代码：

1. 后台提交的业务功能迭代，需要进入站内日志队列、GitHub Issue 队列或外部 AI 执行器。
2. 如果没有配置 `AI_ITERATION_WEBHOOK_URL`，后台不会自动修改仓库代码。
3. 涉及支付、授权、权限、数据库结构和生产数据的变更仍然需要人工确认。

## 推荐使用方式

1. 依赖更新交给 Dependabot 自动处理。
2. 小版本和补丁更新自动合并。
3. 大版本更新、业务功能改动、数据库变更人工确认。
4. 后台 AI 自动迭代先进入队列，确认安全后再上线。
