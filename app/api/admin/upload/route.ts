import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/auth';

/** 最大文件大小：2MB */
const MAX_FILE_SIZE = 2 * 1024 * 1024;

/** 允许的图片 MIME 类型 */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

/**
 * POST /api/admin/upload - 上传图片文件（管理员专用）
 * 接收 multipart/form-data，将图片转为 base64 data URL 返回
 * 适用于 Vercel serverless 环境（无需文件系统写入）
 */
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: '请选择要上传的文件' },
        { status: 400 },
      );
    }

    // 校验文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: '仅支持 PNG、JPG、GIF、WebP 格式的图片' },
        { status: 400 },
      );
    }

    // 校验文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '文件大小不能超过 2MB' },
        { status: 400 },
      );
    }

    // 读取文件内容并转为 base64 data URL
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    return NextResponse.json({
      url: dataUrl,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error('[UPLOAD ERROR]', error);
    return NextResponse.json(
      { error: '上传失败，请稍后重试' },
      { status: 500 },
    );
  }
}
