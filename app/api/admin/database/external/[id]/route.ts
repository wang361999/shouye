import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import {
  encryptPassword,
  decryptPassword,
  testConnection,
  withExternalPool,
  getDatabaseOverview,
} from '@/lib/external-db';

// ============ GET /api/admin/database/external/[id] - 获取详情/概览 ============
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const overview = searchParams.get('overview');

    const db = await prisma.externalDatabase.findUnique({ where: { id } });
    if (!db) {
      return NextResponse.json({ error: '数据库不存在' }, { status: 404 });
    }

    // 基本信息（不返回密码）
    const baseInfo = {
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
      createdAt: db.createdAt,
      updatedAt: db.updatedAt,
    };

    // 如果请求概览
    if (overview === 'true') {
      if (db.status === 'disabled') {
        return NextResponse.json({
          ...baseInfo,
          overview: null,
          error: '数据库已禁用',
        });
      }

      try {
        const password = decryptPassword(db.password);
        const result = await withExternalPool(
          { host: db.host, port: db.port, database: db.database, username: db.username, password, sslMode: db.sslMode },
          async (pool) => getDatabaseOverview(pool),
        );

        // 更新检测结果
        await prisma.externalDatabase.update({
          where: { id },
          data: { lastCheckedAt: new Date(), lastCheckOk: true },
        });

        return NextResponse.json({
          ...baseInfo,
          overview: result,
        });
      } catch (error) {
        await prisma.externalDatabase.update({
          where: { id },
          data: { lastCheckedAt: new Date(), lastCheckOk: false },
        });

        return NextResponse.json({
          ...baseInfo,
          overview: null,
          error: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
        });
      }
    }

    return NextResponse.json(baseInfo);
  } catch (error) {
    console.error('[EXTERNAL DB GET ERROR]', error);
    return NextResponse.json({ error: '获取详情失败' }, { status: 500 });
  }
}

// ============ PUT /api/admin/database/external/[id] - 更新 ============
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { id } = params;
    const body = await request.json();
    const {
      name,
      description,
      host,
      port,
      database,
      username,
      password,
      sslMode,
      status,
    } = body;

    const existing = await prisma.externalDatabase.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '数据库不存在' }, { status: 404 });
    }

    // 检查名称冲突
    if (name && name !== existing.name) {
      const conflict = await prisma.externalDatabase.findUnique({ where: { name } });
      if (conflict) {
        return NextResponse.json({ error: '数据库名称已存在' }, { status: 409 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (host !== undefined) updateData.host = host;
    if (port !== undefined) updateData.port = port;
    if (database !== undefined) updateData.database = database;
    if (username !== undefined) updateData.username = username;
    if (sslMode !== undefined) updateData.sslMode = sslMode;
    if (status !== undefined) updateData.status = status;

    // 密码：空字符串=不修改，有值=修改
    if (password) {
      updateData.password = encryptPassword(password);
    }

    const updated = await prisma.externalDatabase.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: '更新成功',
      id: updated.id,
    });
  } catch (error) {
    console.error('[EXTERNAL DB UPDATE ERROR]', error);
    return NextResponse.json(
      { error: `更新失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 },
    );
  }
}

// ============ DELETE /api/admin/database/external/[id] - 删除 ============
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { id } = params;
    const db = await prisma.externalDatabase.findUnique({ where: { id } });
    if (!db) {
      return NextResponse.json({ error: '数据库不存在' }, { status: 404 });
    }

    await prisma.externalDatabase.delete({ where: { id } });

    // 记录操作日志
    try {
      await prisma.operationLog.create({
        data: {
          username: admin.username,
          action: 'external_db_delete',
          target: db.name,
          detail: `删除外部数据库: ${db.name} (${db.host}:${db.port}/${db.database})`,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
        },
      });
    } catch {
      // 忽略
    }

    return NextResponse.json({ success: true, message: '已删除' });
  } catch (error) {
    console.error('[EXTERNAL DB DELETE ERROR]', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
