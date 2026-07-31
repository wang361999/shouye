import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/**
 * 临时诊断接口 - 测试各个组件是否正常工作
 * 部署后访问 /api/debug/diag 查看结果
 * 修复后删除此文件
 */
export async function GET() {
  const results: Record<string, unknown> = {
    time: new Date().toISOString(),
    env: {
      DATABASE_URL_set: !!process.env.DATABASE_URL,
      JWT_SECRET_set: !!process.env.JWT_SECRET,
      NODE_ENV: process.env.NODE_ENV,
    },
    tests: {} as Record<string, unknown>,
  };

  // 1. 测试 Tool 查询
  try {
    const tools = await prisma.tool.findMany({ take: 1 });
    results.tests.tool_findMany = { ok: true, count: tools.length };
  } catch (e) {
    results.tests.tool_findMany = { ok: false, error: String(e) };
  }

  // 2. 测试 User 查询
  try {
    const user = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: { id: true, username: true, role: true },
    });
    results.tests.user_findUnique = { ok: true, found: !!user, user };
  } catch (e) {
    results.tests.user_findUnique = { ok: false, error: String(e) };
  }

  // 3. 测试 bcrypt
  try {
    const hash = await bcrypt.hash('test', 10);
    const valid = await bcrypt.compare('test', hash);
    results.tests.bcrypt = { ok: true, hashWorks: valid };
  } catch (e) {
    results.tests.bcrypt = { ok: false, error: String(e) };
  }

  // 4. 测试 JWT
  try {
    const token = jwt.sign({ test: true }, process.env.JWT_SECRET || 'fallback', { expiresIn: '1h' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback');
    results.tests.jwt = { ok: true, tokenGenerated: !!token, decoded };
  } catch (e) {
    results.tests.jwt = { ok: false, error: String(e) };
  }

  // 5. 测试 OAuthApp 查询
  try {
    const count = await prisma.oAuthApp.count();
    results.tests.oauthApp_count = { ok: true, count };
  } catch (e) {
    results.tests.oauthApp_count = { ok: false, error: String(e) };
  }

  // 6. 测试 License 查询
  try {
    const count = await prisma.license.count();
    results.tests.license_count = { ok: true, count };
  } catch (e) {
    results.tests.license_count = { ok: false, error: String(e) };
  }

  // 7. 列出所有 Prisma 模型
  try {
    const modelNames = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$') && typeof (prisma as any)[k]?.findMany === 'function');
    results.tests.prisma_models = { ok: true, models: modelNames };
  } catch (e) {
    results.tests.prisma_models = { ok: false, error: String(e) };
  }

  return NextResponse.json(results);
}
