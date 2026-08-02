/**
 * 集中式环境变量管理模块
 *
 * 设计目标：
 *   1. 自动从 DATABASE_URL 派生 JWT_SECRET（如果未显式配置），避免部署时因缺失密钥而 500
 *   2. 自动从 NEXT_PUBLIC_APP_URL 获取应用 URL（兼容 Cloudflare 和 Vercel）
 *   3. 提供 ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL 的默认值，零配置即可播种
 *   4. 通过 getEnv() 统一、安全地访问所有环境变量（已应用默认值与派生逻辑）
 *   5. 在模块首次加载时打印配置状态摘要（仅显示是否配置 / 掩码值，不泄露敏感信息）
 *
 * 注意：
 *   - 本模块在顶层不做任何可能抛出异常的操作，确保 Next.js 构建阶段安全加载
 *   - 严格的运行时校验放在 getJwtSecret() 中，仅在真正使用密钥时触发
 *   - crypto 模块在 Cloudflare Workers 中通过 nodejs_compat 兼容标志可用
 */
import crypto from 'crypto';

// ============================================================
// 默认值常量
// ============================================================

/** 开发环境回退密钥（仅在 JWT_SECRET 与 DATABASE_URL 均不可用时使用，仅限开发） */
const FALLBACK_SECRET = 'dev-only-insecure-secret-do-not-use-in-production';

/** 管理员默认账号（仅首次播种使用，生产环境强烈建议通过环境变量覆盖） */
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const DEFAULT_ADMIN_EMAIL = 'admin@ethhy.com';

/** 开发环境默认应用地址 */
const DEV_APP_URL = 'http://localhost:3000';

// ============================================================
// JWT_SECRET 解析
// ============================================================

/** 是否已就 JWT_SECRET 缺失输出过警告（避免日志刷屏） */
let warnedAboutSecret = false;

/** 缓存从 DATABASE_URL 派生的密钥（避免每次请求都计算哈希） */
let derivedSecret: string | null = null;

/** JWT 密钥来源类型 */
export type JwtSecretSource = 'env' | 'derived' | 'fallback';

/**
 * 获取 JWT 密钥（严格版本，供签发 / 验证令牌使用）
 *
 * 优先级：
 *   1. JWT_SECRET 环境变量（推荐，生产环境必须配置）
 *   2. 生产环境：从 DATABASE_URL 派生（回退方案，避免 500 错误）
 *   3. 开发环境：使用不安全的回退值
 */
export function getJwtSecret(): string {
  // 1. 优先使用显式配置的 JWT_SECRET
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  // 2. 生产环境回退：从 DATABASE_URL 派生密钥
  if (process.env.NODE_ENV === 'production') {
    if (derivedSecret) return derivedSecret;

    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      if (!warnedAboutSecret) {
        warnedAboutSecret = true;
        console.error(
          'CRITICAL: JWT_SECRET 未配置，正在从 DATABASE_URL 派生密钥作为回退。' +
            '请立即在环境变量中配置 JWT_SECRET 以确保安全。' +
            '生成命令: openssl rand -base64 32'
        );
      }
      // 使用 SHA-256 从 DATABASE_URL 派生固定密钥
      derivedSecret = crypto.createHash('sha256').update(dbUrl).digest('hex');
      return derivedSecret;
    }

    // DATABASE_URL 也不可用时才抛出（正常运行不会走到这里）
    throw new Error(
      'JWT_SECRET 和 DATABASE_URL 均未配置。请在环境变量中添加 JWT_SECRET。'
    );
  }

  // 3. 开发环境回退
  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn(
      'WARNING: JWT_SECRET 未配置，正在使用不安全的开发回退值。' +
        '生产环境部署前必须配置 JWT_SECRET 环境变量。'
    );
  }

  return FALLBACK_SECRET;
}

/**
 * 非抛错地探测 JWT 密钥及其来源（供 getEnv() 安全读取，不产生副作用）
 */
