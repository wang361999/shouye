import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

// ============ 备份表配置 ============
const BACKUP_TABLES = [
  'user', 'category', 'tool', 'systemSetting', 'oAuthApp', 'product',
  'monitoringDaily', 'monitoringRoute', 'post', 'productVersion',
  'license', 'order', 'comment', 'like', 'notification',
  'operationLog', 'oAuthAuthorizationCode', 'oAuthAccessToken',
  'licenseDomain', 'licenseLog',
] as const;

const TABLE_LABELS: Record<string, string> = {
  user: '用户', category: '论坛分类', tool: '工具', systemSetting: '系统设置',
  oAuthApp: 'OAuth应用', product: '产品', monitoringDaily: '监控统计(日)',
  monitoringRoute: '监控统计(路由)', post: '帖子', productVersion: '产品版本',
  license: '授权码', order: '订单', comment: '评论', like: '点赞/收藏',
  notification: '通知', operationLog: '操作日志',
  oAuthAuthorizationCode: 'OAuth授权码', oAuthAccessToken: 'OAuth访问令牌',
  licenseDomain: '授权域名', licenseLog: '授权验证日志',
};

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return { $bigint: value.toString() };
  if (value instanceof Date) return { $date: value.toISOString() };
  return value;
}

// ============ R2 配置检查 ============
function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const apiToken = process.env.R2_API_TOKEN;
  const bucketName = process.env.R2_BUCKET_NAME || 'shouye-backups';
  return { accountId, apiToken, bucketName };
}

function isR2Configured() {
  const { accountId, apiToken } = getR2Config();
  return !!(accountId && apiToken);
}

// ============ Cloudflare R2 原生 API ============
// 文档: https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/

const R2_API_BASE = 'https://api.cloudflare.com/client/v4';

// ============ 上传对象到 R2 ============
async function uploadToR2(
  jsonData: string,
  key: string,
): Promise<{ ok: boolean; message: string; url?: string }> {
  const { accountId, apiToken, bucketName } = getR2Config();

  if (!accountId || !apiToken) {
    return {
      ok: false,
      message: 'R2 未配置。请在环境变量中设置 R2_ACCOUNT_ID 和 R2_API_TOKEN',
    };
  }

  // object_key 中的斜杠不需要 percent-encode，其他特殊字符正常编码
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const url = `${R2_API_BASE}/accounts/${accountId}/r2/buckets/${bucketName}/objects/${encodedKey}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: jsonData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    return { ok: false, message: `R2 上传失败 (${res.status}): ${errText}` };
  }

  const data = await res.json().catch(() => ({}));
  if (!data.success) {
    const errMsg = data.errors?.[0]?.message || '未知错误';
    return { ok: false, message: `R2 上传失败: ${errMsg}` };
  }

  return {
    ok: true,
    message: '备份已上传到 Cloudflare R2',
    url: `r2://${bucketName}/${key}`,
  };
}

// ============ 列出 R2 中的备份 ============
async function listR2Backups(): Promise<{
  ok: boolean;
  backups: Array<{ key: string; size: number; lastModified: string }>;
  message?: string;
}> {
  const { accountId, apiToken, bucketName } = getR2Config();

  if (!accountId || !apiToken) {
    return { ok: false, backups: [], message: 'R2 未配置' };
  }

  const backups: Array<{ key: string; size: number; lastModified: string }> = [];
  let cursor: string | undefined;

  // 分页获取所有备份
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      prefix: 'backups/',
      per_page: '1000',
    });
    if (cursor) params.set('cursor', cursor);

    const url = `${R2_API_BASE}/accounts/${accountId}/r2/buckets/${bucketName}/objects?${params}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiToken}` },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      return { ok: false, backups: [], message: `R2 列表失败 (${res.status}): ${errText}` };
    }

    const data = await res.json().catch(() => ({}));
    if (!data.success) {
      const errMsg = data.errors?.[0]?.message || '未知错误';
      return { ok: false, backups: [], message: `R2 列表失败: ${errMsg}` };
    }

    const objects = data.result || [];
    for (const obj of objects) {
      if (obj.key) {
        backups.push({
          key: obj.key,
          size: obj.size || 0,
          lastModified: obj.last_modified || '',
        });
      }
    }

    // 检查是否还有更多数据
    if (!data.result_info?.is_truncated || !data.result_info?.cursor) {
      break;
    }
    cursor = data.result_info.cursor;
  }

  backups.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
  return { ok: true, backups };
}

