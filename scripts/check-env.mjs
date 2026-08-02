/**
 * 构建前环境变量检查
 *
 * 确保必需的环境变量已配置，否则在构建阶段就给出明确错误，
 * 避免部署后出现"页面正常但无数据"的难以排查的问题。
 *
 * 用法: node scripts/check-env.mjs
 */
const REQUIRED_ENVS = [
  { key: 'DATABASE_URL', desc: 'Turso/libsql 数据库连接地址 (libsql://...)' },
  { key: 'DATABASE_AUTH_TOKEN', desc: 'Turso/libsql 数据库认证令牌' },
  { key: 'JWT_SECRET', desc: 'JWT 签名密钥 (openssl rand -base64 32)' },
];

const OPTIONAL_ENVS = [
  { key: 'ADMIN_USERNAME', desc: '管理员用户名', default: 'admin' },
  { key: 'ADMIN_PASSWORD', desc: '管理员密码', default: 'admin123' },
  { key: 'ADMIN_EMAIL', desc: '管理员邮箱', default: 'admin@ethhy.com' },
  { key: 'NEXT_PUBLIC_APP_URL', desc: '应用公开 URL', default: '自动检测' },
];

function main() {
  console.log('━━━━━━━━━━━━━━ 环境变量检查 ━━━━━━━━━━━━━━');

  const missing = [];
  const warnings = [];

  // 检查必需变量
  for (const { key, desc } of REQUIRED_ENVS) {
    const value = process.env[key];
    if (!value) {
      missing.push({ key, desc });
      console.log(`  ❌ ${key}: 未配置`);
    } else {
      // 掩码显示
      const masked = value.length > 20
        ? `${value.substring(0, 10)}...${value.substring(value.length - 6)}`
        : '****';
      console.log(`  ✅ ${key}: ${masked}`);
    }
  }

  // 检查可选变量
  for (const { key, desc, default: defaultVal } of OPTIONAL_ENVS) {
    const value = process.env[key];
    if (!value) {
      warnings.push({ key, desc, defaultVal });
      console.log(`  ⚠️  ${key}: 未配置 (使用默认值: ${defaultVal})`);
    } else {
      console.log(`  ✅ ${key}: 已配置`);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (missing.length > 0) {
    console.error('\n❌ 构建中止：缺少必需的环境变量\n');
    console.error('请在部署平台配置以下环境变量：\n');
    for (const { key, desc } of missing) {
      console.error(`  ${key}`);
      console.error(`    说明: ${desc}`);
      console.error(`    Vercel:     Dashboard → Settings → Environment Variables`);
      console.error(`    Cloudflare: wrangler secret put ${key}`);
      console.error('');
    }
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  部分可选环境变量未配置，将使用默认值。');
    console.log('   生产环境建议显式配置所有环境变量。\n');
  }

  console.log('✅ 环境变量检查通过\n');
}

main();
