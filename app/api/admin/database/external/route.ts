import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import {
  encryptPassword,
  testConnection,
} from '@/lib/external-db';

// ============ GET /api/admin/database/external - 获取所有外部数据库 ============
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const dbs = await prisma.externalDatabase.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // 不返回密码明文
    const safeList = dbs.map((db) => ({
      id: db.id,
      name: db.name,
      description: db.description,
      dbType: db.dbType,
      host: db.host,
      port: db.port,
      database: db.database,
      username: db.username,
      sslMode: db.sslMode,
      status: db.status,
      lastCheckedAt: db.lastCheckedAt,
      lastCheckOk: db.lastCheckOk,
      hasPassword: !!db.password,
      createdAt: db.createdAt,
      updatedAt: db.updatedAt,
    }));

    return NextResponse.json({ databases: safeList });
  } catch (error) {
    console.error('[EXTERNAL DB LIST ERROR]', error);
    return NextResponse.json({ error: '获取外部数据库列表失败' }, { status: 500 });
  }
}

// ============ POST /api/admin/database/external - 创建外部数据库 ============
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const {
      name,
      description,
      dbType = 'postgresql',
      host,
      port = 5432,
      database,
      username,
      password,
      sslMode = 'prefer',
      testFirst = false,
    } = body as {
      name: string;
      description?: string;
      dbType?: string;
      host: string;
      port?: number;
      database: string;
      username: string;
      password: string;
      sslMode?: string;
      testFirst?: boolean;
    };

    // 验证必填字段
    if (!name || !host || !database || !username || !password) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    // 检查名称是否重复
    const existing = await prisma.externalDatabase.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: '数据库名称已存在' }, { status: 409 });
    }

    // 如果需要先测试连接
    if (testFirst) {
      const result = await testConnection({ host, port, database, username, password, sslMode });
      if (!result.ok) {
        return NextResponse.json(
          { error: `连接测试失败：${result.message}` },
          { status: 400 },
        );
      }
    }

    // 加密密码并保存
    const encryptedPassword = encryptPassword(password);
    const db = await prisma.externalDatabase.create({
      data: {
        name,
        description,
        dbType,
        host,
        port,
        database,
        username,
        password: encryptedPassword,
        sslMode,
        status: 'active',
      },
    });

    // 记录操作日志
    try {
      await prisma.operationLog.create({
        data: {
          username: admin.username,
          action: 'external_db_create',
          target: name,
          detail: `添加外部数据库: ${name} (${host}:${port}/${database})`,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
        },
      });
    } catch {
      // 忽略
    }

    return NextResponse.json({
      success: true,
      message: '外部数据库添加成功',
      id: db.id,
    });
  } catch (error) {
    console.error('[EXTERNAL DB CREATE ERROR]', error);
    return NextResponse.json(
      { error: `创建失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 },
    );
  }
}

// ============ PUT /api/admin/database/external - 测试连接 ============
export async function PUT(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { action, ...config } = body as {
      action: 'test';
      host: string;
      port: number;
      database: string;
      username: string;
      password: string;
      sslMode: string;
    };

    if (action === 'test') {
      const result = await testConnection(config);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: `测试失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 },
    );
  }
}
