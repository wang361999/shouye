/**
 * 微信公众号 API 工具库
 *
 * 提供微信公众号文章同步所需的全部能力：
 *   1. Access Token 获取与内存缓存
 *   2. 文章内图片上传（uploadimg）
 *   3. 封面缩略图上传（add_material）
 *   4. 草稿新增 / 删除
 *   5. 发布提交与状态查询
 *   6. Markdown 转微信公众号 HTML
 *
 * 凭证来源优先级：环境变量 > 数据库 SystemSetting
 */

import zlib from 'zlib';
import prisma from '@/lib/prisma';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ============ 类型定义 ============

/** 微信 API 通用错误响应 */
export interface WechatApiError {
  errcode: number;
  errmsg: string;
}

/** Access Token 获取结果 */
export interface WechatAccessToken {
  accessToken: string;
  expiresIn: number;
}

/** 文章内图片上传结果 */
export interface WechatUploadImageResult {
  success: boolean;
  url?: string;
  message: string;
}

/** 封面缩略图上传结果 */
export interface WechatUploadThumbResult {
  success: boolean;
  mediaId?: string;
  url?: string;
  message: string;
}

/** 草稿新增结果 */
export interface WechatDraftResult {
  success: boolean;
  mediaId?: string;
  message: string;
}

/** 发布提交结果 */
export interface WechatPublishResult {
  success: boolean;
  publishId?: string;
  message: string;
}

/** 发布状态查询结果 */
export interface WechatPublishStatus {
  success: boolean;
  status?: string;
  articleId?: string;
  detail?: any[];
  message: string;
}

/** 草稿删除结果 */
export interface WechatDeleteResult {
  success: boolean;
  message: string;
}

/** 草稿文章参数 */
export interface WechatArticleParam {
  title: string;
  content: string;
  thumbMediaId: string;
  digest?: string;
  author?: string;
  contentSourceUrl?: string;
}

// ============ 凭证获取 ============

/**
 * 从数据库 SystemSetting 或环境变量获取微信 AppID
 *
 * 优先级：环境变量 WECHAT_APP_ID > 数据库 SystemSetting.wechat_app_id
 *
 * @returns AppID 字符串，未配置时返回 null
 */
export async function getWechatAppId(): Promise<string | null> {
  if (process.env.WECHAT_APP_ID) {
    return process.env.WECHAT_APP_ID;
  }
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'wechat_app_id' },
    });
    return setting?.value || null;
  } catch {
    return null;
  }
}

/**
 * 从数据库 SystemSetting 或环境变量获取微信 AppSecret
 *
 * 优先级：环境变量 WECHAT_APP_SECRET > 数据库 SystemSetting.wechat_app_secret
 *
 * @returns AppSecret 字符串，未配置时返回 null
 */
export async function getWechatAppSecret(): Promise<string | null> {
  if (process.env.WECHAT_APP_SECRET) {
    return process.env.WECHAT_APP_SECRET;
  }
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'wechat_app_secret' },
    });
    return setting?.value || null;
  } catch {
    return null;
  }
}

// ============ Access Token 管理 ============

// 内存缓存：token 与过期时间戳（毫秒）
let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0; // 过期时间戳（毫秒）
// 提前刷新阈值：7200s 有效期，6500s 即提前刷新，避免边界过期
const TOKEN_REFRESH_THRESHOLD = 6500 * 1000;

