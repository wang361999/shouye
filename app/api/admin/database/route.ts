import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

// ============ 所有数据表配置 ============
interface TableConfig {
  name: string;
  displayName: string;
  canClean: boolean;
  cleanDescription?: string;
  timeField?: string;
  cleanDays?: number; // 清理天数阈值，预估和实际清理一致使用此值
}

const TABLES: TableConfig[] = [
  { name: 'user', displayName: '用户', canClean: false },
  { name: 'category', displayName: '论坛分类', canClean: false },
  { name: 'tool', displayName: '工具', canClean: false },
  { name: 'post', displayName: '帖子', canClean: true, cleanDescription: '清理所有已软删除帖子', timeField: 'deletedAt', cleanDays: 0 },
  { name: 'comment', displayName: '评论', canClean: true, cleanDescription: '清理所有已软删除评论', timeField: 'deletedAt', cleanDays: 0 },
  { name: 'like', displayName: '点赞/收藏', canClean: true, cleanDescription: '清理30天前的点赞记录', timeField: 'createdAt', cleanDays: 30 },
  { name: 'notification', displayName: '通知', canClean: true, cleanDescription: '清理已读通知和30天前通知', timeField: 'createdAt', cleanDays: 30 },
  { name: 'operationLog', displayName: '操作日志', canClean: true, cleanDescription: '清理90天前的操作日志', timeField: 'createdAt', cleanDays: 90 },
  { name: 'systemSetting', displayName: '系统设置', canClean: false },
  { name: 'oAuthApp', displayName: 'OAuth应用', canClean: false },
  { name: 'oAuthAuthorizationCode', displayName: 'OAuth授权码', canClean: true, cleanDescription: '清理已过期/已使用的授权码', timeField: 'expiresAt', cleanDays: 0 },
  { name: 'oAuthAccessToken', displayName: 'OAuth访问令牌', canClean: true, cleanDescription: '清理已过期的访问令牌', timeField: 'expiresAt', cleanDays: 0 },
  { name: 'license', displayName: '授权码', canClean: false },
  { name: 'licenseDomain', displayName: '授权域名', canClean: false },
  { name: 'licenseLog', displayName: '授权验证日志', canClean: true, cleanDescription: '清理30天前的验证日志', timeField: 'createdAt', cleanDays: 30 },
  { name: 'product', displayName: '产品', canClean: false },
  { name: 'productVersion', displayName: '产品版本', canClean: false },
  { name: 'order', displayName: '订单', canClean: false },
  { name: 'monitoringDaily', displayName: '监控统计(日)', canClean: true, cleanDescription: '清理90天前的每日监控数据', timeField: 'date', cleanDays: 90 },
  { name: 'monitoringRoute', displayName: '监控统计(路由)', canClean: true, cleanDescription: '清理90天前的路由监控数据', timeField: 'date', cleanDays: 90 },
];

// ============ GET /api/admin/database - 获取数据库概览 ============
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const detail = searchParams.get('detail');

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
          count = -1;
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

    // ---- 数据库大小（LibSQL/SQLite）----
    let dbSize: number | null = null;
    let dbSizeDetail: { dataBytes: number; indexBytes: number; totalBytes: number } | null = null;
    try {
      const pageResult = await prisma.$queryRaw<Array<{ page_size: number; page_count: number }>>`
        SELECT 
          (SELECT page_size FROM pragma_page_size()) as page_size,
          (SELECT page_count FROM pragma_page_count()) as page_count
      `;
      if (pageResult.length > 0) {
        const p = pageResult[0];
        const totalBytes = Number(p.page_size) * Number(p.page_count);
        dbSize = totalBytes;
        dbSizeDetail = {
          dataBytes: totalBytes,
          indexBytes: 0,
          totalBytes,
        };
      }
    } catch {
      // PRAGMA 可能在某些 Turso 版本不可用
    }

    // ---- 各表大小估算（基于行数和页面大小）----
    let tableSizes: Array<{ tableName: string; sizeBytes: number; rowCount: number }> = [];
    const pageSize = dbSizeDetail ? dbSizeDetail.totalBytes : 4096; // 默认 4KB
    const totalPages = dbSizeDetail ? Math.max(1, Math.floor(dbSizeDetail.totalBytes / pageSize)) : 0;

    try {
      // 获取所有表的行数，按比例估算大小
      const counts = await Promise.all(
        TABLES.map(async (t) => {
          let rowCount = 0;
          try {
            // @ts-expect-error - 动态模型名
            rowCount = await prisma[t.name].count();
          } catch {
            rowCount = 0;
          }
          return { name: t.name, displayName: t.displayName, rowCount };
        })
      );

      const totalRows = counts.reduce((sum, c) => sum + c.rowCount, 0) || 1;

      tableSizes = counts
        .map((c) => ({
          tableName: c.displayName,
          sizeBytes: totalRows > 0 ? Math.round((c.rowCount / totalRows) * (dbSize || 0)) : 0,
          rowCount: c.rowCount,
        }))
        .filter((t) => t.rowCount > 0)
        .sort((a, b) => b.sizeBytes - a.sizeBytes);

      // 如果无法获取 dbSize，使用行数*估算每行大小
      if (!dbSize) {
        tableSizes = counts
          .filter((c) => c.rowCount > 0)
          .map((c) => ({
            tableName: c.displayName,
            sizeBytes: c.rowCount * 512, // 粗略估算每行 512 字节
            rowCount: c.rowCount,
          }))
          .sort((a, b) => b.sizeBytes - a.sizeBytes);
      }
    } catch {
      // 忽略
    }

    // ---- 可清理数据预估 ----
    const cleanableEstimates = await getCleanableEstimates();

    // ---- 数据库连接信息 ----
    const dbInfo = {
      host: process.env.DATABASE_URL?.split('@')?.pop()?.split('/')?.[0] || 'turso',
      database: process.env.DATABASE_URL?.split('/')?.pop()?.split('?')?.[0] || 'unknown',
      maxConnections: 0,
    };

    return NextResponse.json({
      tables: tableStats,
      dbSize,
      dbSizeDetail,
      dbLimitBytes: 9 * 1024 * 1024 * 1024, // Turso 免费版 9GB
      tableSizes,
      cleanableEstimates,
      dbInfo,
      totalTables: TABLES.length,
      dbEngine: 'libsql',
    });
  } catch (error) {
    console.error('[DATABASE STATS ERROR]', error);
    return NextResponse.json(
      { error: '获取数据库统计失败' },
      { status: 500 }
    );
  }
}

