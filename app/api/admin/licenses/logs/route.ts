import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

/**
 * GET /api/admin/licenses/logs - 获取授权验证日志
 * ?license_id=xxx  按授权码筛选
 * ?result=valid    按结果筛选
 * ?page=1          分页
 * ?pageSize=20     每页条数
 */
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const licenseId = searchParams.get('license_id');
    const result = searchParams.get('result');
    const domain = searchParams.get('domain');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const where: Record<string, unknown> = {};
    if (licenseId) where.licenseId = licenseId;
    if (result) where.result = result;
    if (domain) where.domain = { contains: domain, mode: 'insensitive' };

    const [logs, total] = await Promise.all([
      prisma.licenseLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.licenseLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('[LICENSE LOGS GET ERROR]', error);
    return NextResponse.json({ error: '获取验证日志失败' }, { status: 500 });
  }
}
