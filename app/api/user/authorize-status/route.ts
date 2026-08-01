import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

/**
 * GET /api/user/authorize-status?productId=xxx
 *
 * 查询当前用户对某个产品的免费授权状态
 * 返回：{ status: 'none' | 'pending' | 'approved' | 'rejected' | 'cancelled', order?: {...}, license?: {...} }
 */
export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: '缺少产品 ID' }, { status: 400 });
    }

    // ---- 查询该用户对该产品的最新订单 ----
    const order = await prisma.order.findFirst({
      where: {
        userId: userPayload.userId,
        productId,
      },
      include: {
        license: {
          select: {
            id: true,
            licenseKey: true,
            expiresAt: true,
            status: true,
            maxDomains: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!order) {
      return NextResponse.json({
        status: 'none',
        order: null,
        license: null,
      });
    }

    return NextResponse.json({
      status: order.status, // pending | paid | approved | rejected | cancelled | refunded
      order: {
        id: order.id,
        orderNo: order.orderNo,
        amount: order.amount,
        createdAt: order.createdAt,
        remark: order.remark,
      },
      license: order.license
        ? {
            id: order.license.id,
            licenseKey: order.license.licenseKey,
            expiresAt: order.license.expiresAt,
            status: order.license.status,
            maxDomains: order.license.maxDomains,
          }
        : null,
    });
  } catch (error) {
    console.error('[AUTHORIZE STATUS ERROR]', error);
    return NextResponse.json(
      { error: '获取授权状态失败' },
      { status: 500 },
    );
  }
}
