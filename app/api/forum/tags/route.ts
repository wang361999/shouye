import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// ============ 生成唯一 slug ============
// 将 name 转小写、空格转 -，如 slug 已存在则追加随机后缀
async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');

  let slug = baseSlug;
  const existing = await prisma.tag.findUnique({ where: { slug } });

  if (existing) {
    // slug 已存在，追加随机后缀
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    slug = `${baseSlug}-${randomSuffix}`;
  }

  return slug;
}

// ============ GET /api/forum/tags - 获取标签列表 ============
// 按 postCount 降序排列，支持 ?search= 模糊搜索标签名
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;

    const tags = await prisma.tag.findMany({
      where: search
        ? { name: { contains: search } }
        : undefined,
      orderBy: { postCount: 'desc' },
    });

    return NextResponse.json(tags);
  } catch (error) {
    console.error('[TAGS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取标签列表失败' },
      { status: 500 }
    );
  }
}

// ============ POST /api/forum/tags - 创建新标签（需登录） ============
export async function POST(request: NextRequest) {
  try {
    // 登录鉴权
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name } = body;

    // ---- 输入校验 ----
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: '标签名称不能为空' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // ---- name 唯一性校验 ----
    const existing = await prisma.tag.findUnique({
      where: { name: trimmedName },
    });
    if (existing) {
      return NextResponse.json(
        { error: '该标签已存在' },
        { status: 409 }
      );
    }

    // ---- 生成 slug ----
    const slug = await generateUniqueSlug(trimmedName);

    // ---- 创建标签 ----
    const tag = await prisma.tag.create({
      data: {
        name: trimmedName,
        slug,
      },
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error('[TAG CREATE ERROR]', error);
    return NextResponse.json(
      { error: '创建标签失败' },
      { status: 500 }
    );
  }
}