/**
 * 获取微信公众号 Access Token（带内存缓存）
 *
 * Token 有效期 7200 秒，在 6500 秒时即提前刷新，避免边界过期。
 * 凭证取自环境变量 WECHAT_APP_ID / WECHAT_APP_SECRET，
 * 未配置时回退读取数据库 SystemSetting 的 wechat_app_id / wechat_app_secret。
 *
 * @returns Access Token 字符串
 * @throws 未配置 AppID/AppSecret 或微信 API 返回错误时抛出
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  // 缓存仍有效则直接返回
  if (cachedAccessToken && now < cachedTokenExpiresAt) {
    return cachedAccessToken;
  }

  const appId = await getWechatAppId();
  const appSecret = await getWechatAppSecret();

  if (!appId || !appSecret) {
    throw new Error(
      '微信公众号 AppID/AppSecret 未配置。请在环境变量或后台系统设置中配置 wechat_app_id / wechat_app_secret。',
    );
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(
    appId,
  )}&secret=${encodeURIComponent(appSecret)}`;

  const res = await fetch(url, { method: 'GET' });
  const data = await res.json();

  if (data.errcode || !data.access_token) {
    throw new Error(
      `获取微信 Access Token 失败（errcode=${data.errcode}）: ${data.errmsg || '未知错误'}`,
    );
  }

  cachedAccessToken = data.access_token as string;
  const expiresIn: number = data.expires_in || 7200;
  // 提前刷新：取 6500s 与实际有效期的较小值，防止意外过期
  const refreshIn = Math.min(expiresIn, TOKEN_REFRESH_THRESHOLD / 1000);
  cachedTokenExpiresAt = now + refreshIn * 1000;

  return cachedAccessToken;
}

/**
 * 重置 Access Token 缓存（用于强制刷新场景）
 */
export function resetAccessTokenCache(): void {
  cachedAccessToken = null;
  cachedTokenExpiresAt = 0;
}

// ============ 内部工具 ============

/**
 * 构建带 access_token 的完整请求 URL
 *
 * @param path API 路径（可含 query 参数）
 */
async function withToken(path: string): Promise<string> {
  const token = await getAccessToken();
  const sep = path.includes('?') ? '&' : '?';
  return `https://api.weixin.qq.com${path}${sep}access_token=${encodeURIComponent(token)}`;
}

/**
 * 构造 multipart/form-data 的 media 字段（用于图片上传）
 *
 * @param buffer 图片二进制数据
 * @param filename 文件名（含扩展名）
 */
function buildMediaFormData(buffer: Buffer, filename: string): FormData {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)]);
  form.append('media', blob, filename);
  return form;
}

// ============ 文章内图片上传 ============

/**
 * 上传文章内图片（用于正文 <img>）
 *
 * POST https://api.weixin.qq.com/cgi-bin/media/uploadimg
 * 返回的 URL 可直接用于文章 HTML 的 <img src>。
 * 注意：该接口上传的图片不占用素材库配额，且仅用于图文正文。
 *
 * @param buffer 图片二进制数据
 * @param filename 文件名（含扩展名，如 cover.jpg）
 * @returns 上传结果，成功时包含图片 URL
 */
export async function uploadArticleImage(
  buffer: Buffer,
  filename: string,
): Promise<WechatUploadImageResult> {
  try {
    const url = await withToken('/cgi-bin/media/uploadimg');
    const form = buildMediaFormData(buffer, filename);

    const res = await fetch(url, { method: 'POST', body: form });
    const data = await res.json();

    if (data.errcode || !data.url) {
      return {
        success: false,
        message: `上传文章图片失败（errcode=${data.errcode}）: ${data.errmsg || '未知错误'}`,
      };
    }

    return { success: true, url: data.url as string, message: '上传成功' };
  } catch (error: any) {
    return {
      success: false,
      message: `上传文章图片异常: ${error.message || '未知错误'}`,
    };
  }
}

// ============ 封面缩略图上传 ============

/**
 * 上传封面缩略图（作为永久图片素材，用于 thumb_media_id）
 *
 * POST https://api.weixin.qq.com/cgi-bin/material/add_material?type=image
 * 返回 media_id，用作草稿的 thumb_media_id。
 *
 * @param buffer 图片二进制数据
 * @param filename 文件名（含扩展名，如 thumb.jpg）
 * @returns 上传结果，成功时包含 media_id 与图片 URL
 */
