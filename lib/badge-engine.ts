/**
 * 徽章引擎 - 自动颁发徽章的核心逻辑
 *
 * 功能：
 *   1. 查询用户数据（postCount, commentCount, reputation）
 *   2. 检查所有 type='auto' 的徽章定义
 *   3. 当用户满足 condition 条件且尚未获得该徽章时，创建 UserBadge 记录
 *
 * condition JSON 格式：
 *   { "field": "postCount|commentCount|reputation", "operator": ">=", "value": number }
 *
 * 使用场景：
 *   - 发帖/评论后调用，检查是否解锁新徽章
 *   - 声望变更后调用
 *   - 定时任务批量检查
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 徽章条件类型 */
interface BadgeCondition {
  field: 'postCount' | 'commentCount' | 'reputation';
  operator: '>=' | '>' | '<=' | '<' | '==';
  value: number;
}

/** 用户统计数据（用于条件判断） */
interface UserStats {
  postCount: number;
  commentCount: number;
  reputation: number;
}

/**
 * 评估单个条件是否满足
 *
 * @param stats 用户统计数据
 * @param condition 徽章条件
 * @returns 是否满足条件
 */
function evaluateCondition(stats: UserStats, condition: BadgeCondition): boolean {
  const fieldValue = stats[condition.field];
  if (fieldValue === undefined || fieldValue === null) return false;

  const target = condition.value;

  switch (condition.operator) {
    case '>=':
      return fieldValue >= target;
    case '>':
      return fieldValue > target;
    case '<=':
      return fieldValue <= target;
    case '<':
      return fieldValue < target;
    case '==':
      return fieldValue === target;
    default:
      return false;
  }
}

/**
 * 安全解析 condition JSON 字符串
 *
 * @param conditionStr condition JSON 字符串
 * @returns 解析后的条件对象，解析失败返回 null
 */
function parseCondition(conditionStr: string | null): BadgeCondition | null {
  if (!conditionStr) return null;

  try {
    const parsed = JSON.parse(conditionStr);
    if (
      !parsed ||
      typeof parsed.field !== 'string' ||
      typeof parsed.operator !== 'string' ||
      typeof parsed.value !== 'number'
    ) {
      return null;
    }

    const validFields = ['postCount', 'commentCount', 'reputation'];
    const validOperators = ['>=', '>', '<=', '<', '=='];

    if (!validFields.includes(parsed.field)) return null;
    if (!validOperators.includes(parsed.operator)) return null;

    return parsed as BadgeCondition;
  } catch {
    return null;
  }
}

/**
 * 检查并自动颁发徽章
 *
 * 查询用户数据，检查所有 type='auto' 的徽章，
 * 满足条件且用户尚未获得该徽章时，创建 UserBadge 记录。
 *
 * @param userId 用户 ID
 * @param prisma Prisma 客户端实例（可选，默认使用全局实例）
 * @returns 新颁发的徽章列表（包含 badge 详情）
 */
export async function checkAndAwardBadges(
  userId: string,
  prismaClient?: any,
): Promise<Array<{
  id: string;
  userId: string;
  badgeId: string;
  awardedAt: Date;
  badge: {
    id: string;
    name: string;
    description: string;
    icon: string;
    type: string;
  };
}>> {
  // 使用传入的 prisma 客户端，或惰性导入默认实例
  // 注意：此处不能在顶层 import prisma，因为 lib 模块可能在构建阶段被加载
  let prisma: any;
  if (prismaClient) {
    prisma = prismaClient;
  } else {
    const prismaModule = await import('@/lib/prisma');
    prisma = prismaModule.default;
  }

  try {
    // ---- 1. 查询用户统计数据 ----
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        postCount: true,
        commentCount: true,
        reputation: true,
      },
    });

    if (!user) {
      console.warn(`[BADGE ENGINE] 用户不存在: ${userId}`);
      return [];
    }

    const stats: UserStats = {
      postCount: user.postCount ?? 0,
      commentCount: user.commentCount ?? 0,
      reputation: user.reputation ?? 0,
    };

    // ---- 2. 查询所有自动徽章 ----
    const autoBadges = await prisma.badge.findMany({
      where: { type: 'auto' },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        type: true,
        condition: true,
      },
    });

    if (autoBadges.length === 0) {
      return [];
    }

    // ---- 3. 查询用户已获得的徽章 ID 集合 ----
    const existingUserBadges = await prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true },
    });
    const existingBadgeIds = new Set(existingUserBadges.map((ub: any) => ub.badgeId));

    // ---- 4. 评估每个徽章条件，收集需要颁发的徽章 ----
    const toAward: Array<{ badge: any }> = [];

    for (const badge of autoBadges) {
      // 已获得则跳过
      if (existingBadgeIds.has(badge.id)) continue;

      // 解析条件
      const condition = parseCondition(badge.condition);
      if (!condition) {
        console.warn(`[BADGE ENGINE] 徽章 "${badge.name}" 的 condition 解析失败: ${badge.condition}`);
        continue;
      }

      // 评估条件
      if (evaluateCondition(stats, condition)) {
        toAward.push({ badge });
      }
    }

    if (toAward.length === 0) {
      return [];
    }

    // ---- 5. 批量创建 UserBadge 记录 ----
    // 使用事务确保原子性；逐条创建以处理可能的唯一约束冲突
    const awarded: Array<any> = [];

    for (const { badge } of toAward) {
      try {
        const userBadge = await prisma.userBadge.create({
          data: {
            userId,
            badgeId: badge.id,
          },
          include: {
            badge: {
              select: {
                id: true,
                name: true,
                description: true,
                icon: true,
                type: true,
              },
            },
          },
        });
        awarded.push(userBadge);
      } catch (err) {
        // 唯一约束冲突（并发场景下可能已颁发），跳过
        console.warn(
          `[BADGE ENGINE] 颁发徽章 "${badge.name}" 给用户 ${userId} 失败:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (awarded.length > 0) {
      const badgeNames = awarded.map((ub) => ub.badge.icon + ' ' + ub.badge.name).join(', ');
      console.log(`[BADGE ENGINE] 用户 ${userId} 新获得徽章: ${badgeNames}`);
    }

    return awarded;
  } catch (error) {
    console.error('[BADGE ENGINE ERROR]', error);
    // 徽章引擎失败不应影响主业务流程，返回空数组
    return [];
  }
}

export { evaluateCondition, parseCondition };
export type { BadgeCondition, UserStats };
