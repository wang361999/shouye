import { NextRequest, NextResponse } from 'next/server';

/**
 * 图片代理接口
 *
 * 原先从 Cloudflare R2 读取上传的图片。
 * 已移除 OpenNext/R2 依赖，当前返回 503。
 * 如需图片上传，建议使用 Vercel Blob 或外部图床服务。
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const key = params.path?.join('/') || '';
  return NextResponse.json(
    {
      error: '图片代理不可用',
      detail: '已迁移到 Vercel，R2 存储未配置',
      path: key,
    },
    { status: 503 },
  );
}
