import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// ============ 所有数据表配置 ============
interface TableConfig {
  name: string;           // Prisma 模型名
  displayName: string;   // 显示名
  canClean: boolean;      // 是否可清理
  cleanDescription?: string; // 清理说明
  timeField?: string;    // 时间字段（按时间清理）
}

const TABLES: TableConfig[] = [
  { name: 'user', displayName: '用户', canClean: false },
  { name: 'category', displayName: '论坛分类', canClean: false },
  { name: 'tool', displayName: '工具', canClean: false },
  { name: 'post', displayName: '帖子', canClean: true, cleanDescription: '清理已删除帖子（软删除标记）', timeField: 'deletedAt' },
  { name: 'comment', displayName: '评论', canClean: true, cleanDescription: '清理已删除评论（软删除标记）', timeField: 'deletedAt' },
  { name: 'like', displayName: '点赞/收藏', canClean: true, cleanDescription: '清理30天前的点赞记录', timeField: 'createdAt' },
  { name: 'notification', displayName: '通知', canClean: true, cleanDescription: '清理已读通知和30天前通知', timeField: 'createdAt' },
  { name: 'operationLog', displayName: '操作日志', canClean: true, cleanDescription: '清理90天前的操作日志', timeField: 'createdAt' },
  { name: 'systemSetting', displayName: '系统设置', canClean: false },
  { name: 'oAuthApp', displayName: 'OAuth应用', canClean: false },
  { name: 'oAuthAuthorizationCode', displayName: 'OAuth授权码', canClean: true, cleanDescription: '清理已过期/已使用的授权码', timeField: 'expiresAt' },
  { name: 'oAuthAccessToken', displayName: 'OAuth访问令牌', canClean: true, cleanDescription: '清理已过期的访问令牌', timeField: 'expiresAt' },
  { name: 'license', displayName: '授权码', canClean: false },
  { name: 'licenseDomain', displayName: '授权域名', canClean: false },
  { name: 'licenseLog', displayName: '授权验证日志', canClean: true, cleanDescription: '清理30天前的验证日志', timeField: 'createdAt' },
  { name: 'product', displayName: '产品', canClean: false },
  { name: 'productVersion', displayName: '产品版本', canClean: false },
  { name: 'order', displayName: '订单', canClean: false },
  { name: 'monitoringDaily', displayName: '监控统计(日)', canClean: true, cleanDescription: '清理90天前的每日监控数据', timeField: 'date' },
  { name: 'monitoringRoute', displayName: '监控统计(路由)', canClean: true, cleanDescription: '清理90天前的路由监控数据', timeField: 'date' },
];

// ============ GET /api/admin/database - 获取数据库概览 ============
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const detail = searchParams.get('detail'); // ?detail=tablename 查看单表详情

    // ---- 单表详情 ----
    if (detail) {
      return await getTableDetail(detail);
    }

    // ---- 全部表统计 ----
    const tableStats = await Promise.all(
      TABLES.map(async (table) => {
        let count = 0;
        try {
          // @ts-expect-error - 动态模型名
          count = await prisma[table.name].count();
        } catch {
          count = -1; // 表不存在或查询失败
        }
        const config = TABLES.find((t) => t.name === table.name)!;
        return {
          name: config.name,
          displayName: config.displayName,
          count,
          canClean: config.canClean,
          cleanDescription: config.cleanDescription,
        };
      })
    );

    // ---- 数据库大小（PostgreSQL） ----
    let dbSize = null;
    try {
      const sizeResult = await prisma.$queryRaw<Array<{ size: bigint }>>`
        SELECT pg_database_size(current_database()) as size
      `;
      dbSize = Number(sizeResult[0].size);
    } catch {
      // 忽略
    }

    // ---- 各表大小（PostgreSQL） ----
    let tableSizes: Array<{ tableName: string; sizeBytes: number; rowCount: number }> = [];
    try {
      const sizes = await prisma.$queryRaw<
        Array<{ relname: string; size: bigint; rowEstimate: bigint }>
      >`
        SELECT
          c.relname,
          pg_total_relation_size(c.oid) as size,
          c.reltuples::bigint as "rowEstimate"
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
        ORDER BY size DESC
      `;
      tableSizes = sizes.map((s) => ({
        tableName: s.relname,
        sizeBytes: Number(s.size),
        rowCount: Number(s.rowEstimate),
      }));
    } catch {
      // 忽略
    }

    // ---- 可清理数据预估 ----
    const cleanableEstimates = await getCleanableEstimates();

    // ---- 数据库连接信息 ----
    let dbInfo = { host: 'unknown', database: 'unknown', maxConnections: 0 };
    try {
      const settings = await prisma.$queryRaw<
        Array<{ name: string; setting: string }>
      >`
        SELECT name, setting FROM pg_settings
        WHERE name IN ('max_connections', 'shared_buffers')
      `;
      const maxConn = settings.find((s) => s.name === 'max_connections');
      if (maxConn) dbInfo.maxConnections = parseInt(maxConn.setting, 10);
    } catch {
      // 忽略
    }

    return NextResponse.json({
      tables: tableStats,
      dbSize,
      tableSizes,
      cleanableEstimates,
      dbInfo,
      totalTables: TABLES.length,
    });
  } catch (error) {
    console.error('[DATABASE STATS ERROR]', error);
    return NextResponse.json(
      { error: '获取数据库统计失败' },
      { status: 500 }
    );
  }
}

