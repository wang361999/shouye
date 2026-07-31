import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

/**
 * 生成授权码格式: ET-XXXXXXXX-XXXXXXXX-XXXXXXXX
 */
function generateLicenseKey(): string {
  const part = () => crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ET-${part()}-${part()}-${part()}`;
}

/**
 * POST /api/user/orders/[id]/pay - 模拟支付（演示/手动，需登录）
 * Body: { payMethod }
 * 校验订单归属当前用户且状态为 pending，置为 paid 并生成授权码
 * 返回：{ message, licenseKey }
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

    // ---- 生成唯一授权码 ----
    let licenseKey = generateLicenseKey();
    let existing = await prisma.license.findUnique({
      where: { licenseKey },
    });
    while (existing) {
      licenseKey = generateLicenseKey();
      existing = await prisma.license.findUnique({
        where: { licenseKey },
      });
    }

    // ---- 计算授权过期时间 ----
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + order.validDays);

    // ---- 事务：更新订单 + 生成授权码 ----
    const result = await prisma.$transaction(async (tx) => {
      // 1. 生成授权码
      const license = await tx.license.create({
        data: {
          licenseKey,
          projectName: order.productName,
          projectType: order.projectType,
          maxDomains: order.maxDomains,
          expiresAt,
          status: 'active',
          ownerId: userPayload.userId,
          productId: order.productId,
          orderId: order.id,
        },
      });

      // 2. 更新订单为已支付
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          payMethod,
          licenseId: license.id,
        },
      });

      return { license, updatedOrder };
    });

    return NextResponse.json({
      message: '支付成功，授权码已生成',
      licenseKey: result.license.licenseKey,
    });
  } catch (error) {
    console.error('[ORDER PAY ERROR]', error);
    return NextResponse.json(
      { error: '支付失败' },
      { status: 500 },
    );
  }
}
