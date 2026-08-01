import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

// ============ 所有数据表配置（含导出顺序） ============
const BACKUP_TABLES = [
  'user',
  'category',
  'tool',
  'systemSetting',
  'oAuthApp',
  'product',
  'monitoringDaily',
  'monitoringRoute',
  'post',
  'productVersion',
  'license',
  'order',
  'comment',
  'like',
  'notification',
  'operationLog',
  'oAuthAuthorizationCode',
  'oAuthAccessToken',
  'licenseDomain',
  'licenseLog',
] as const;

// 表显示名
const TABLE_LABELS: Record<string, string> = {
  user: '用户',
  category: '论坛分类',
  tool: '工具',
  systemSetting: '系统设置',
  oAuthApp: 'OAuth应用',
  product: '产品',
  monitoringDaily: '监控统计(日)',
  monitoringRoute: '监控统计(路由)',
  post: '帖子',
  productVersion: '产品版本',
  license: '授权码',
  order: '订单',
  comment: '评论',
  like: '点赞/收藏',
  notification: '通知',
  operationLog: '操作日志',
  oAuthAuthorizationCode: 'OAuth授权码',
  oAuthAccessToken: 'OAuth访问令牌',
  licenseDomain: '授权域名',
  licenseLog: '授权验证日志',
};

// ============ JSON 序列化（处理 BigInt 和 Date） ============
function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return { $bigint: value.toString() };
  }
  if (value instanceof Date) {
    return { $date: value.toISOString() };
  }
  return value;
}

// ============ GET /api/admin/database/backup - 导出备份 ============
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    // ?tables=user,category 可选择性导出
    const tablesParam = searchParams.get('tables');
    const tablesToExport = tablesParam
      ? tablesParam.split(',').filter((t) => BACKUP_TABLES.includes(t as any))
      : [...BACKUP_TABLES];

    // ---- 导出每张表数据 ----
    const exportData: Record<string, unknown[]> = {};
    const tableCounts: Record<string, number> = {};

    for (const tableName of tablesToExport) {
      try {
        // @ts-expect-error - 动态模型名
        const records = await prisma[tableName].findMany();
        exportData[tableName] = records;
        tableCounts[tableName] = records.length;
      } catch (err) {
        console.error(`[BACKUP] 导出 ${tableName} 失败:`, err);
        exportData[tableName] = [];
        tableCounts[tableName] = -1;
      }
    }

    // ---- 构建备份 JSON ----
    const backup = {
      meta: {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        exportedBy: admin.username,
        database: process.env.DATABASE_URL?.split('@')?.pop()?.split('/')?.[1] || 'unknown',
        tables: tablesToExport,
        tableLabels: TABLE_LABELS,
        totalRecords: Object.values(tableCounts).reduce((a, b) => a + (b > 0 ? b : 0), 0),
        tableCounts,
      },
      data: exportData,
    };

    const jsonStr = JSON.stringify(backup, jsonReplacer, 2);
    const fileSize = Buffer.byteLength(jsonStr, 'utf-8');

    // ---- 返回为可下载文件 ----
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `db-backup-${timestamp}.json`;

    return new NextResponse(jsonStr, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileSize),
      },
    });
  } catch (error) {
    console.error('[BACKUP ERROR]', error);
    return NextResponse.json(
      { error: `备份失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 },
    );
  }
}
