import { NextRequest, NextResponse } from 'next/server';
import { createHash, createHmac } from 'crypto';
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

// ============ AWS SigV4 签名（用于 R2 S3 兼容 API） ============
function sigV4Sign(
  method: string,
  url: URL,
  headers: Record<string, string>,
  body: Buffer,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  service: string,
): Record<string, string> {
  const datetime = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const date = datetime.slice(0, 8);

  const host = url.hostname;
  const canonicalUri = url.pathname;
  const canonicalQueryString = url.search ? url.search.slice(1) : '';

  // Canonical headers
  const signedHeaderKeys = ['host', 'x-amz-content-sha256', 'x-amz-date'];
  const allHeaders: Record<string, string> = {
    host,
    'x-amz-content-sha256': createHash('sha256').update(body).digest('hex'),
    'x-amz-date': datetime,
    ...headers,
  };

  const canonicalHeaders = signedHeaderKeys
    .map((k) => `${k}:${allHeaders[k].trim()}\n`)
    .join('');
  const signedHeaders = signedHeaderKeys.join(';');

  // Canonical request
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    allHeaders['x-amz-content-sha256'],
  ].join('\n');

  // String to sign
  const scope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  // Signing key
  const kDate = createHmac('sha256', `AWS4${secretAccessKey}`).update(date).digest();
  const kRegion = createHmac('sha256', kDate).update(region).digest();
  const kService = createHmac('sha256', kRegion).update(service).digest();
  const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...allHeaders,
    Authorization: authHeader,
  };
}

// ============ 上传备份到 Cloudflare R2 ============
async function uploadToR2(
  jsonData: Buffer,
  key: string,
): Promise<{ ok: boolean; message: string; url?: string }> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'shouye-cache';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return {
      ok: false,
      message: 'R2 未配置。请在环境变量中设置 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY',
    };
  }

  const r2Url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`);

  const signedHeaders = sigV4Sign(
    'PUT',
    r2Url,
    { 'Content-Type': 'application/json' },
    jsonData,
    accessKeyId,
    secretAccessKey,
    'auto',
    's3',
  );

  const res = await fetch(r2Url.toString(), {
    method: 'PUT',
    headers: signedHeaders,
    body: new Uint8Array(jsonData),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    return { ok: false, message: `R2 上传失败 (${res.status}): ${errText}` };
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
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'shouye-cache';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return { ok: false, backups: [], message: 'R2 未配置' };
  }

  const r2Url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucketName}`);
  r2Url.searchParams.set('prefix', 'backups/');
 r2Url.searchParams.set('list-type', '2');

  const signedHeaders = sigV4Sign(
    'GET',
    r2Url,
    {},
    Buffer.alloc(0),
    accessKeyId,
    secretAccessKey,
    'auto',
    's3',
  );

  const res = await fetch(r2Url.toString(), { method: 'GET', headers: signedHeaders });

  if (!res.ok) {
    return { ok: false, backups: [], message: `R2 列表失败 (${res.status})` };
  }

  const xml = await res.text();
  const backups: Array<{ key: string; size: number; lastModified: string }> = [];

  // 简单解析 XML
  const regex = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const block = match[1];
    const key = block.match(/<Key>(.*?)<\/Key>/)?.[1] || '';
    const size = parseInt(block.match(/<Size>(.*?)<\/Size>/)?.[1] || '0', 10);
    const lastModified = block.match(/<LastModified>(.*?)<\/LastModified>/)?.[1] || '';
    if (key) backups.push({ key, size, lastModified });
  }

  backups.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
  return { ok: true, backups };
}

// ============ POST /api/admin/database/backup-r2 - 备份到 R2 ============
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

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
    const result = await uploadToR2(jsonBuffer, key);

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

    const result = await listR2Backups();

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      backups: result.backups,
      configured: !!process.env.R2_ACCOUNT_ID,
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

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME || 'shouye-cache';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return NextResponse.json({ error: 'R2 未配置' }, { status: 400 });
    }

    const r2Url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`);
    const signedHeaders = sigV4Sign(
      'DELETE',
      r2Url,
      {},
      Buffer.alloc(0),
      accessKeyId,
      secretAccessKey,
      'auto',
      's3',
    );

    const res = await fetch(r2Url.toString(), { method: 'DELETE', headers: signedHeaders });

    if (!res.ok && res.status !== 204) {
      return NextResponse.json({ error: `删除失败 (${res.status})` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '备份已删除' });
  } catch (error) {
    console.error('[R2 BACKUP DELETE ERROR]', error);
    return NextResponse.json({ error: '删除备份失败' }, { status: 500 });
  }
}