function peekJwtSecret(): { value: string; source: JwtSecretSource } {
  if (process.env.JWT_SECRET) {
    return { value: process.env.JWT_SECRET, source: 'env' };
  }
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    return {
      value: crypto.createHash('sha256').update(process.env.DATABASE_URL).digest('hex'),
      source: 'derived',
    };
  }
  return { value: FALLBACK_SECRET, source: 'fallback' };
}

// ============================================================
// 应用 URL 解析
// ============================================================

/** 应用 URL 来源类型 */
export type AppUrlSource = 'env' | 'platform' | 'default';

/**
 * 获取应用 URL
 *
 * 优先级：
 *   1. NEXT_PUBLIC_APP_URL 环境变量（显式配置，推荐）
 *   2. CF_PAGES_URL（Cloudflare 部署时自动注入）
 *   3. VERCEL_URL（Vercel 部署时自动注入，自动补 https:// 前缀）
 *   4. 开发环境默认 http://localhost:3000
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  // Cloudflare 部署时自动注入 CF_PAGES_URL
  if (process.env.CF_PAGES_URL) {
    return process.env.CF_PAGES_URL;
  }

  // Vercel 部署时自动注入 VERCEL_URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return DEV_APP_URL;
}

/** 非抛错地探测应用 URL 及其来源 */
function peekAppUrl(): { value: string; source: AppUrlSource } {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return { value: process.env.NEXT_PUBLIC_APP_URL, source: 'env' };
  }
  if (process.env.CF_PAGES_URL) {
    return { value: process.env.CF_PAGES_URL, source: 'platform' };
  }
  if (process.env.VERCEL_URL) {
    return { value: `https://${process.env.VERCEL_URL}`, source: 'platform' };
  }
  return { value: DEV_APP_URL, source: 'default' };
}

// ============================================================
// 管理员账号
// ============================================================

/** 管理员账号信息 */
export interface AdminCredentials {
  username: string;
  password: string;
  email: string;
}

/**
 * 获取管理员账号信息（未配置时使用默认值）
 */
export function getAdminCredentials(): AdminCredentials {
  return {
    username: process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
    email: process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL,
  };
}

// ============================================================
// getEnv() —— 统一安全访问
// ============================================================

/** 环境变量聚合配置（已应用默认值与派生逻辑） */
export interface EnvConfig {
  /** 运行环境：development / production */
  nodeEnv: string;
  /** 部署平台标识 */
  platform: 'cloudflare' | 'vercel' | 'unknown';
  /** 平台注入的部署 URL（可能为空） */
  platformUrl: string | null;

  /** 数据库连接字符串 */
  databaseUrl: string | null;

  /** 已解析的 JWT 密钥（实际值，敏感） */
  jwtSecret: string;
  /** JWT 密钥来源 */
  jwtSecretSource: JwtSecretSource;

  /** 已解析的应用 URL */
  appUrl: string;
  /** 应用 URL 来源 */
  appUrlSource: AppUrlSource;

  /** 管理员账号 */
  admin: AdminCredentials;

  /** GitHub OAuth Client ID（未配置为 null） */
  githubClientId: string | null;
  /** GitHub OAuth Client Secret（未配置为 null） */
  githubClientSecret: string | null;
  /** GitHub OAuth 是否就绪（ID 与 Secret 均已配置） */
  githubOAuthEnabled: boolean;

  /** GitHub Token（只读，用于提高 API 速率限制） */
  githubToken: string | null;
  /** GitHub Token 是否已配置 */
  githubTokenEnabled: boolean;

  /** Resend API 是否已配置（用于邮件发送） */
  emailEnabled: boolean;
}

/**
 * 获取所有环境变量的安全聚合访问
 */