// ============ POST /api/admin/database - 清理数据 ============
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { action, tableName, days } = body as {
      action: 'clean' | 'vacuum' | 'reindex';
      tableName?: string;
      days?: number;
    };

    if (action === 'clean') {
      return await cleanTable(tableName, days || 30);
    }

    if (action === 'vacuum') {
      // VACUUM 不能在事务中运行，用 $executeRaw
      try {
        await prisma.$executeRaw`VACUUM ANALYZE`;
        return NextResponse.json({ message: 'VACUUM ANALYZE 执行成功' });
      } catch (error) {
        return NextResponse.json(
          { error: `VACUUM 失败: ${error instanceof Error ? error.message : '未知错误'}` },
          { status: 500 }
        );
      }
    }

    if (action === 'reindex') {
      try {
        if (tableName) {
          await prisma.$executeRaw`REINDEX TABLE ${Prisma.raw(tableName)}`;
          return NextResponse.json({ message: `表 ${tableName} 索引重建成功` });
        }
        await prisma.$executeRaw`REINDEX DATABASE ${Prisma.raw('CURRENT_DATABASE()')}`;
        return NextResponse.json({ message: '数据库索引重建成功' });
      } catch (error) {
        return NextResponse.json(
          { error: `REINDEX 失败: ${error instanceof Error ? error.message : '未知错误'}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('[DATABASE CLEAN ERROR]', error);
    return NextResponse.json(
      { error: '操作失败' },
      { status: 500 }
    );
  }
}

// ============ 获取单表详情 ============
async function getTableDetail(tableName: string) {
  const config = TABLES.find((t) => t.name === tableName);
  if (!config) {
    return NextResponse.json({ error: '表不存在' }, { status: 404 });
  }

  try {
    // @ts-expect-error - 动态模型名
    const total = await prisma[tableName].count();

    // 获取最近10条记录的创建时间
    let recentDates: string[] = [];
    if (config.timeField) {
      try {
        // @ts-expect-error - 动态模型名
        const recent = await prisma[tableName].findMany({
          take: 10,
          orderBy: { [config.timeField]: 'desc' },
          select: { [config.timeField]: true },
        });
        // @ts-expect-error - 动态访问
        recentDates = recent.map((r) => r[config.timeField]?.toISOString()).filter(Boolean);
      } catch {
        // 忽略
      }
    }

    // 各表特殊统计
    let extraStats: Record<string, number> = {};
    if (tableName === 'post') {
      const [published, draft, deleted] = await Promise.all([
        prisma.post.count({ where: { status: 'PUBLISHED' } }),
        prisma.post.count({ where: { status: 'DRAFT' } }),
        prisma.post.count({ where: { deletedAt: { not: null } } }),
      ]);
      extraStats = { published, draft, deleted };
    } else if (tableName === 'comment') {
      const [approved, pending, deleted] = await Promise.all([
        prisma.comment.count({ where: { isApproved: true, deletedAt: null } }),
        prisma.comment.count({ where: { isApproved: false, deletedAt: null } }),
        prisma.comment.count({ where: { deletedAt: { not: null } } }),
      ]);
      extraStats = { approved, pending, deleted };
    } else if (tableName === 'notification') {
      const [read, unread] = await Promise.all([
        prisma.notification.count({ where: { isRead: true } }),
        prisma.notification.count({ where: { isRead: false } }),
      ]);
      extraStats = { read, unread };
    } else if (tableName === 'license') {
      const [active, expired, suspended, revoked] = await Promise.all([
        prisma.license.count({ where: { status: 'active' } }),
        prisma.license.count({ where: { status: 'expired' } }),
        prisma.license.count({ where: { status: 'suspended' } }),
        prisma.license.count({ where: { status: 'revoked' } }),
      ]);
      extraStats = { active, expired, suspended, revoked };
    } else if (tableName === 'order') {
      const [pending, paid, refunded, cancelled] = await Promise.all([
        prisma.order.count({ where: { status: 'pending' } }),
        prisma.order.count({ where: { status: 'paid' } }),
        prisma.order.count({ where: { status: 'refunded' } }),
        prisma.order.count({ where: { status: 'cancelled' } }),
      ]);
      extraStats = { pending, paid, refunded, cancelled };
    }

    return NextResponse.json({
      tableName: config.name,
      displayName: config.displayName,
      total,
      canClean: config.canClean,
      cleanDescription: config.cleanDescription,
      timeField: config.timeField,
      recentDates,
      extraStats,
    });
  } catch (error) {
    console.error('[TABLE DETAIL ERROR]', error);
    return NextResponse.json(
      { error: '获取表详情失败' },
      { status: 500 }
    );
  }
}

// ============ 获取可清理数据预估 ============
async function getCleanableEstimates() {
  const now = new Date();
  const days30 = new Date(now.getTime() - 30 * 86400000);
  const days90 = new Date(now.getTime() - 90 * 86400000);
  const pastDate = new Date(now.getTime() - 86400000);

  const estimates: Array<{ table: string; label: string; count: number; description: string }> = [];

  try {
    // 已删除帖子
    const deletedPosts = await prisma.post.count({ where: { deletedAt: { not: null } } });
    if (deletedPosts > 0) estimates.push({ table: 'post', label: '已删除帖子', count: deletedPosts, description: '软删除标记的帖子' });

    // 已删除评论
    const deletedComments = await prisma.comment.count({ where: { deletedAt: { not: null } } });
    if (deletedComments > 0) estimates.push({ table: 'comment', label: '已删除评论', count: deletedComments, description: '软删除标记的评论' });

    // 30天前通知
    const oldNotifications = await prisma.notification.count({
      where: { createdAt: { lt: days30 } },
    });
    if (oldNotifications > 0) estimates.push({ table: 'notification', label: '旧通知', count: oldNotifications, description: '30天前的通知' });

    // 90天前操作日志
    const oldLogs = await prisma.operationLog.count({
      where: { createdAt: { lt: days90 } },
    });
    if (oldLogs > 0) estimates.push({ table: 'operationLog', label: '旧操作日志', count: oldLogs, description: '90天前的操作日志' });

    // 过期OAuth授权码
    const expiredCodes = await prisma.oAuthAuthorizationCode.count({
      where: { expiresAt: { lt: pastDate } },
    });
    if (expiredCodes > 0) estimates.push({ table: 'oAuthAuthorizationCode', label: '过期授权码', count: expiredCodes, description: '已过期的OAuth授权码' });

    // 过期OAuth令牌
    const expiredTokens = await prisma.oAuthAccessToken.count({
      where: { expiresAt: { lt: pastDate } },
    });
    if (expiredTokens > 0) estimates.push({ table: 'oAuthAccessToken', label: '过期令牌', count: expiredTokens, description: '已过期的访问令牌' });

    // 30天前授权日志
    const oldLicenseLogs = await prisma.licenseLog.count({
      where: { createdAt: { lt: days30 } },
    });
    if (oldLicenseLogs > 0) estimates.push({ table: 'licenseLog', label: '旧验证日志', count: oldLicenseLogs, description: '30天前的授权验证日志' });

    // 90天前监控数据
    const oldMonitoringDaily = await prisma.monitoringDaily.count({
      where: { date: { lt: days90 } },
    });
    if (oldMonitoringDaily > 0) estimates.push({ table: 'monitoringDaily', label: '旧监控(日)', count: oldMonitoringDaily, description: '90天前的每日监控数据' });

    const oldMonitoringRoute = await prisma.monitoringRoute.count({
      where: { date: { lt: days90 } },
    });
    if (oldMonitoringRoute > 0) estimates.push({ table: 'monitoringRoute', label: '旧监控(路由)', count: oldMonitoringRoute, description: '90天前的路由监控数据' });

    // 30天前点赞
    const oldLikes = await prisma.like.count({
      where: { createdAt: { lt: days30 } },
    });
    if (oldLikes > 0) estimates.push({ table: 'like', label: '旧点赞记录', count: oldLikes, description: '30天前的点赞记录' });
  } catch (error) {
    console.error('[CLEANABLE ESTIMATE ERROR]', error);
  }

  return estimates;
}

// ============ 清理表数据 ============
async function cleanTable(tableName: string | undefined, days: number) {
  if (!tableName) {
    return NextResponse.json({ error: '缺少表名' }, { status: 400 });
  }

  const config = TABLES.find((t) => t.name === tableName);
  if (!config || !config.canClean) {
    return NextResponse.json({ error: '该表不支持清理' }, { status: 400 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 86400000);
  let deletedCount = 0;

  try {
    switch (tableName) {
      case 'post':
        // 硬删除已软删除的帖子
        const deletedPosts = await prisma.post.deleteMany({
          where: { deletedAt: { not: null } },
        });
        deletedCount = deletedPosts.count;
        break;

      case 'comment':
        const deletedComments = await prisma.comment.deleteMany({
          where: { deletedAt: { not: null } },
        });
        deletedCount = deletedComments.count;
        break;

      case 'like':
        const oldLikes = await prisma.like.deleteMany({
          where: { createdAt: { lt: cutoff } },
        });
        deletedCount = oldLikes.count;
        break;

      case 'notification':
        const oldNotifs = await prisma.notification.deleteMany({
          where: {
            OR: [
              { isRead: true },
              { createdAt: { lt: cutoff } },
            ],
          },
        });
        deletedCount = oldNotifs.count;
        break;

      case 'operationLog':
        const oldLogs = await prisma.operationLog.deleteMany({
          where: { createdAt: { lt: cutoff } },
        });
        deletedCount = oldLogs.count;
        break;

      case 'oAuthAuthorizationCode':
        const expiredCodes = await prisma.oAuthAuthorizationCode.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: now } },
              { used: true },
            ],
          },
        });
        deletedCount = expiredCodes.count;
        break;

      case 'oAuthAccessToken':
        const expiredTokens = await prisma.oAuthAccessToken.deleteMany({
          where: { expiresAt: { lt: now } },
        });
        deletedCount = expiredTokens.count;
        break;

      case 'licenseLog':
        const oldLicenseLogs = await prisma.licenseLog.deleteMany({
          where: { createdAt: { lt: cutoff } },
        });
        deletedCount = oldLicenseLogs.count;
        break;

      case 'monitoringDaily':
        const oldDaily = await prisma.monitoringDaily.deleteMany({
          where: { date: { lt: cutoff } },
        });
        deletedCount = oldDaily.count;
        break;

      case 'monitoringRoute':
        const oldRoute = await prisma.monitoringRoute.deleteMany({
          where: { date: { lt: cutoff } },
        });
        deletedCount = oldRoute.count;
        break;

      default:
        return NextResponse.json({ error: '未实现的清理操作' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      table: config.displayName,
      deleted: deletedCount,
      message: `已清理 ${config.displayName} 中的 ${deletedCount} 条数据`,
    });
  } catch (error) {
    console.error('[CLEAN TABLE ERROR]', error);
    return NextResponse.json(
      { error: `清理失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
