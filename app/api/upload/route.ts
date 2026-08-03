import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

/**
 * 图片上传接口
 *
 * POST /api/upload
 *   - 接收 multipart/form-data，字段名为 "file"
 *   - 用户鉴权（getUserFromRequest）
 *   - 校验文件类型（jpeg/png/webp/gif）和大小（最大 5MB）
 *   - 环境检测：
 *       - Cloudflare Workers（有 R2 binding）：存入 R2，返回代理路径
 *       - Vercel / 其他环境（无 R2）：降级为 base64 data URL
 *   - 返回 { url: "..." }
 */

/** 最大文件大小：5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** 允许的图片 MIME 类型 */
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * R2 Bucket 最小结构化接口
 *
 * 仅声明本模块使用到的 put 方法，避免依赖 @cloudflare/workers-types 全局类型。
 * 运行时由 Cloudflare Workers 平台注入实际的 R2Bucket 实现。
 */
interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string,
    options?: {
      httpMetadata?: { contentType?: string; [k: string]: unknown };
      [k: string]: unknown;
    },
  ): Promise<unknown>;
}

/**
 * 生成随机字符串（用于文件名，避免冲突）
 */
function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  // 优先使用 crypto.getRandomValues（Workers / 浏览器环境可用）
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    for (let i = 0; i < length; i++) {
      result += chars[arr[i] % chars.length];
    }
  } else {
    // 回退到 Math.random
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return result;
}

/**
 * 获取 R2 bucket（已移除 OpenNext 依赖）
 *
 * 当前返回 null，触发 base64 data URL 降级模式。
 * 如需 R2 存储，可在 Worker 环境中恢复此实现。
 */
async function getR2Bucket(): Promise<R2BucketLike | null> {
  return null;
}

export async function POST(request: NextRequest) {
  try {
    // ---- 用户鉴权 ----
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 },
      );
    }

    // ---- 解析 multipart/form-data ----
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: '请选择要上传的文件' },
        { status: 400 },
      );
    }

    // ---- 校验文件类型 ----
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: '仅支持 JPEG、PNG、WebP、GIF 格式的图片' },
        { status: 400 },
      );
    }

    // ---- 校验文件大小 ----
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '文件大小不能超过 5MB' },
        { status: 400 },
      );
    }

    // ---- 读取文件内容 ----
    const arrayBuffer = await file.arrayBuffer();

    // ---- 生成文件名：uploads/{userId}/{timestamp}-{random}.ext ----
    const timestamp = Date.now();
    const random = randomString(8);
    const key = `uploads/${user.userId}/${timestamp}-${random}.${ext}`;

    // ---- 环境检测：尝试获取 R2 bucket ----
    const bucket = await getR2Bucket();

    if (bucket) {
      // ---- R2 模式：存入 R2，返回代理路径 ----
      await bucket.put(key, arrayBuffer, {
        httpMetadata: {
          contentType: file.type,
        },
      });

      // 返回代理路径，由 /api/upload/[...path] 路由读取
      // key 以 "uploads/" 开头，代理路径去掉该前缀以匹配 [...path] 动态路由
      const proxyPath = `/api/upload/${key}`;
      return NextResponse.json({
        url: proxyPath,
        key,
        storage: 'r2',
        size: file.size,
        type: file.type,
      });
    }

    // ---- 降级模式：base64 data URL（Vercel 等无 R2 的环境）----
    // Buffer 在 Node.js 原生可用，在 Cloudflare Workers（nodejs_compat）也可用
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    return NextResponse.json({
      url: dataUrl,
      storage: 'data-url',
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
