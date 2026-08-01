import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

/**
 * 套餐类型 → 价格字段映射
 */
const PRICE_FIELD_MAP: Record<string, keyof ProductPriceFields> = {
  basic: 'priceBasic',
  standard: 'priceStandard',
  premium: 'pricePremium',
  enterprise: 'priceEnterprise',
};

interface ProductPriceFields {
  priceBasic: number;
  priceStandard: number;
  pricePremium: number;
  priceEnterprise: number;
}

/**
 * 套餐类型 → 最大域名数映射
 */
const MAX_DOMAINS_MAP: Record<string, number> = {
  basic: 1,
  standard: 2,
  premium: 5,
  enterprise: 10,
};

/** 生成 4 位随机数字字符串 */
function random4Digits(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * POST /api/user/orders/create - 创建订单（需登录）
 * Body: { productId, projectType }
 * 返回：{ id, orderNo, amount, status }
 */
export async function POST(request: NextRequest) {
  try {
    // ---- 登录鉴权 ----
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { productId, projectType } = body;

    // ---- 参数校验 ----
    if (!productId) {
      return NextResponse.json(
        { error: '缺少产品 ID' },
        { status: 400 },
      );
    }

    const resolvedProjectType = projectType || 'standard';
    if (!PRICE_FIELD_MAP[resolvedProjectType]) {
      return NextResponse.json(
        { error: '套餐类型无效' },
        { status: 400 },
      );
    }

    // ---- 查询产品并校验状态 ----
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json(
        { error: '产品不存在' },
        { status: 404 },
      );
    }

    if (product.status !== 'active') {
      return NextResponse.json(
        { error: '该产品已下架，无法购买' },
        { status: 400 },
      );
    }

    // ---- 根据套餐类型获取价格与域名配额 ----
    const priceField = PRICE_FIELD_MAP[resolvedProjectType];
    const amount = product[priceField];
    const maxDomains = MAX_DOMAINS_MAP[resolvedProjectType];
    const validDays = product.validDays;

    if (amount <= 0) {
      return NextResponse.json(
        { error: '该套餐价格异常，请联系管理员' },
        { status: 400 },
      );
    }

    // ---- 生成订单号：ORD + 时间戳 + 4位随机数 ----
    const orderNo = `ORD${Date.now()}${random4Digits()}`;

    // ---- 创建订单（状态为 pending） ----
    const order = await prisma.order.create({
      data: {
        orderNo,
        userId: userPayload.userId,
        productId: product.id,
        productName: product.name,
        projectType: resolvedProjectType,
        maxDomains,
        amount,
        validDays,
        status: 'pending',
      },
    });

    return NextResponse.json(
      {
        id: order.id,
        orderNo: order.orderNo,
        amount: order.amount,
        status: order.status,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[ORDER CREATE ERROR]', error);
    return NextResponse.json(
      { error: '创建订单失败' },
      { status: 500 },
    );
  }
}
