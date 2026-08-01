/**
 * 集中式环境变量管理模块
 *
 * 设计目标：
 *   1. 自动从 DATABASE_URL 派生 JWT_SECRET（如果未显式配置），避免部署时因缺失密钥而 500
 *   2. 自动从 VERCEL_URL 派生 NEXT_PUBLIC_APP_URL（如果未显式配置），适配 Vercel 预览部署
 *   3. 提供 ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL 的默认值，零配置即可播种
 *   4. 通过 getEnv() 统一、安全地访问所有环境变量（已应用默认值与派生逻辑）
 *   5. 在模块首次加载时打印配置状态摘要（仅显示是否配置 / 掩码值，不泄露敏感信息）
 *
 * 注意：
 *   - 本模块在顶层不做任何可能抛出异常的操作，确保 Next.js 构建阶段安全加载
 *   - 严格的运行时校验放在 getJwtSecret() 中，仅在真正使用密钥时触发
 *   - 参考实现源自 lib/auth.ts 的 getJwtSecret，现已统一收敛到本模块
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
 *
 * 注意：方案 2 不是最佳安全实践，请尽快在 Vercel 中显式配置 JWT_SECRET。
 *      方案 3 仅用于本地开发，生产环境部署前必须配置 JWT_SECRET。
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
            '请立即在 Vercel 项目设置中配置 JWT_SECRET 环境变量以确保安全。' +
            '生成命令: openssl rand -base64 32'
        );
      }
      // 使用 SHA-256 从 DATABASE_URL 派生固定密钥
      derivedSecret = crypto.createHash('sha256').update(dbUrl).digest('hex');
      return derivedSecret;
    }

    // DATABASE_URL 也不可用时才抛出（正常运行不会走到这里）
    throw new Error(
      'JWT_SECRET 和 DATABASE_URL 均未配置。请在 Vercel 项目设置中添加 JWT_SECRET。'
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
 *
 * 与 getJwtSecret() 的区别：
 *   - 不输出警告日志
 *   - 不抛出异常（即使生产环境缺失也会回退到 fallback）
 *   - 不写入缓存，纯只读探测
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
export type AppUrlSource = 'env' | 'vercel' | 'default';

/**
 * 获取应用 URL
 *
 * 优先级：
 *   1. NEXT_PUBLIC_APP_URL 环境变量（显式配置）
 *   2. VERCEL_URL（Vercel 部署时自动注入，自动补 https:// 前缀）
 *   3. 开发环境默认 http://localhost:3000
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  // Vercel 部署时自动注入 VERCEL_URL（形如 xxx.vercel.app）
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
  if (process.env.VERCEL_URL) {
    return { value: `https://${process.env.VERCEL_URL}`, source: 'vercel' };
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
 * 注意：默认值仅用于首次播种，生产环境强烈建议通过环境变量覆盖。
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
  /** 是否运行在 Vercel 平台 */
  isVercel: boolean;
  /** Vercel 注入的部署 URL（可能为空） */
  vercelUrl: string | null;

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

  /** 是否启用 Vercel KV 分布式限流 */
  kvEnabled: boolean;
}

/**
 * 获取所有环境变量的安全聚合访问
 *
 * 返回的对象已应用全部默认值与派生逻辑，所有字段均为非空（除显式标注可空的字段），
 * 不会因环境变量缺失而抛出异常，适合在应用任意位置统一读取配置。
 *
 * 注意：返回对象中包含 jwtSecret、admin.password 等敏感明文值，请勿将其输出到日志或响应体。
 */
export function getEnv(): EnvConfig {
  const jwt = peekJwtSecret();
  const appUrl = peekAppUrl();
  const admin = getAdminCredentials();

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    isVercel: Boolean(process.env.VERCEL),
    vercelUrl: process.env.VERCEL_URL || null,

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

    kvEnabled: Boolean(
      process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ),
  };
}

// ============================================================
// 掩码工具与配置摘要
// ============================================================

/** 将敏感字符串掩码处理（仅保留首尾少量字符与长度，不泄露实际值） */
function maskSecret(value: string | null | undefined): string {
  if (!value) return '(未配置)';
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}...${value.slice(-4)}（长度 ${value.length}）`;
}

/** 掩码数据库连接字符串（隐藏密码部分） */
function maskDbUrl(url: string | null | undefined): string {
  if (!url) return '(未配置)';
  // 隐藏 :password@ 中的密码
  return url.replace(/:[^:@/]*@/, ':****@');
}

/** 是否已打印过配置摘要（每个进程只打印一次，避免日志刷屏） */
let summaryPrinted = false;

/**
 * 打印环境变量配置状态摘要（不泄露敏感值）
 * 在模块首次加载时自动调用一次。
 */
function printEnvSummary(): void {
  if (summaryPrinted) return;
  summaryPrinted = true;

  const jwt = peekJwtSecret();
  const appUrl = peekAppUrl();

  // JWT_SECRET 仅在显式配置时掩码展示，派生 / 回退场景只说明来源
  const jwtDisplay =
    jwt.source === 'env'
      ? maskSecret(process.env.JWT_SECRET)
      : jwt.source === 'derived'
        ? '(由 DATABASE_URL 派生，未显式配置)'
        : '(开发回退值，未显式配置)';

  const lines = [
    '━━━━━━━━━━━━━━ 环境变量配置摘要 ━━━━━━━━━━━━━━',
    `  运行环境       : ${process.env.NODE_ENV || 'development'}${process.env.VERCEL ? ' (Vercel)' : ''}`,
    `  DATABASE_URL   : ${maskDbUrl(process.env.DATABASE_URL)}`,
    `  JWT_SECRET     : ${jwtDisplay} [来源: ${jwt.source}]`,
    `  APP_URL        : ${appUrl.value} [来源: ${appUrl.source}]`,
    `  ADMIN_USERNAME : ${process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME}${process.env.ADMIN_USERNAME ? '' : ' (默认)'}`,
    `  ADMIN_PASSWORD : ${process.env.ADMIN_PASSWORD ? '**** (已配置)' : '(默认)'}`,
    `  ADMIN_EMAIL    : ${process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL}${process.env.ADMIN_EMAIL ? '' : ' (默认)'}`,
    `  GITHUB OAuth   : ${process.env.GITHUB_CLIENT_ID ? '已配置 Client ID' : '(未配置)'}`,
    `  Vercel KV 限流 : ${process.env.KV_REST_API_URL ? '已启用' : '(未启用，使用内存限流)'}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ];

  console.log(lines.join('\n'));
}

// 模块加载时打印一次配置摘要（不泄露敏感值，不抛异常）
printEnvSummary();
