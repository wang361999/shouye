import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// ============ GET /api/user/licenses/logs - 获取当前用户授权码的验证日志 ============
// 查询参数: ?page=1&pageSize=20&licenseId=xxx
export async function GET(request: NextRequest) {
  try {
    // ---- 登录鉴权 ----
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(
      1,
      parseInt(searchParams.get('pageSize') || '20', 10),
    );
    const licenseId = searchParams.get('licenseId');

    // ---- 确定当前用户拥有的授权码 ID 集合 ----
    const userLicenses = await prisma.license.findMany({
      where: { ownerId: userPayload.userId },
      select: { id: true },
    });
    const userLicenseIds = userLicenses.map((l) => l.id);

    // ---- 构建查询条件 ----
    const where: Record<string, unknown> = {};

    if (licenseId) {
      // 过滤指定授权码：必须属于当前用户
      if (!userLicenseIds.includes(licenseId)) {
        return NextResponse.json(
          { error: '无权查看该授权码的日志' },
          { status: 403 },
        );
      }
      where.licenseId = licenseId;
    } else {
      // 仅查询当前用户名下授权码的日志
      where.licenseId = { in: userLicenseIds };
    }

    // ---- 分页查询 ----
    const [total, logs] = await Promise.all([
      prisma.licenseLog.count({ where }),
      prisma.licenseLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const data = logs.map((log) => ({
      id: log.id,
      licenseKey: log.licenseKey,
      domain: log.domain,
      ip: log.ip,
      userAgent: log.userAgent,
      result: log.result,
      message: log.message,
      createdAt: log.createdAt,
    }));

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('[USER LICENSE LOGS ERROR]', error);
    return NextResponse.json(
      { error: '获取验证日志失败' },
      { status: 500 },
    );
  }
}
