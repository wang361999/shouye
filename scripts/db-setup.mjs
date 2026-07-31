/**
 * 数据库初始化脚本（部署时自动执行）
 *
 * 功能：
 *   1. prisma db push   - 根据 schema.prisma 自动创建/更新表结构（无需手动迁移）
 *   2. prisma db seed   - 写入初始数据（管理员账号、分类、示例工具和帖子）
 *
 * 运行时机：
 *   - Vercel 构建阶段（package.json 的 vercel-build 脚本中调用）
 *   - 本地开发：npm run db:setup
 *
 * 安全说明：
 *   - 脚本仅在构建时运行一次，不影响运行时的 serverless 函数
 *   - seed.ts 内部做了幂等处理，重复运行不会产生重复数据
 *   - 如果 DATABASE_URL 未配置，脚本会跳过并给出警告（不阻断构建）
 */
import { execSync } from 'child_process';

function log(msg) {
  console.log(`[db-setup] ${msg}`);
}

function logError(msg) {
  console.error(`[db-setup] ❌ ${msg}`);
}

function logWarning(msg) {
  console.warn(`[db-setup] ⚠️  ${msg}`);
}

async function main() {
  // 检查 DATABASE_URL 是否配置
  if (!process.env.DATABASE_URL) {
    logWarning('未检测到 DATABASE_URL 环境变量，跳过数据库初始化。');
    logWarning('请在 Vercel 项目设置或 .env.local 中配置 DATABASE_URL 后重新部署。');
    // 不返回非零退出码，避免阻断构建流程
    // 构建本身不依赖数据库连接，只是运行时 API 会报错
    return;
  }

  log('开始数据库初始化...');
  log(`数据库类型：${process.env.DATABASE_URL.split('://')[0] || 'unknown'}`);

  // ============ 第一步：同步表结构 ============
  log('━━━ 步骤 1/2：同步数据库表结构 (prisma db push) ━━━');

  try {
    execSync('npx prisma db push --accept-data-loss', {
      stdio: 'inherit',
      env: process.env,
    });
    log('✅ 数据库表结构同步完成');
  } catch (error) {
    logError('数据库表结构同步失败');
    logError(`错误信息：${error.message}`);
    logWarning('构建将继续，但运行时 API 可能无法正常工作');
    logWarning('请检查 DATABASE_URL 是否正确，以及数据库是否可访问');
    return;
  }

  // ============ 第二步：写入初始数据 ============
  log('━━━ 步骤 2/2：写入初始数据 (prisma db seed) ━━━');

  try {
    execSync('npx tsx prisma/seed.ts', {
      stdio: 'inherit',
      env: process.env,
    });
    log('✅ 初始数据写入完成');
  } catch (error) {
    logError('初始数据写入失败');
    logError(`错误信息：${error.message}`);
    logWarning('表结构已创建，但初始数据未写入');
    logWarning('可稍后手动运行 npm run db:seed 重新播种');
  }

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('🎉 数据库初始化流程结束');
  log('');
  log('管理员登录信息：');
  log(`  用户名：${process.env.ADMIN_USERNAME || 'admin'}`);
  log(`  密码：${process.env.ADMIN_PASSWORD || 'admin123'}`);
  log(`  登录页：/admin/login`);
  log('');
}

main().catch((error) => {
  logError(`未预期的错误：${error.message}`);
  // 即使出错也不阻断构建
  process.exit(0);
});
