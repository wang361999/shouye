#!/usr/bin/env node
/**
 * 环境变量生成脚本
 *
 * 用途：
 *   - 生成本地开发或 CI/CD 所需的环境变量
 *   - 自动生成随机 JWT_SECRET（使用 crypto.randomBytes，足够安全）
 *   - 检测当前运行环境（Vercel / 本地）
 *   - 输出所有需要的环境变量及默认值
 *   - 可选写入 .env.local 文件（默认与已有内容合并，保留用户已配置的值）
 *
 * 用法：
 *   node scripts/generate-env.mjs                  # 仅打印到控制台
 *   node scripts/generate-env.mjs --write          # 合并写入 .env.local（保留已有值）
 *   node scripts/generate-env.mjs --write --force  # 覆盖写入 .env.local（用新值替换）
 *
 * 说明：
 *   - 本脚本仅使用 Node.js 内置模块，无需安装额外依赖
 *   - 与 lib/env.ts 的派生逻辑保持一致：未显式配置时从 VERCEL_URL 派生 NEXT_PUBLIC_APP_URL
 *   - .env.local 已在 .gitignore 中，不会提交到仓库
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const envLocalPath = join(projectRoot, '.env.local');

// ============================================================
// 命令行参数解析
// ============================================================
const args = process.argv.slice(2);
const shouldWrite = args.includes('--write');
const forceOverwrite = args.includes('--force');
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  console.log(`
Gitd 环境变量生成脚本

用法：
  node scripts/generate-env.mjs                  仅打印生成的环境变量到控制台
  node scripts/generate-env.mjs --write          合并写入 .env.local（保留已有值）
  node scripts/generate-env.mjs --write --force  覆盖写入 .env.local（替换已有值）

选项：
  --write   将生成的环境变量写入 .env.local
  --force   与 --write 配合使用，覆盖已存在的同名变量
  --help    显示本帮助信息
`);
  process.exit(0);
}

// ============================================================
// 工具函数
// ============================================================

/** 生成随机 JWT_SECRET（32 字节，base64 编码） */
function generateJwtSecret() {
  return randomBytes(32).toString('base64');
}

/**
 * 检测当前运行环境
 * @returns {'vercel' | 'local'}
 */
function detectEnvironment() {
  // Vercel 构建与运行时会注入 VERCEL 环境变量
  if (process.env.VERCEL) return 'vercel';
  return 'local';
}

/**
 * 解析 .env 文件内容为键值对
 * 支持忽略注释行与空行，去除值两侧引号
 * @param {string} content
 * @returns {Record<string, string>}
 */
function parseEnvFile(content) {
  const map = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    // 去除两侧匹配的引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) map[key] = value;
  }
  return map;
}

// ============================================================
// 构建环境变量集合
// ============================================================

/**
 * 构建所有需要的环境变量及默认值
 * 优先沿用当前进程已配置的值，其次使用合理默认值
 * @returns {Record<string, string>}
 */
function buildEnvVars() {
  const env = detectEnvironment();
  const hasVercelUrl = Boolean(process.env.VERCEL_URL);

  // NEXT_PUBLIC_APP_URL：优先显式配置，其次从 VERCEL_URL 派生（与 lib/env.ts 一致）
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (env === 'vercel' && hasVercelUrl ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  return {
    DATABASE_URL:
      process.env.DATABASE_URL ||
      'postgresql://user:password@localhost:5432/ethhy?schema=public',
    // JWT_SECRET 始终生成一个全新的随机值；写入时若已有值则按合并策略保留
    JWT_SECRET: generateJwtSecret(),
    NEXT_PUBLIC_APP_URL: appUrl,
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@ethhy.com',
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',
  };
}

/** 环境变量的分组与说明（用于格式化输出） */
const ENV_GROUPS = [
  {
    title: '数据库连接（必需）',
    note: '推荐使用 Neon (https://neon.tech) 免费 PostgreSQL 数据库',
    keys: ['DATABASE_URL'],
  },
  {
    title: 'JWT 密钥（必需）',
    note: '用于签发和验证用户登录令牌，已自动生成随机值',
    keys: ['JWT_SECRET'],
  },
  {
    title: '应用 URL',
    note: '站点访问地址，部署后改为实际域名',
    keys: ['NEXT_PUBLIC_APP_URL'],
  },
  {
    title: '管理员账号（可选，仅首次播种时使用）',
    note: '部署构建时会自动创建管理员账号，建议生产环境修改默认密码',
    keys: ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_EMAIL'],
  },
  {
    title: 'GitHub OAuth 登录配置（可选）',
    note: '也可在后台 安全设置 页面直接配置，无需填写此处',
    keys: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
  },
];

/**
 * 将环境变量格式化为 .env 文件文本
 * @param {Record<string, string>} vars
 * @returns {string}
 */
function formatEnvFile(vars) {
  const lines = [
    '# ============================================================',
    '# Gitd 环境变量配置',
    `# 生成时间：${new Date().toISOString()}`,
    `# 运行环境：${detectEnvironment()}`,
    '# 由 scripts/generate-env.mjs 生成（可手动修改）',
    '# ============================================================',
    '',
  ];

  for (const group of ENV_GROUPS) {
    lines.push(`# ---- ${group.title} ----`);
    if (group.note) lines.push(`# ${group.note}`);
    for (const key of group.keys) {
      lines.push(`${key}="${vars[key] ?? ''}"`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// 主流程
// ============================================================

function main() {
  const env = detectEnvironment();
  const newVars = buildEnvVars();

  // 读取已有的 .env.local（若存在）
  let existing = {};
  if (existsSync(envLocalPath)) {
    try {
      existing = parseEnvFile(readFileSync(envLocalPath, 'utf-8'));
    } catch (err) {
      console.warn(`⚠️  读取 .env.local 失败，将忽略已有内容：${err.message}`);
    }
  }

  // 合并策略：
  //   --force：用新生成的值覆盖已有值（仅 JWT_SECRET 等会变化）
  //   默认（含 --write 但不带 --force）：保留已有值，仅补充缺失项
  const effective = forceOverwrite
    ? { ...existing, ...newVars }
    : { ...newVars, ...existing };

  console.log('━━━━━━━━━━━━━━ 环境变量生成 ━━━━━━━━━━━━━━');
  console.log(`  运行环境      : ${env}${process.env.VERCEL_URL ? `（VERCEL_URL=${process.env.VERCEL_URL}）` : ''}`);
  console.log(`  .env.local    : ${existsSync(envLocalPath) ? '已存在' : '不存在'}`);
  console.log(`  写入模式      : ${shouldWrite ? (forceOverwrite ? '覆盖写入' : '合并写入（保留已有值）') : '仅打印（不写入）'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(formatEnvFile(effective));

  if (!shouldWrite) {
    console.log('提示：如需写入 .env.local，请加 --write 参数（默认保留已有值；加 --force 可覆盖）');
    return;
  }

  try {
    writeFileSync(envLocalPath, formatEnvFile(effective), 'utf-8');
    console.log(`✅ 已写入：${envLocalPath}`);
    if (!forceOverwrite && Object.keys(existing).length > 0) {
      const preserved = Object.keys(existing);
      console.log(`   已保留已有变量（${preserved.length} 个）：${preserved.join(', ')}`);
    }
    console.log('   注意：.env.local 含敏感信息，请勿提交到仓库（.gitignore 已忽略）。');
  } catch (err) {
    console.error(`❌ 写入 .env.local 失败：${err.message}`);
    process.exit(1);
  }
}

main();