export async function uploadThumb(
  buffer: Buffer,
  filename: string,
): Promise<WechatUploadThumbResult> {
  try {
    const url = await withToken('/cgi-bin/material/add_material?type=image');
    const form = buildMediaFormData(buffer, filename);

    const res = await fetch(url, { method: 'POST', body: form });
    const data = await res.json();

    if (data.errcode || !data.media_id) {
      return {
        success: false,
        message: `上传封面缩略图失败（errcode=${data.errcode}）: ${data.errmsg || '未知错误'}`,
      };
    }

    return {
      success: true,
      mediaId: data.media_id as string,
      url: data.url as string | undefined,
      message: '上传成功',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `上传封面缩略图异常: ${error.message || '未知错误'}`,
    };
  }
}

// ============ 草稿新增 ============

/**
 * 新增草稿
 *
 * POST https://api.weixin.qq.com/cgi-bin/draft/add
 * Body: { articles: [{ title, content, thumb_media_id, digest, author, content_source_url }] }
 * 返回 media_id（草稿 ID）。
 *
 * @param article 文章参数
 * @returns 新增结果，成功时包含草稿 media_id
 */
export async function addDraft(
  article: WechatArticleParam,
): Promise<WechatDraftResult> {
  try {
    const url = await withToken('/cgi-bin/draft/add');
    const body = {
      articles: [
        {
          title: article.title,
          content: article.content,
          thumb_media_id: article.thumbMediaId,
          ...(article.digest ? { digest: article.digest } : {}),
          ...(article.author ? { author: article.author } : {}),
          ...(article.contentSourceUrl
            ? { content_source_url: article.contentSourceUrl }
            : {}),
        },
      ],
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.errcode || !data.media_id) {
      return {
        success: false,
        message: `新增草稿失败（errcode=${data.errcode}）: ${data.errmsg || '未知错误'}`,
      };
    }

    return {
      success: true,
      mediaId: data.media_id as string,
      message: '草稿创建成功',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `新增草稿异常: ${error.message || '未知错误'}`,
    };
  }
}

// ============ 发布提交 ============

/**
 * 提交发布（将草稿发布到公众号）
 *
 * POST https://api.weixin.qq.com/cgi-bin/freepublish/submit
 * Body: { media_id }
 * 返回 publish_id，可用于轮询发布状态。
 *
 * @param mediaId 草稿 media_id
 * @returns 发布提交结果，成功时包含 publish_id
 */
export async function publishDraft(
  mediaId: string,
): Promise<WechatPublishResult> {
  try {
    const url = await withToken('/cgi-bin/freepublish/submit');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_id: mediaId }),
    });
    const data = await res.json();

    if (data.errcode || !data.publish_id) {
      return {
        success: false,
        message: `提交发布失败（errcode=${data.errcode}）: ${data.errmsg || '未知错误'}`,
      };
    }

    return {
      success: true,
      publishId: data.publish_id as string,
      message: '发布已提交',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `提交发布异常: ${error.message || '未知错误'}`,
    };
  }
}

// ============ 发布状态查询 ============

/**
 * 查询发布状态
 *
 * POST https://api.weixin.qq.com/cgi-bin/freepublish/get
 * Body: { publish_id }
 *
 * 状态值（publish_status）：
 *   - "publish_succeeded"  发布成功
 *   - "publish_in_progress" 发布中
 *   - "publish_failed"     发布失败（含 original_article_deleted / others 等）
 *
 * @param publishId 发布 ID
 * @returns 发布状态查询结果
 */
export async function getPublishStatus(
  publishId: string,
): Promise<WechatPublishStatus> {
  try {
    const url = await withToken('/cgi-bin/freepublish/get');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const data = await res.json();

    if (data.errcode) {
      return {
        success: false,
        message: `查询发布状态失败（errcode=${data.errcode}）: ${data.errmsg || '未知错误'}`,
      };
    }

    return {
      success: true,
      status: data.publish_status,
      articleId: data.article_id,
      detail: data.detail,
      message: '查询成功',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `查询发布状态异常: ${error.message || '未知错误'}`,
    };
  }
}

// ============ 草稿删除 ============

/**
 * 删除草稿
 *
 * POST https://api.weixin.qq.com/cgi-bin/draft/delete
 * Body: { media_id }
 *
 * @param mediaId 草稿 media_id
 * @returns 删除结果
 */
