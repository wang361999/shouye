import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/_monitor/track
 *
 * 内部追踪端点，接收中间件发送的请求追踪数据
 * 不需要鉴权（通过 X-Internal-Track header 验证来源）
 * 使用 upsert 累加每日统计和路由级别统计
 */
export async function POST(request: NextRequest) {
  // 验证内部调用标识
  const internalHeader = request.headers.get('x-internal-track');
  if (internalHeader !== '1') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { path, method, duration, isApi, dataBytes } = body as {
      path: string;
      method: string;
      duration: number;
      isApi: boolean;
      dataBytes: number;
    };

    // 今天的日期（去掉时分秒）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 估算数据传输量：如果没有 content-length，按类型估算
    const estimatedBytes =
      dataBytes > 0
        ? dataBytes
        : isApi
          ? 2048 // API 平均 2KB
          : 15360; // 页面平均 15KB

    // 估算 CPU 时间：如果没有 duration，按类型估算
    const cpuMs = duration > 0 ? duration : isApi ? 50 : 10;

    // 估算内存使用（MB-seconds）：每次调用约 256MB × 平均 100ms = 0.0071 MB·s
    // 这个值会在监控 API 中汇总计算

    // ---- Upsert 每日统计 ----
    await prisma.monitoringDaily.upsert({
      where: { date: today },
      create: {
        date: today,
        functionInvocations: isApi ? 1 : 0,
        edgeRequests: 1,
        cpuTimeMs: cpuMs,
        dataTransferBytes: BigInt(estimatedBytes),
      },
      update: {
        functionInvocations: { increment: isApi ? 1 : 0 },
        edgeRequests: { increment: 1 },
        cpuTimeMs: { increment: cpuMs },
        dataTransferBytes: { increment: BigInt(estimatedBytes) },
      },
    });

    // ---- Upsert 路由级别统计 ----
    await prisma.monitoringRoute.upsert({
      where: {
        date_path_method: {
          date: today,
          path: path,
          method: method,
        },
      },
      create: {
        date: today,
        path: path,
        method: method,
        requestCount: 1,
        totalCpuMs: cpuMs,
        totalDataBytes: BigInt(estimatedBytes),
      },
      update: {
        requestCount: { increment: 1 },
        totalCpuMs: { increment: cpuMs },
        totalDataBytes: { increment: BigInt(estimatedBytes) },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[MONITOR TRACK ERROR]', error);
    return NextResponse.json(
      { error: 'Track failed' },
      { status: 500 }
    );
  }
}

// GET 不可访问（安全）
export async function GET() {
  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}
