import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

/**
 * POST /api/user/orders/[id]/pay - 模拟支付（演示/手动，需登录）
 * Body: { payMethod }
 * 校验订单归属当前用户且状态为 pending，置为 paid（等待管理员审核）
 * 注意：支付后不自动生成授权码，需管理员审核通过后才生成
 * 返回：{ message }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // ---- 登录鉴权 ----
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id: orderId } = params;
    const body = await request.json();
    const { payMethod } = body;

    if (!payMethod) {
      return NextResponse.json(
        { error: '请选择支付方式' },
        { status: 400 },
      );
    }

    // ---- 查询订单并校验归属 ----
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 },
      );
    }

    if (order.userId !== userPayload.userId) {
      return NextResponse.json(
        { error: '无权操作该订单' },
        { status: 403 },
      );
    }

    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: `订单状态为「${order.status}」，无法支付` },
        { status: 400 },
      );
    }

    // ---- 更新订单为已支付（等待管理员审核，不生成授权码） ----
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        payMethod,
      },
    });

    return NextResponse.json({
      message: '支付成功，等待管理员审核',
    });
  } catch (error) {
    console.error('[ORDER PAY ERROR]', error);
    return NextResponse.json(
      { error: '支付失败' },
      { status: 500 },
    );
  }
}