export async function deleteDraft(
  mediaId: string,
): Promise<WechatDeleteResult> {
  try {
    const url = await withToken('/cgi-bin/draft/delete');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_id: mediaId }),
    });
    const data = await res.json();

    if (data.errcode) {
      return {
        success: false,
        message: `删除草稿失败（errcode=${data.errcode}）: ${data.errmsg || '未知错误'}`,
      };
    }

    return { success: true, message: '草稿已删除' };
  } catch (error: any) {
    return {
      success: false,
      message: `删除草稿异常: ${error.message || '未知错误'}`,
    };
  }
}

// ============ Markdown 转微信公众号 HTML ============

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 行内格式化：图片、链接、粗体、斜体、行内代码
 *
 * 处理顺序：图片 → 链接 → 粗体 → 斜体 → 行内代码
 */
function inlineFormat(text: string): string {
  let result = text;

  // 图片 ![alt](url)
  result = result.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_m, alt, url) =>
      `<img src="${url.trim()}" alt="${escapeHtml(alt)}" style="max-width:100%;border-radius:6px;margin:12px 0;display:block;" />`,
  );

  // 链接 [text](url)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, linkText, url) =>
      `<a href="${url.trim()}" style="color:#0969da;text-decoration:none;border-bottom:1px solid #0969da;">${escapeHtml(
        linkText,
      )}</a>`,
  );

  // 粗体 **text**
  result = result.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong style="font-weight:bold;">$1</strong>',
  );

  // 斜体 *text*（粗体已替换，剩余单个 * 不会与 ** 冲突）
  result = result.replace(
    /\*([^*]+)\*/g,
    '<em style="font-style:italic;">$1</em>',
  );

  // 行内代码 `code`
  result = result.replace(
    /`([^`]+)`/g,
    '<code style="background:#f6f8fa;padding:2px 6px;border-radius:4px;font-family:Menlo,Monaco,Consolas,monospace;font-size:13px;color:#d63384;">$1</code>',
  );

  return result;
}

/**
 * 将 Markdown 转换为适合微信公众号渲染的 HTML
 *
 * 使用正则替换实现，不依赖外部库。支持：
 *   - 代码块（```）→ 带样式的 <pre><code>
 *   - 行内代码（`code`）→ <code>
 *   - 图片 ![alt](url) → <img src="url">
 *   - 链接 [text](url) → <a href="url">text</a>
 *   - 标题 # ~ ######
 *   - 引用 >
 *   - 无序列表 - / * / +
 *   - 有序列表 1.
 *   - 粗体 **text** / 斜体 *text*
 *   - 水平分割线 ---
 *   - 普通段落
 *
 * 所有标签均附带内联样式以适配微信渲染环境。
 *
 * @param markdown Markdown 原文
 * @returns 适合微信公众号渲染的 HTML 字符串
 */