// ============ POST /api/admin/database - 清理/维护 ============
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { action, tableName } = body as {
      action: 'clean' | 'vacuum' | 'reindex';
      tableName?: string;
      days?: number;
    };

    if (action === 'clean') {
      return await cleanTable(tableName);
    }

    if (action === 'vacuum') {
      try {
        await prisma.$executeRaw`VACUUM`;
        return NextResponse.json({ message: 'VACUUM 执行成功，数据库已优化' });
      } catch (error) {
        const msg = error instanceof Error ? error.message : '未知错误';
        if (msg.includes('not supported') || msg.includes('syntax error')) {
          return NextResponse.json(
            { error: 'Turso/LibSQL HTTP 模式不支持 VACUUM 操作，数据清理功能仍可正常使用' },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { error: `VACUUM 失败: ${msg}` },
          { status: 500 }
        );
      }
    }

    if (action === 'reindex') {
      try {
        if (tableName) {
          // 白名单校验
          const config = TABLES.find((t) => t.name === tableName);
          if (!config) {
            return NextResponse.json({ error: '无效的表名' }, { status: 400 });
          }
          await prisma.$executeRawUnsafe(`REINDEX "${tableName}"`);
          return NextResponse.json({ message: `表 ${tableName} 索引重建成功` });
        }
        await prisma.$executeRaw`REINDEX`;
        return NextResponse.json({ message: '数据库索引重建成功' });
      } catch (error) {
        const msg = error instanceof Error ? error.message : '未知错误';
        if (msg.includes('not supported') || msg.includes('syntax error')) {
          return NextResponse.json(
            { error: 'Turso/LibSQL HTTP 模式不支持 REINDEX 操作' },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { error: `REINDEX 失败: ${msg}` },
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

// ============ 获取可清理数据预估（使用与实际清理一致的天数）============
async function getCleanableEstimates() {
  const now = new Date();

  const estimates: Array<{ table: string; label: string; count: number; description: string }> = [];

  try {
    // post/comment - 清理所有软删除记录
    const deletedPosts = await prisma.post.count({ where: { deletedAt: { not: null } } });
    if (deletedPosts > 0) estimates.push({ table: 'post', label: '已删除帖子', count: deletedPosts, description: '软删除标记的帖子（全部清理）' });

    const deletedComments = await prisma.comment.count({ where: { deletedAt: { not: null } } });
    if (deletedComments > 0) estimates.push({ table: 'comment', label: '已删除评论', count: deletedComments, description: '软删除标记的评论（全部清理）' });

    // notification - 30天前
    const notifCutoff = new Date(now.getTime() - 30 * 86400000);
    const oldNotifications = await prisma.notification.count({ where: { OR: [{ isRead: true }, { createdAt: { lt: notifCutoff } }] } });
    if (oldNotifications > 0) estimates.push({ table: 'notification', label: '可清理通知', count: oldNotifications, description: '已读通知 + 30天前的通知' });

    // operationLog - 90天前
    const logCutoff = new Date(now.getTime() - 90 * 86400000);
    const oldLogs = await prisma.operationLog.count({ where: { createdAt: { lt: logCutoff } } });
    if (oldLogs > 0) estimates.push({ table: 'operationLog', label: '旧操作日志', count: oldLogs, description: '90天前的操作日志' });

    // oAuthAuthorizationCode - 过期或已使用
    const expiredCodes = await prisma.oAuthAuthorizationCode.count({ where: { OR: [{ expiresAt: { lt: now } }, { used: true }] } });
    if (expiredCodes > 0) estimates.push({ table: 'oAuthAuthorizationCode', label: '过期授权码', count: expiredCodes, description: '已过期或已使用的OAuth授权码' });

    // oAuthAccessToken - 过期
    const expiredTokens = await prisma.oAuthAccessToken.count({ where: { expiresAt: { lt: now } } });
    if (expiredTokens > 0) estimates.push({ table: 'oAuthAccessToken', label: '过期令牌', count: expiredTokens, description: '已过期的访问令牌' });

    // licenseLog - 30天前
    const licenseCutoff = new Date(now.getTime() - 30 * 86400000);
    const oldLicenseLogs = await prisma.licenseLog.count({ where: { createdAt: { lt: licenseCutoff } } });
    if (oldLicenseLogs > 0) estimates.push({ table: 'licenseLog', label: '旧验证日志', count: oldLicenseLogs, description: '30天前的授权验证日志' });

    // monitoringDaily - 90天前
    const monCutoff = new Date(now.getTime() - 90 * 86400000);
    const oldMonitoringDaily = await prisma.monitoringDaily.count({ where: { date: { lt: monCutoff } } });
    if (oldMonitoringDaily > 0) estimates.push({ table: 'monitoringDaily', label: '旧监控(日)', count: oldMonitoringDaily, description: '90天前的每日监控数据' });

    const oldMonitoringRoute = await prisma.monitoringRoute.count({ where: { date: { lt: monCutoff } } });
    if (oldMonitoringRoute > 0) estimates.push({ table: 'monitoringRoute', label: '旧监控(路由)', count: oldMonitoringRoute, description: '90天前的路由监控数据' });

    // like - 30天前
    const likeCutoff = new Date(now.getTime() - 30 * 86400000);
    const oldLikes = await prisma.like.count({ where: { createdAt: { lt: likeCutoff } } });
    if (oldLikes > 0) estimates.push({ table: 'like', label: '旧点赞记录', count: oldLikes, description: '30天前的点赞记录' });
  } catch (error) {
    console.error('[CLEANABLE ESTIMATE ERROR]', error);
  }

  return estimates;
}

// ============ 清理表数据（使用 config 中定义的 cleanDays）============
async function cleanTable(tableName: string | undefined) {
  if (!tableName) {
    return NextResponse.json({ error: '缺少表名' }, { status: 400 });
  }

  const config = TABLES.find((t) => t.name === tableName);
  if (!config || !config.canClean) {
    return NextResponse.json({ error: '该表不支持清理' }, { status: 400 });
  }

  const now = new Date();
  const days = config.cleanDays || 0;
  const cutoff = days > 0 ? new Date(now.getTime() - days * 86400000) : now;
  let deletedCount = 0;

  try {
    switch (tableName) {
      case 'post': {
        const r = await prisma.post.deleteMany({ where: { deletedAt: { not: null } } });
        deletedCount = r.count;
        break;
      }
      case 'comment': {
        const r = await prisma.comment.deleteMany({ where: { deletedAt: { not: null } } });
        deletedCount = r.count;
        break;
      }
      case 'like': {
        const r = await prisma.like.deleteMany({ where: { createdAt: { lt: cutoff } } });
        deletedCount = r.count;
        break;
      }
      case 'notification': {
        const r = await prisma.notification.deleteMany({
          where: { OR: [{ isRead: true }, { createdAt: { lt: cutoff } }] },
        });
        deletedCount = r.count;
        break;
      }
      case 'operationLog': {
        const r = await prisma.operationLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
        deletedCount = r.count;
        break;
      }
      case 'oAuthAuthorizationCode': {
        const r = await prisma.oAuthAuthorizationCode.deleteMany({
          where: { OR: [{ expiresAt: { lt: now } }, { used: true }] },
        });
        deletedCount = r.count;
        break;
      }
      case 'oAuthAccessToken': {
        const r = await prisma.oAuthAccessToken.deleteMany({ where: { expiresAt: { lt: now } } });
        deletedCount = r.count;
        break;
      }
      case 'licenseLog': {
        const r = await prisma.licenseLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
        deletedCount = r.count;
        break;
      }
      case 'monitoringDaily': {
        const r = await prisma.monitoringDaily.deleteMany({ where: { date: { lt: cutoff } } });
        deletedCount = r.count;
        break;
      }
      case 'monitoringRoute': {
        const r = await prisma.monitoringRoute.deleteMany({ where: { date: { lt: cutoff } } });
        deletedCount = r.count;
        break;
      }
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
