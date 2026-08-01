import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

/**
 * GET /api/user/orders - 获取当前用户的订单列表（需登录）
 * 查询参数：?page=1&pageSize=20
 * 返回：{ data: [...], total, page, pageSize }
 */
export async function GET(request: NextRequest) {
  try {
    // ---- 登录鉴权 ----
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // ---- 解析分页参数 ----
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(
      1,
      Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10)),
    );

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId: userPayload.userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          product: {
            select: { name: true, icon: true, downloadUrl: true },
          },
        },
      }),
      prisma.order.count({
        where: { userId: userPayload.userId },
      }),
    ]);

    const data = orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      productName: o.productName,
      projectType: o.projectType,
      maxDomains: o.maxDomains,
      amount: o.amount,
      validDays: o.validDays,
      status: o.status,
      payMethod: o.payMethod,
      paidAt: o.paidAt,
      licenseId: o.licenseId,
      createdAt: o.createdAt,
      product: o.product
        ? { name: o.product.name, icon: o.product.icon, downloadUrl: o.product.downloadUrl }
        : null,
    }));

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('[USER ORDERS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取订单列表失败' },
      { status: 500 },
    );
  }
}
