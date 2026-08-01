/**
 * 安全工具函数
 * 输入净化、XSS 防护、SQL 注入防护
 */

/**
 * 净化字符串输入 - 防止 XSS
 * 移除 HTML 标签和危险字符
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // 移除 script 标签
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // 移除 iframe 标签
    .replace(/<object[^>]*>.*?<\/object>/gi, '') // 移除 object 标签
    .replace(/<embed[^>]*>/gi, '') // 移除 embed 标签
    .replace(/javascript:/gi, '') // 移除 javascript: 协议
    .replace(/on\w+\s*=/gi, '') // 移除事件处理器
    .replace(/data:text\/html/gi, '') // 移除 data:text/html
    .trim();
}

/**
 * 净化 HTML 内容 - 保留基本 HTML 但移除危险标签
 * 用于富文本编辑器内容
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '');
}

/**
 * 验证邮箱格式
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * 验证用户名格式 - 仅允许字母、数字、下划线、中文
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[\u4e00-\u9fa5a-zA-Z0-9_]{2,20}$/;
  return usernameRegex.test(username);
}

/**
 * 验证 URL 格式
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * 验证域名格式
 */
export function isValidDomain(domain: string): boolean {
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
}

/**
 * 密码强度检查
 * @returns { score: 0-4, label: 弱/中/强/很强 }
 */
export function checkPasswordStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const labels = ['极弱', '弱', '中', '强', '很强'];
  const finalScore = Math.min(score, 4);
  return { score: finalScore, label: labels[finalScore] };
}

/**
 * 限制字符串长度
 */
export function truncate(input: string, maxLength: number): string {
  if (!input) return '';
  return input.length > maxLength ? input.substring(0, maxLength) : input;
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * 生成随机 token
 */
export function generateToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
