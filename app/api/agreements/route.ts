import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { DEFAULT_TERMS, DEFAULT_PRIVACY } from '@/lib/default-agreements';

// ============ 操作日志记录 ============
async function logOperation(
  userId: string,
  username: string,
  action: string,
  target?: string,
  detail?: string,
) {
  await prisma.operationLog.create({
    data: { userId, username, action, target, detail },
  });
}

// ============ GET /api/agreements - 获取协议内容 ============
// 公开接口，无需鉴权
// 参数: ?type=terms | privacy
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type !== 'terms' && type !== 'privacy') {
      return NextResponse.json(
        { error: '参数 type 必须为 terms 或 privacy' },
        { status: 400 }
      );
    }

    const key = `agreement_${type}`;
    let content: string;

    try {
      const record = await prisma.systemSetting.findUnique({
        where: { key },
      });
      content = record?.value || (type === 'terms' ? DEFAULT_TERMS : DEFAULT_PRIVACY);
    } catch {
      // 数据库不可用时降级返回默认内容
      content = type === 'terms' ? DEFAULT_TERMS : DEFAULT_PRIVACY;
    }

    return NextResponse.json({ type, content });
  } catch (error) {
    console.error('[AGREEMENTS GET ERROR]', error);
    return NextResponse.json(
      { error: '获取协议内容失败' },
      { status: 500 }
    );
  }
}

// ============ POST /api/admin/agreements - 更新协议内容（管理员） ============
// body: { type: 'terms' | 'privacy', content: string }
export async function POST(request: NextRequest) {
  try {
    // admin 鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { type, content } = body;

    // 输入校验
    if (type !== 'terms' && type !== 'privacy') {
      return NextResponse.json(
        { error: '参数 type 必须为 terms 或 privacy' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: '协议内容不能为空' },
        { status: 400 }
      );
    }

    if (content.length > 100000) {
      return NextResponse.json(
        { error: '协议内容不能超过 100000 字符' },
        { status: 400 }
      );
    }

    const key = `agreement_${type}`;

    // 保存到数据库
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: content },
      create: { key, value: content },
    });

    // 记录操作日志
    const typeLabel = type === 'terms' ? '用户协议' : '隐私政策';
    await logOperation(
      admin.userId,
      admin.username,
      'update_agreement',
      'SystemSetting',
      `更新${typeLabel}`
    );

    return NextResponse.json({ message: `${typeLabel}已保存` });
  } catch (error) {
    console.error('[AGREEMENTS POST ERROR]', error);
    return NextResponse.json(
      { error: '保存协议内容失败' },
      { status: 500 }
    );
  }
}