// ============ 从 R2 下载备份 ============
async function downloadFromR2(
  key: string,
): Promise<{ ok: boolean; data?: Buffer; message?: string }> {
  const { accountId, apiToken, bucketName } = getR2Config();

  if (!accountId || !apiToken) {
    return { ok: false, message: 'R2 未配置' };
  }

  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const url = `${R2_API_BASE}/accounts/${accountId}/r2/buckets/${bucketName}/objects/${encodedKey}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    return { ok: false, message: `R2 下载失败 (${res.status}): ${errText}` };
  }

  const arrayBuffer = await res.arrayBuffer();
  return { ok: true, data: Buffer.from(arrayBuffer) };
}

// ============ 删除 R2 中的对象 ============
async function deleteFromR2(key: string): Promise<{ ok: boolean; message?: string }> {
  const { accountId, apiToken, bucketName } = getR2Config();

  if (!accountId || !apiToken) {
    return { ok: false, message: 'R2 未配置' };
  }

  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const url = `${R2_API_BASE}/accounts/${accountId}/r2/buckets/${bucketName}/objects/${encodedKey}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  if (!res.ok && res.status !== 204) {
    const errText = await res.text().catch(() => 'unknown');
    return { ok: false, message: `删除失败 (${res.status}): ${errText}` };
  }

  return { ok: true };
}

// ============ POST /api/admin/database/backup-r2 - 备份到 R2 ============
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: 'R2 未配置。请在环境变量中设置 R2_ACCOUNT_ID 和 R2_API_TOKEN' },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { tables: tablesParam } = body as { tables?: string[] };

    const tablesToExport = tablesParam
      ? tablesParam.filter((t) => BACKUP_TABLES.includes(t as any))
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
        console.error(`[R2 BACKUP] 导出 ${tableName} 失败:`, err);
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
        storage: 'cloudflare-r2',
      },
      data: exportData,
    };

    const jsonStr = JSON.stringify(backup, jsonReplacer, 2);
    const jsonBuffer = Buffer.from(jsonStr, 'utf-8');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const key = `backups/db-backup-${timestamp}.json`;

    // ---- 上传到 R2 ----
    const result = await uploadToR2(jsonStr, key);

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      key,
      size: jsonBuffer.length,
      totalRecords: backup.meta.totalRecords,
      tableCounts,
    });
  } catch (error) {
    console.error('[R2 BACKUP ERROR]', error);
    return NextResponse.json(
      { error: `R2 备份失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 },
    );
  }
}

// ============ GET /api/admin/database/backup-r2 - 列出 R2 备份 ============
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    // 检查是否是下载请求
    const { searchParams } = new URL(request.url);
    const downloadKey = searchParams.get('download');

    if (downloadKey) {
      // 下载备份
      const result = await downloadFromR2(downloadKey);
      if (!result.ok || !result.data) {
        return NextResponse.json({ error: result.message || '下载失败' }, { status: 400 });
      }
      return new NextResponse(result.data, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${downloadKey.split('/').pop()}"`,
        },
      });
    }

    // 列出备份
    const result = await listR2Backups();

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      backups: result.backups,
      configured: isR2Configured(),
    });
  } catch (error) {
    console.error('[R2 BACKUP LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取备份列表失败' },
      { status: 500 },
    );
  }
}

// ============ DELETE /api/admin/database/backup-r2 - 删除 R2 备份 ============
export async function DELETE(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: '缺少 key 参数' }, { status: 400 });
    }

    if (!isR2Configured()) {
      return NextResponse.json({ error: 'R2 未配置' }, { status: 400 });
    }

    const result = await deleteFromR2(key);

    if (!result.ok) {
      return NextResponse.json({ error: result.message || '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '备份已删除' });
  } catch (error) {
    console.error('[R2 BACKUP DELETE ERROR]', error);
    return NextResponse.json({ error: '删除备份失败' }, { status: 500 });
  }
}
