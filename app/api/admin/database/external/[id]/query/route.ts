import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import {
  decryptPassword,
  withExternalPool,
  executeQuery,
} from '@/lib/external-db';

// ============ POST /api/admin/database/external/[id]/query - 执行SQL ============
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { id } = params;
    const body = await request.json();
    const { sql, limit = 100 } = body as { sql: string; limit?: number };

    if (!sql || typeof sql !== 'string') {
      return NextResponse.json({ error: '缺少 SQL 语句' }, { status: 400 });
    }

    // 安全检查：禁止 DROP/TRUNCATE（防止误操作）
    const upperSql = sql.trim().toUpperCase();
    const forbidden = ['DROP ', 'TRUNCATE ', 'DROPDATABASE', 'DROPTABLE'];
    for (const kw of forbidden) {
      if (upperSql.startsWith(kw)) {
        return NextResponse.json(
          { error: `安全限制：不允许执行 ${kw.trim()} 操作` },
          { status: 403 },
        );
      }
    }

    const db = await prisma.externalDatabase.findUnique({ where: { id } });
    if (!db) {
      return NextResponse.json({ error: '数据库不存在' }, { status: 404 });
    }

    if (db.status === 'disabled') {
      return NextResponse.json({ error: '数据库已禁用' }, { status: 400 });
    }

    const password = decryptPassword(db.password);
    const maxLimit = Math.min(limit, 500); // 最大500行

    const result = await withExternalPool(
      { host: db.host, port: db.port, database: db.database, username: db.username, password, sslMode: db.sslMode },
      async (pool) => executeQuery(pool, sql, maxLimit),
    );

    // 记录操作日志
    try {
      await prisma.operationLog.create({
        data: {
          username: admin.username,
          action: 'external_db_query',
          target: db.name,
          detail: `SQL: ${sql.substring(0, 200)}${sql.length > 200 ? '...' : ''}`,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
        },
      });
    } catch {
      // 忽略
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[EXTERNAL QUERY ERROR]', error);
    return NextResponse.json(
      { error: `查询失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 },
    );
  }
}
