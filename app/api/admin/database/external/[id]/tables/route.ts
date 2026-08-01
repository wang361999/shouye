import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import {
  decryptPassword,
  withExternalPool,
  getDatabaseTables,
  getTableStructure,
  queryTableData,
} from '@/lib/external-db';

// ============ GET /api/admin/database/external/[id]/tables - 获取表列表/表数据 ============
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get('table');
    const schema = searchParams.get('schema') || 'public';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const orderBy = searchParams.get('orderBy') || undefined;
    const orderDir = searchParams.get('orderDir') as 'asc' | 'desc' | null;

    const db = await prisma.externalDatabase.findUnique({ where: { id } });
    if (!db) {
      return NextResponse.json({ error: '数据库不存在' }, { status: 404 });
    }

    if (db.status === 'disabled') {
      return NextResponse.json({ error: '数据库已禁用' }, { status: 400 });
    }

    const password = decryptPassword(db.password);

    const result = await withExternalPool(
      { host: db.host, port: db.port, database: db.database, username: db.username, password, sslMode: db.sslMode },
      async (pool) => {
        if (!tableName) {
          // 获取所有表
          const tables = await getDatabaseTables(pool);
          return { tables };
        }

        // 获取表结构 + 数据
        const [structure, data] = await Promise.all([
          getTableStructure(pool, tableName, schema),
          queryTableData(pool, tableName, schema, { page, pageSize, orderBy: orderBy || undefined, orderDir: orderDir || undefined }),
        ]);

        return { table: tableName, schema, structure, data };
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[EXTERNAL TABLES ERROR]', error);
    return NextResponse.json(
      { error: `获取表信息失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 },
    );
  }
}
