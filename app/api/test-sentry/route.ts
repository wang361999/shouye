import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

/**
 * Sentry 测试端点
 *
 * 访问 /api/test-sentry 触发一个服务端错误，Sentry SDK 会自动捕获。
 * 访问 /api/test-sentry?direct=1 直接模拟调用 webhook 端点（绕过 Sentry）。
 *
 * 用途：
 *   1. 验证 Sentry SDK 是否正常发送错误到 Sentry
 *   2. 验证 Sentry 告警 → Webhook → GitHub Issue 完整链路
 */
export async function GET(request: NextRequest) {
  const direct = request.nextUrl.searchParams.get('direct');

  // ---- 模式 1：直接模拟 Sentry Webhook 调用（绕过 Sentry 平台）----
  if (direct === '1') {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const webhookSecret = process.env.SENTRY_WEBHOOK_SECRET;

    const payload = {
      action: 'created',
      data: {
        issue: {
          id: `test_${Date.now()}`,
          title: '[测试] 手动触发的 Sentry 测试错误',
          culprit: 'app/api/test-sentry/route.ts',
          level: 'error',
          status: 'unresolved',
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          eventCount: 1,
          userCount: 1,
          shortLink: 'https://sentry.io/test',
          project: { name: 'shouye', slug: 'shouye' },
          metadata: {
            type: 'Error',
            value: 'Test error triggered from /api/test-sentry',
            filename: 'app/api/test-sentry/route.ts',
            function: 'GET',
          },
        },
      },
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (webhookSecret) {
        headers['x-webhook-secret'] = webhookSecret;
      }

      const res = await fetch(`${baseUrl}/api/webhooks/sentry`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      return NextResponse.json({
        mode: 'direct_webhook_test',
        webhookStatus: res.status,
        webhookResponse: result,
        message: res.ok
          ? 'Webhook 调用成功！检查 GitHub 仓库是否创建了 Issue。'
          : 'Webhook 调用失败，查看上方响应。',
      });
    } catch (err) {
      return NextResponse.json(
        {
          mode: 'direct_webhook_test',
          error: '无法连接到 webhook 端点',
          detail: err instanceof Error ? err.message : String(err),
          hint: '确保本地开发服务器正在运行 (npm run dev)',
        },
        { status: 500 },
      );
    }
  }

  // ---- 模式 2：通过 Sentry SDK 触发真实错误 ----
  // 每次生成不同的错误类型 + 唯一 fingerprint，确保 Sentry 创建全新 issue
  const errorTypes = [
    { name: 'DatabaseConnectionError', msg: '数据库连接超时' },
    { name: 'NullReferenceError', msg: '无法读取 null 的属性' },
    { name: 'ValidationError', msg: '输入参数验证失败' },
    { name: 'TimeoutError', msg: '请求处理超时 (30s)' },
    { name: 'MemoryExhaustedError', msg: '内存不足，无法分配资源' },
    { name: 'PermissionDeniedError', msg: '用户无权限访问该资源' },
    { name: 'ApiRateLimitError', msg: 'API 调用频率超限' },
    { name: 'FileNotFoundError', msg: '配置文件未找到' },
  ];
  const pick = errorTypes[Math.floor(Math.random() * errorTypes.length)];
  const errorId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  // 使用 withScope 设置唯一 fingerprint，强制 Sentry 创建新 issue
  Sentry.withScope((scope) => {
    scope.setFingerprint([pick.name, errorId]);
    scope.setTag('test_id', errorId);
    scope.setLevel('error');

    const testError = new Error(
      `[${pick.name}] ${pick.msg} (ID: ${errorId})`,
    );
    testError.name = pick.name;
    Sentry.captureException(testError);
  });

  // 强制刷新（确保事件立即发送，不等待批处理）
  await Sentry.flush(5000);

  return NextResponse.json({
    mode: 'sentry_sdk_test',
    message: '测试错误已通过 Sentry SDK 发送！',
    error: {
      name: pick.name,
      message: `[${pick.name}] ${pick.msg} (ID: ${errorId})`,
      fingerprint: `${pick.name}-${errorId}`,
    },
    nextSteps: [
      '1. 打开 Sentry Dashboard 查看是否收到了这个新的错误',
      '2. 如果配置了告警规则，Sentry 会自动发送 Webhook',
      '3. 检查 GitHub 仓库是否自动创建了 Issue',
      '4. 如果想跳过 Sentry 直接测试 Webhook，访问 /api/test-sentry?direct=1',
    ],
  });
}
