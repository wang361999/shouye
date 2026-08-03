import { NextRequest, NextResponse } from 'next/server';

/**
 * 图片代理接口 - 从 R2 读取上传的图片并返回
 *
 * GET /api/upload/[...path]
 *   - [...path] 对应 R2 中的对象 key（不含前导 "uploads/"）
 *   - 例如：GET /api/upload/uploads/user123/1234567890-abc12345.png
 *     → 读取 R2 key "uploads/user123/1234567890-abc12345.png"
 *   - 设置正确的 Content-Type 和缓存头（immutable，一年缓存）
 *
 * 仅在 Cloudflare Workers（有 R2 binding）环境下可用。
 */

/** MIME 类型映射（根据扩展名推断） */
const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * R2 Bucket 最小结构化接口
 *
 * 仅声明本模块使用到的 get 方法，避免依赖 @cloudflare/workers-types 全局类型。
 * 运行时由 Cloudflare Workers 平台注入实际的 R2Bucket 实现。
 */
interface R2BucketLike {
  get(key: string): Promise<R2ObjectBodyLike | null>;
}

/** R2 对象返回体（最小结构化） */
interface R2ObjectBodyLike {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string; [k: string]: unknown };
  httpEtag?: string;
}

/**
 * 尝试获取 Cloudflare R2 bucket binding
 */
async function getR2Bucket(): Promise<R2BucketLike | null> {
  try {
    const { getCloudflareContext } = await import(
      /* webpackIgnore: true */ '@opennextjs/cloudflare/cloudflare-context'
    );

    const ctx = getCloudflareContext();
    const bucket = (ctx.env as Record<string, unknown>)?.NEXT_INC_CACHE_R2_BUCKET;

    if (bucket && typeof (bucket as R2BucketLike).get === 'function') {
      return bucket as R2BucketLike;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 从文件路径推断 Content-Type
 */
function inferContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  try {
    // ---- 拼接 R2 对象 key ----
    // params.path 是数组，例如 ["uploads", "user123", "123-abc.png"]
    const pathSegments = params.path;
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json(
        { error: '无效的文件路径' },
        { status: 400 },
      );
    }

    const key = pathSegments.join('/');

    // 安全检查：防止路径遍历（key 不应包含 ".."）
    if (key.includes('..')) {
      return NextResponse.json(
        { error: '无效的文件路径' },
        { status: 400 },
      );
    }

    // ---- 获取 R2 bucket ----
    const bucket = await getR2Bucket();

    if (!bucket) {
      return NextResponse.json(
        { error: 'R2 存储未配置，图片代理不可用' },
        { status: 503 },
      );
    }

    // ---- 从 R2 读取对象 ----
    const object = await bucket.get(key);

    if (!object) {
      return NextResponse.json(
        { error: '文件不存在' },
        { status: 404 },
      );
    }

    // ---- 读取对象内容 ----
    const data = await object.arrayBuffer();

    // ---- 确定 Content-Type ----
    // 优先使用 R2 对象存储的 httpMetadata.contentType，回退到根据扩展名推断
    const contentType =
      object.httpMetadata?.contentType || inferContentType(key);

    // ---- 返回图片内容，设置长期缓存头 ----
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        // ETag 帮助 CDN 缓存校验
        ...(object.httpEtag ? { ETag: object.httpEtag } : {}),
      },
    });
  } catch (error) {
    console.error('[UPLOAD PROXY ERROR]', error);
    return NextResponse.json(
      { error: '读取文件失败' },
      { status: 500 },
    );
  }
}