export function getEnv(): EnvConfig {
  const jwt = peekJwtSecret();
  const appUrl = peekAppUrl();
  const admin = getAdminCredentials();

  // 检测部署平台
  const isCloudflare = Boolean(process.env.CF_PAGES_URL || process.env.CF_PAGES);
  const isVercel = Boolean(process.env.VERCEL);
  const platform: 'cloudflare' | 'vercel' | 'unknown' = isCloudflare ? 'cloudflare' : isVercel ? 'vercel' : 'unknown';
  const platformUrl = process.env.CF_PAGES_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    platform,
    platformUrl,

    databaseUrl: process.env.DATABASE_URL || null,

    jwtSecret: jwt.value,
    jwtSecretSource: jwt.source,

    appUrl: appUrl.value,
    appUrlSource: appUrl.source,

    admin,

    githubClientId: process.env.GITHUB_CLIENT_ID || null,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET || null,
    githubOAuthEnabled: Boolean(
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ),

    githubToken: process.env.GITHUB_TOKEN || null,
    githubTokenEnabled: Boolean(process.env.GITHUB_TOKEN),

    emailEnabled: Boolean(process.env.RESEND_API_KEY || (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)),
  };
}

// ============================================================
// 掩码工具与配置摘要
// ============================================================

/** 将敏感字符串掩码处理 */
function maskSecret(value: string | null | undefined): string {
  if (!value) return '(未配置)';
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}...${value.slice(-4)}（长度 ${value.length}）`;
}

/** 掩码数据库连接字符串 */
function maskDbUrl(url: string | null | undefined): string {
  if (!url) return '(未配置)';
  return url.replace(/:[^:@/]*@/, ':****@');
}

/** 是否已打印过配置摘要 */
let summaryPrinted = false;

/**
 * 打印环境变量配置状态摘要（不泄露敏感值）
 */
function printEnvSummary(): void {
  if (summaryPrinted) return;
  summaryPrinted = true;

  const jwt = peekJwtSecret();
  const appUrl = peekAppUrl();
  const isCloudflare = Boolean(process.env.CF_PAGES_URL || process.env.CF_PAGES);
  const isVercel = Boolean(process.env.VERCEL);
  const platformLabel = isCloudflare ? ' (Cloudflare)' : isVercel ? ' (Vercel)' : '';

  const jwtDisplay =
    jwt.source === 'env'
      ? maskSecret(process.env.JWT_SECRET)
      : jwt.source === 'derived'
        ? '(由 DATABASE_URL 派生，未显式配置)'
        : '(开发回退值，未显式配置)';

  const lines = [
    '━━━━━━━━━━━━━━ 环境变量配置摘要 ━━━━━━━━━━━━━━',
    `  运行环境       : ${process.env.NODE_ENV || 'development'}${platformLabel}`,
    `  DATABASE_URL   : ${maskDbUrl(process.env.DATABASE_URL)}`,
    `  JWT_SECRET     : ${jwtDisplay} [来源: ${jwt.source}]`,
    `  APP_URL        : ${appUrl.value} [来源: ${appUrl.source}]`,
    `  ADMIN_USERNAME : ${process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME}${process.env.ADMIN_USERNAME ? '' : ' (默认)'}`,
    `  ADMIN_PASSWORD : ${process.env.ADMIN_PASSWORD ? '**** (已配置)' : '(默认)'}`,
    `  ADMIN_EMAIL    : ${process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL}${process.env.ADMIN_EMAIL ? '' : ' (默认)'}`,
    `  GITHUB OAuth   : ${process.env.GITHUB_CLIENT_ID ? '已配置 Client ID' : '(未配置)'}`,
    `  GITHUB_TOKEN   : ${process.env.GITHUB_TOKEN ? '已配置 (只读, 提高API限速)' : '(未配置, 速率限制60/h)'}`,
    `  RESEND_API_KEY : ${process.env.RESEND_API_KEY ? '已配置 (邮件发送可用)' : '(未配置, 邮件功能不可用)'}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ];

  console.log(lines.join('\n'));
}

// 模块加载时打印一次配置摘要
printEnvSummary();
