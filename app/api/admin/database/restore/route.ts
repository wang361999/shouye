import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// ============ 删除顺序（子表在前，避免外键约束冲突） ============
const DELETE_ORDER = [
  'licenseLog',
  'licenseDomain',
  'oAuthAccessToken',
  'oAuthAuthorizationCode',
  'operationLog',
  'notification',
  'like',
  'comment',
  'order',
  'license',
  'productVersion',
  'post',
  'monitoringRoute',
  'monitoringDaily',
  'product',
  'oAuthApp',
  'systemSetting',
  'tool',
  'category',
  'user',
] as const;

// ============ 插入顺序（父表在前） ============
const INSERT_ORDER = [
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

// BigInt 字段映射
const BIGINT_FIELDS: Record<string, string[]> = {
  monitoringDaily: ['dataTransferBytes'],
  monitoringRoute: ['totalDataBytes'],
};

// ============ JSON 反序列化（还原 BigInt 和 Date） ============
function jsonReviver(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('$bigint' in obj) {
      return BigInt(obj.$bigint as string);
    }
    if ('$date' in obj) {
      return new Date(obj.$date as string);
    }
  }
  return value;
}

// ============ POST /api/admin/database/restore - 导入恢复 ============
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { backupData, mode } = body as {
      backupData: { meta?: unknown; data?: Record<string, unknown[]> };
      mode: 'replace' | 'merge';
    };

    if (!backupData || !backupData.data) {
      return NextResponse.json(
        { error: '无效的备份文件格式：缺少 data 字段' },
        { status: 400 },
      );
    }

    // 反序列化 BigInt/Date
    const data = JSON.parse(JSON.stringify(backupData.data), jsonReviver) as Record<
      string,
      Record<string, unknown>[]
    >;

    // 验证备份文件
    const tableNames = Object.keys(data).filter((t) =>
      INSERT_ORDER.includes(t as (typeof INSERT_ORDER)[number]),
    );

    if (tableNames.length === 0) {
      return NextResponse.json(
        { error: '备份文件中没有可恢复的数据表' },
        { status: 400 },
      );
    }

    const results: Array<{ table: string; action: string; count: number; error?: string }> = [];
    let totalDeleted = 0;
    let totalInserted = 0;
    let hasError = false;

    // ---- 执行恢复 ----
    await prisma.$transaction(
      async (tx) => {
        // 1. 删除现有数据（仅 replace 模式）
        if (mode === 'replace') {
          for (const tableName of DELETE_ORDER) {
            if (!data[tableName]) continue;
            try {
              // @ts-expect-error - 动态模型名
              const deleted = await tx[tableName].deleteMany({});
              totalDeleted += deleted.count;
              results.push({
                table: tableName,
                action: 'delete',
                count: deleted.count,
              });
            } catch (err) {
              results.push({
                table: tableName,
                action: 'delete',
                count: 0,
                error: err instanceof Error ? err.message : '删除失败',
              });
            }
          }
        }

        // 2. 插入备份数据
        for (const tableName of INSERT_ORDER) {
          const records = data[tableName];
          if (!records || records.length === 0) continue;

          // Comment 表需要特殊处理：先插入无 parentId 的，再插入有 parentId 的
          if (tableName === 'comment') {
            const withoutParent = records.filter((r) => !r.parentId);
            const withParent = records.filter((r) => r.parentId);

            // 第一批：无父评论
            if (withoutParent.length > 0) {
              try {
                const created = await tx[tableName].createMany({
                  data: withoutParent as any,
                  skipDuplicates: true,
                });
                totalInserted += created.count;
                results.push({
                  table: tableName,
                  action: 'insert (无父评论)',
                  count: created.count,
                });
              } catch (err) {
                hasError = true;
                results.push({
                  table: tableName,
                  action: 'insert (无父评论)',
                  count: 0,
                  error: err instanceof Error ? err.message : '插入失败',
                });
              }
            }

            // 第二批：有父评论（逐条插入以处理自引用）
            let parentInserted = 0;
            let parentErrors = 0;
            for (const record of withParent) {
              try {
                await tx[tableName].create({ data: record as any });
                parentInserted++;
              } catch {
                parentErrors++;
              }
            }
            totalInserted += parentInserted;
            results.push({
              table: tableName,
              action: 'insert (子评论)',
              count: parentInserted,
              error: parentErrors > 0 ? `${parentErrors} 条失败` : undefined,
            });
            continue;
          }

          // 其他表：批量插入
          try {
            // @ts-expect-error - 动态模型名
            const created = await tx[tableName].createMany({
              data: records as any,
              skipDuplicates: true,
            });
            totalInserted += created.count;
            results.push({
              table: tableName,
              action: 'insert',
              count: created.count,
            });
          } catch (err) {
            hasError = true;
            results.push({
              table: tableName,
              action: 'insert',
              count: 0,
              error: err instanceof Error ? err.message : '插入失败',
            });
          }
        }
      },
      {
        timeout: 30000, // 30秒超时
      },
    );

    // ---- 记录操作日志 ----
    try {
      await prisma.operationLog.create({
        data: {
          username: admin.username,
          action: 'database_restore',
          target: 'database',
          detail: `模式: ${mode}, 删除: ${totalDeleted}, 插入: ${totalInserted}, 表数: ${tableNames.length}`,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
        },
      });
    } catch {
      // 忽略日志错误
    }

    return NextResponse.json({
      success: true,
      message: `恢复完成：删除 ${totalDeleted} 条，插入 ${totalInserted} 条`,
      summary: {
        mode,
        tablesProcessed: tableNames.length,
        totalDeleted,
        totalInserted,
        hasError,
      },
      details: results,
    });
  } catch (error) {
    console.error('[RESTORE ERROR]', error);

    // 事务超时
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2028') {
        return NextResponse.json(
          { error: '恢复超时：数据量过大，请尝试分表恢复或减小备份文件' },
          { status: 504 },
        );
      }
    }

    return NextResponse.json(
      { error: `恢复失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 },
    );
  }
}

// ============ PUT /api/admin/database/restore - 预检查备份文件 ============
export async function PUT(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { backupData } = body as { backupData: { meta?: unknown; data?: Record<string, unknown[]> } };

    if (!backupData || !backupData.data) {
      return NextResponse.json(
        { error: '无效的备份文件格式' },
        { status: 400 },
      );
    }

    const data = backupData.data;
    const tableNames = Object.keys(data);

    // 预览各表记录数
    const preview = tableNames.map((table) => ({
      table,
      count: Array.isArray(data[table]) ? data[table].length : 0,
    }));

    // 检查元数据
    const meta = backupData.meta as
      | { version?: string; exportedAt?: string; exportedBy?: string; totalRecords?: number }
      | undefined;

    return NextResponse.json({
      valid: true,
      version: meta?.version || '未知',
      exportedAt: meta?.exportedAt || '未知',
      exportedBy: meta?.exportedBy || '未知',
      totalRecords: meta?.totalRecords || preview.reduce((a, b) => a + b.count, 0),
      tables: preview,
      totalTables: preview.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `预检失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 },
    );
  }
}
