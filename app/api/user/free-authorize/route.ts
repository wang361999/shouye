import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

/** 生成 4 位随机数字字符串 */
function random4Digits(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * POST /api/user/free-authorize - 免费授权申请（需登录）
 * Body: { productId }
 *
 * 流程：
 * 1. 校验产品存在且为 active
 * 2. 检查用户是否已有该产品的授权请求/订单（pending / approved）
 * 3. 创建 amount=0 的免费订单，状态为 pending（等待管理员审核）
 * 4. 返回订单信息与审核状态
 */
export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json({ error: '缺少产品 ID' }, { status: 400 });
    }

    // ---- 查询产品 ----
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.status !== 'active') {
      return NextResponse.json(
        { error: '产品不存在或已下架' },
        { status: 404 },
      );
    }

    // ---- 检查是否已有该产品的有效订单（非取消/拒绝/退款） ----
    const existingOrder = await prisma.order.findFirst({
      where: {
        userId: userPayload.userId,
        productId: product.id,
        status: { in: ['pending', 'paid', 'approved'] },
      },
      include: {
        license: { select: { id: true, licenseKey: true, expiresAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingOrder) {
      // 已有订单，直接返回当前状态
      return NextResponse.json({
        id: existingOrder.id,
        orderNo: existingOrder.orderNo,
        status: existingOrder.status,
        amount: existingOrder.amount,
        license: existingOrder.license
          ? {
              licenseKey: existingOrder.license.licenseKey,
              expiresAt: existingOrder.license.expiresAt,
            }
          : null,
        message:
          existingOrder.status === 'approved'
            ? '您已获得该产品的免费授权'
            : existingOrder.status === 'pending'
              ? '您的免费授权申请正在审核中'
              : '您的免费授权申请已提交',
        alreadyExists: true,
      });
    }

    // ---- 创建免费订单（amount=0, status=pending） ----
    const orderNo = `FREE${Date.now()}${random4Digits()}`;

    const order = await prisma.order.create({
      data: {
        orderNo,
        userId: userPayload.userId,
        productId: product.id,
        productName: product.name,
        projectType: 'standard',
        maxDomains: 1,
        amount: 0,
        validDays: product.validDays,
        status: 'pending',
        remark: '免费开源授权申请',
      },
    });

    // ---- 记录操作日志 ----
    await prisma.operationLog.create({
      data: {
        userId: userPayload.userId,
        username: userPayload.username || 'unknown',
        action: 'free_authorize_request',
        target: 'Order',
        detail: `用户申请免费授权: ${product.name} (${order.orderNo})`,
      },
    });

    return NextResponse.json(
      {
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        amount: order.amount,
        license: null,
        message: '免费授权申请已提交，等待管理员审核',
        alreadyExists: false,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[FREE AUTHORIZE ERROR]', error);
    return NextResponse.json(
      { error: '免费授权申请失败，请稍后重试' },
      { status: 500 },
    );
  }
}
