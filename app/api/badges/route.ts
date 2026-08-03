import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

// ============ GET /api/badges - 获取所有徽章定义列表 ============
export async function GET(request: NextRequest) {
  try {
    // 该接口为公开接口，任何人都可以查看徽章定义
    // 但管理员可以看到更详细的信息（如 condition）
    const admin = adminAuth(request);
    const isAdmin = !!admin && !(admin instanceof Response);

    const badges = await prisma.badge.findMany({
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        type: true,
        createdAt: true,
        // condition 仅管理员可见（包含触发逻辑，不应对普通用户暴露）
        ...(isAdmin ? { condition: true } : {}),
      },
    });

    // 统计每个徽章的获得人数
    const badgeCounts = await prisma.userBadge.groupBy({
      by: ['badgeId'],
      _count: { _all: true },
    });

    const countMap = new Map<string, number>();
    for (const item of badgeCounts) {
      countMap.set(item.badgeId, item._count._all);
    }

    const result = badges.map((b) => ({
      ...b,
      awardedCount: countMap.get(b.id) || 0,
    }));

    return NextResponse.json({ badges: result });
  } catch (error) {
    console.error('[BADGES LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取徽章列表失败' },
      { status: 500 },
    );
  }
}

// ============ POST /api/badges - 创建新徽章（管理员专用） ============
export async function POST(request: NextRequest) {
  try {
    // 管理员鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { name, description, icon, type, condition } = body;

    // ---- 输入校验 ----
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: '徽章名称不能为空' },
        { status: 400 },
      );
    }

    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json(
        { error: '徽章描述不能为空' },
        { status: 400 },
      );
    }

    if (!icon || typeof icon !== 'string' || !icon.trim()) {
      return NextResponse.json(
        { error: '徽章图标不能为空' },
        { status: 400 },
      );
    }

    // 校验类型
    const badgeType = type === 'auto' ? 'auto' : 'manual';

    // 自动徽章需要 condition 字段
    let conditionStr: string | null = null;
    if (badgeType === 'auto') {
      if (!condition || typeof condition !== 'object') {
        return NextResponse.json(
          { error: '自动徽章必须提供 condition 条件' },
          { status: 400 },
        );
      }

      const { field, operator, value } = condition;
      const validFields = ['postCount', 'commentCount', 'reputation'];
      const validOperators = ['>=', '>', '<=', '<', '=='];

      if (!validFields.includes(field)) {
        return NextResponse.json(
          { error: `condition.field 必须是 ${validFields.join(', ')} 之一` },
          { status: 400 },
        );
      }

      if (!validOperators.includes(operator)) {
        return NextResponse.json(
          { error: `condition.operator 必须是 ${validOperators.join(', ')} 之一` },
          { status: 400 },
        );
      }

      if (typeof value !== 'number' || value < 0) {
        return NextResponse.json(
          { error: 'condition.value 必须为非负数字' },
          { status: 400 },
        );
      }

      conditionStr = JSON.stringify({ field, operator, value });
    }

    // 检查徽章名称唯一性
    const existing = await prisma.badge.findUnique({
      where: { name: name.trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: '徽章名称已存在' },
        { status: 400 },
      );
    }

    // ---- 创建徽章 ----
    const badge = await prisma.badge.create({
      data: {
        name: name.trim(),
        description: description.trim(),
        icon: icon.trim(),
        type: badgeType,
        condition: conditionStr,
      },
    });

    return NextResponse.json(badge, { status: 201 });
  } catch (error) {
    console.error('[BADGE CREATE ERROR]', error);
    return NextResponse.json(
      { error: '创建徽章失败' },
      { status: 500 },
    );
  }
}
