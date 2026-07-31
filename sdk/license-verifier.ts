/**
 * ET Studio 授权验证 SDK (TypeScript 版本)
 *
 * 供 TypeScript / Next.js 项目嵌入使用。
 *
 * 用法：
 *   import { initLicense, verifyLicense, getLicenseStatus, licenseMiddleware } from './license-verifier';
 *
 *   // 初始化（项目启动时）
 *   await initLicense({
 *     licenseKey: process.env.LICENSE_KEY!,
 *     verifyUrl: 'https://api.example.com/api/license/verify',
 *     onUnauthorized: (result) => console.error('授权失效:', result.message),
 *   });
 */

export interface LicenseConfig {
  /** 授权码 */
  licenseKey: string;
  /** 验证接口地址 */
  verifyUrl: string;
  /** 授权失效回调 */
  onUnauthorized?: (result: LicenseResult) => void;
  /** 是否启动定时校验（默认 true） */
  startPeriodic?: boolean;
  /** 手动指定域名（可选） */
  domain?: string;
}

export interface LicenseResult {
  valid: boolean;
  code: string;
  message: string;
  project_name?: string;
  project_type?: string;
  expires_at?: string;
  max_domains?: number;
  bound_domains?: number;
  expired_at?: string;
}

export interface LicenseStatus {
  isVerified: boolean;
  licenseInfo: LicenseResult | null;
  lastCheckTime: number | null;
}

// ============ 内部状态 ============
let isVerified = false;
let licenseInfo: LicenseResult | null = null;
let lastCheckTime: number | null = null;
let periodicTimer: ReturnType<typeof setInterval> | null = null;
let onUnauthorizedFn: ((result: LicenseResult) => void) | null = null;

const CONFIG = {
  licenseKey: '',
  verifyUrl: '',
  checkInterval: 24 * 60 * 60 * 1000,
  requestTimeout: 10000,
};

// ============ 工具函数 ============

/** 获取当前运行域名 */
export function getCurrentDomain(): string {
  if (process.env.LICENSE_DOMAIN) return process.env.LICENSE_DOMAIN;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.VERCEL_URL;
  if (appUrl) {
    return appUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0];
  }

  if (typeof window !== 'undefined' && window.location) {
    return window.location.hostname;
  }

  return 'localhost';
}

// ============ 核心验证逻辑 ============

/** 验证授权码 */
export async function verifyLicense(options: { licenseKey?: string; verifyUrl?: string; domain?: string } = {}): Promise<LicenseResult> {
  const licenseKey = options.licenseKey || CONFIG.licenseKey;
  const verifyUrl = options.verifyUrl || CONFIG.verifyUrl;
  const domain = options.domain || getCurrentDomain();

  if (!licenseKey) return { valid: false, code: 'no_license', message: '未配置授权码' };
  if (!verifyUrl) return { valid: false, code: 'no_verify_url', message: '未配置验证接口地址' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.requestTimeout);

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: licenseKey, domain }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data: LicenseResult = await response.json();

    if (data.valid) {
      isVerified = true;
      licenseInfo = data;
      lastCheckTime = Date.now();
    } else {
      isVerified = false;
      licenseInfo = null;
      onUnauthorizedFn?.(data);
    }

    return data;
  } catch (error) {
    isVerified = false;
    return {
      valid: false,
      code: 'network_error',
      message: `验证请求失败: ${error instanceof Error ? error.message : '网络错误'}`,
    };
  }
}

/** 初始化授权验证 */
export async function initLicense(config: LicenseConfig): Promise<LicenseResult> {
  if (!config.licenseKey) throw new Error('初始化失败：缺少 licenseKey');
  if (!config.verifyUrl) throw new Error('初始化失败：缺少 verifyUrl');

  CONFIG.licenseKey = config.licenseKey;
  CONFIG.verifyUrl = config.verifyUrl;
  onUnauthorizedFn = config.onUnauthorized || null;

  const result = await verifyLicense();

  if (config.startPeriodic !== false) {
    startPeriodicCheck();
  }

  return result;
}

/** 启动定时校验 */
export function startPeriodicCheck(): void {
  if (periodicTimer) clearInterval(periodicTimer);

  periodicTimer = setInterval(async () => {
    const result = await verifyLicense();
    if (!result.valid && onUnauthorizedFn) {
      onUnauthorizedFn(result);
    }
  }, CONFIG.checkInterval);

  if (periodicTimer && typeof periodicTimer === 'object' && 'unref' in periodicTimer) {
    (periodicTimer as any).unref();
  }
}

/** 停止定时校验 */
export function stopPeriodicCheck(): void {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
}

/** 获取当前授权状态 */
export function getLicenseStatus(): LicenseStatus {
  return { isVerified, licenseInfo, lastCheckTime };
}

/** Express/Koa 中间件 */
export function licenseMiddleware(req: any, res: any, next: any): void {
  if (isVerified) {
    next();
  } else {
    res?.status(403)?.json({
      error: '未授权',
      message: '系统未授权或授权已过期',
      code: 'unauthorized',
    });
  }
}

/** Next.js Edge Middleware 辅助 */
export async function checkLicenseForMiddleware(
  request: Request,
  config: { licenseKey: string; verifyUrl: string; unauthorizedUrl?: string }
): Promise<Response | null> {
  if (isVerified && lastCheckTime && Date.now() - lastCheckTime < CONFIG.checkInterval) {
    return null;
  }

  const result = await verifyLicense(config);
  if (result.valid) return null;

  if (config.unauthorizedUrl) {
    return Response.redirect(config.unauthorizedUrl, 302);
  }

  return new Response(
    JSON.stringify({ error: '未授权', message: result.message, code: result.code }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  );
}