export function markdownToWechatHtml(markdown: string): string {
  if (!markdown) return '';

  // 先提取代码块，避免内部内容被其他规则误处理
  const codeBlocks: string[] = [];
  let text = markdown.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_m, lang, code) => {
      const idx = codeBlocks.length;
      const langAttr = lang ? ` data-lang="${escapeHtml(lang)}"` : '';
      const styled = `<pre style="background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;padding:16px;overflow:auto;line-height:1.5;font-size:14px;margin:16px 0;"${langAttr}><code style="font-family:Menlo,Monaco,Consolas,monospace;color:#24292e;">${escapeHtml(
        code.replace(/\n$/, ''),
      )}</code></pre>`;
      codeBlocks.push(styled);
      return `\u0000CODEBLOCK${idx}\u0000`;
    },
  );

  const lines = text.split('\n');
  const htmlLines: string[] = [];
  let inUnorderedList = false;
  let inOrderedList = false;
  let inBlockquote = false;

  const closeLists = () => {
    if (inUnorderedList) {
      htmlLines.push('</ul>');
      inUnorderedList = false;
    }
    if (inOrderedList) {
      htmlLines.push('</ol>');
      inOrderedList = false;
    }
  };

  const closeBlockquote = () => {
    if (inBlockquote) {
      htmlLines.push('</blockquote>');
      inBlockquote = false;
    }
  };

  for (const line of lines) {
    // 代码块占位符（整行）
    const codeMatch = line.match(/^\u0000CODEBLOCK(\d+)\u0000$/);
    if (codeMatch) {
      closeLists();
      closeBlockquote();
      htmlLines.push(codeBlocks[Number(codeMatch[1])]);
      continue;
    }

    // 空行
    if (/^\s*$/.test(line)) {
      closeLists();
      closeBlockquote();
      continue;
    }

    // 水平分割线
    if (/^(\s*[-*]){3,}\s*$/.test(line)) {
      closeLists();
      closeBlockquote();
      htmlLines.push(
        '<hr style="border:none;border-top:1px solid #e1e4e8;margin:20px 0;" />',
      );
      continue;
    }

    // 标题 # ~ ######
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeLists();
      closeBlockquote();
      const level = headingMatch[1].length;
      const sizes = ['28px', '24px', '22px', '20px', '18px', '16px'];
      htmlLines.push(
        `<h${level} style="font-size:${sizes[level - 1]};font-weight:bold;margin:20px 0 12px;color:#24292e;line-height:1.4;">${inlineFormat(
          headingMatch[2],
        )}</h${level}>`,
      );
      continue;
    }

    // 引用 >
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      closeLists();
      if (!inBlockquote) {
        htmlLines.push(
          '<blockquote style="border-left:4px solid #dfe2e5;padding:4px 16px;margin:16px 0;color:#6a737d;background:#f6f8fa;">',
        );
        inBlockquote = true;
      }
      htmlLines.push(
        `<p style="margin:4px 0;">${inlineFormat(quoteMatch[1])}</p>`,
      );
      continue;
    }

    // 无序列表 - / * / +
    const ulMatch = line.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      if (inOrderedList) {
        htmlLines.push('</ol>');
        inOrderedList = false;
      }
      if (!inUnorderedList) {
        htmlLines.push(
          '<ul style="padding-left:24px;margin:12px 0;line-height:1.8;">',
        );
        inUnorderedList = true;
      }
      htmlLines.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    // 有序列表 1.
    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (inUnorderedList) {
        htmlLines.push('</ul>');
        inUnorderedList = false;
      }
      if (!inOrderedList) {
        htmlLines.push(
          '<ol style="padding-left:24px;margin:12px 0;line-height:1.8;">',
        );
        inOrderedList = true;
      }
      htmlLines.push(`<li>${inlineFormat(olMatch[1])}</li>`);
      continue;
    }

    // 普通段落
    closeLists();
    closeBlockquote();
    htmlLines.push(
      `<p style="margin:12px 0;line-height:1.8;font-size:15px;color:#24292e;">${inlineFormat(
        line,
      )}</p>`,
    );
  }

  closeLists();
  closeBlockquote();

  return htmlLines.join('\n');
}

// ============ 图片处理工具 ============

/**
 * CRC32 计算表（用于 PNG chunk 校验）
 */
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/**
 * 生成默认封面图（纯色 PNG）
 *
 * 当帖子内容中无图片时，使用此默认封面。
 * 生成 200×200 的品牌蓝色 (#3B82F6) 纯色 PNG，无需外部依赖。
 *
 * @returns PNG 图片 Buffer
 */
