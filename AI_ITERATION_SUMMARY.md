# AI 自动迭代结果

模型：由共享 AI 客户端模块管理

## 摘要

优化 Sentry Webhook 处理逻辑，识别来自测试端点 `/api/test-sentry` 的测试告警，将其标记为测试 Issue 且不触发 AI 自动迭代器，从而根治由于测试引起的无效自动修复任务。

## 细节

- 在 `app/api/webhooks/sentry/route.ts` 中增加测试告警检测（通过匹配 culprit, title 或 errorValue 是否包含 `test-sentry`）。
- 若检测为测试告警，则在 GitHub Issue 标题前加上 `[Sentry 测试告警]` 前缀，以作区分。
- 若检测为测试告警，跳过调用 `triggerAiExecutor` 阶段，避免触发 AI 自动迭代和不必要的 CI 执行。

## 已写入文件

- `app/api/webhooks/sentry/route.ts`