export function createDefaultCoverPng(): Buffer {
  const W = 200;
  const H = 200;
  const R = 59;
  const G = 130;
  const B = 246;

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter: adaptive
  ihdr[12] = 0; // interlace: none

  // Raw pixel data: each scanline prefixed with filter byte 0
  const scanline = Buffer.alloc(1 + W * 3);
  scanline[0] = 0; // filter: none
  for (let x = 0; x < W; x++) {
    scanline[1 + x * 3] = R;
    scanline[1 + x * 3 + 1] = G;
    scanline[1 + x * 3 + 2] = B;
  }
  const raw = Buffer.concat(Array(H).fill(scanline));
  const compressed = zlib.deflateSync(raw);

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * 从 Markdown 内容中提取第一张图片的 URL
 *
 * 支持 Markdown 图片语法 ![alt](url) 和 HTML <img src="url">
 *
 * @param markdown Markdown 原文
 * @returns 图片 URL 字符串，未找到时返回 null
 */
export function extractFirstImageFromMarkdown(markdown: string): string | null {
  if (!markdown) return null;

  // Markdown 图片语法: ![alt](url)
  const mdMatch = markdown.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (mdMatch) {
    const url = mdMatch[1].trim().split(/\s+/)[0];
    if (url) return url;
  }

  // HTML img 标签: <img src="url">
  const htmlMatch = markdown.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (htmlMatch) {
    return htmlMatch[1].trim();
  }

  return null;
}

/**
 * 下载图片并上传为微信永久素材（封面缩略图）
 *
 * @param imageUrl 图片 URL
 * @returns 上传结果，成功时包含 media_id
 */
export async function downloadAndUploadThumb(
  imageUrl: string,
): Promise<WechatUploadThumbResult> {
  try {
    const res = await fetch(imageUrl, {
      method: 'GET',
      redirect: 'follow',
    });
    if (!res.ok) {
      return {
        success: false,
        message: `下载图片失败 (HTTP ${res.status})`,
      };
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : 'jpg';
    const filename = `cover-${Date.now()}.${ext}`;
    return uploadThumb(buffer, filename);
  } catch (error: any) {
    return {
      success: false,
      message: `下载并上传封面图片异常: ${error.message || '未知错误'}`,
    };
  }
}

/**
 * 获取或创建默认封面缩略图 media_id
 *
 * 1. 检查 SystemSetting 中是否已缓存 wechat_default_thumb_id
 * 2. 若已缓存则直接返回
 * 3. 若未缓存则生成默认封面 PNG，上传至微信，将 media_id 缓存到 SystemSetting
 *
 * @returns 默认封面的 media_id
 * @throws 微信 API 调用失败时抛出
 */
export async function getOrCreateDefaultThumbMediaId(): Promise<string> {
  // 1. 检查缓存
  try {
    const cached = await prisma.systemSetting.findUnique({
      where: { key: 'wechat_default_thumb_id' },
    });
    if (cached?.value) {
      return cached.value;
    }
  } catch {
    // 数据库查询失败，继续尝试创建
  }

  // 2. 生成并上传默认封面
  const pngBuffer = createDefaultCoverPng();
  const result = await uploadThumb(pngBuffer, 'default-cover.png');

  if (!result.success || !result.mediaId) {
    throw new Error(
      `创建默认封面失败: ${result.message || '未知错误'}`,
    );
  }

  // 3. 缓存 media_id
  try {
    await prisma.systemSetting.upsert({
      where: { key: 'wechat_default_thumb_id' },
      update: { value: result.mediaId },
      create: { key: 'wechat_default_thumb_id', value: result.mediaId },
    });
  } catch {
    // 缓存失败不影响主流程，下次会重新创建
  }

  return result.mediaId;
}

/**
 * 从数据库 SystemSetting 或环境变量获取微信公众号类型
 *
 * 值为 "personal"（个人号）或 "enterprise"（企业号），默认 "enterprise"
 *
 * @returns 账号类型
 */
export async function getWechatAccountType(): Promise<'personal' | 'enterprise'> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'wechat_account_type' },
    });
    if (setting?.value === 'personal') return 'personal';
    return 'enterprise';
  } catch {
    return 'enterprise';
  }
}

/**
 * 获取微信配置状态
 *
 * @returns { configured: boolean, appId?: string, accountType?: 'personal' | 'enterprise' }
 */
export async function getWechatConfig(): Promise<{
  configured: boolean;
  appId?: string;
  accountType?: 'personal' | 'enterprise';
}> {
  const appId = await getWechatAppId();
  const appSecret = await getWechatAppSecret();
  const accountType = await getWechatAccountType();
  return {
    configured: Boolean(appId && appSecret),
    appId: appId || undefined,
    accountType,
  };
}
