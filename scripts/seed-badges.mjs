/**
 * 徽章种子脚本 - 向数据库插入预设徽章
 *
 * 预设徽章列表：
 *   🌱 新手起步 (postCount >= 1, auto)
 *   📝 勤奋作者 (postCount >= 10, auto)
 *   💬 话唠 (commentCount >= 50, auto)
 *   ⭐ 社区之星 (reputation >= 100, auto)
 *   🏆 传奇大师 (reputation >= 500, auto)
 *   🎖️ 官方认证 (manual)
 *
 * 使用 upsert 避免重复插入，脚本可重复执行（幂等）。
 *
 * 用法：
 *   node scripts/seed-badges.mjs
 *
 * 环境变量：
 *   DATABASE_URL          - 数据库连接字符串（必需）
 *   DATABASE_AUTH_TOKEN   - Turso 数据库认证 token（可选）
 */
import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url) {
  console.error('❌ DATABASE_URL 未配置，无法执行徽章种子脚本。');
  console.error('   请在 .env 文件或环境变量中设置 DATABASE_URL。');
  process.exit(1);
}

// 预设徽章定义
const BADGES = [
  {
    name: '新手起步',
    description: '发布第一篇帖子，开启社区之旅',
    icon: '🌱',
    type: 'auto',
    condition: JSON.stringify({ field: 'postCount', operator: '>=', value: 1 }),
  },
  {
    name: '勤奋作者',
    description: '累计发布 10 篇帖子，持续输出优质内容',
    icon: '📝',
    type: 'auto',
    condition: JSON.stringify({ field: 'postCount', operator: '>=', value: 10 }),
  },
  {
    name: '话唠',
    description: '累计发表 50 条评论，活跃于社区讨论',
    icon: '💬',
    type: 'auto',
    condition: JSON.stringify({ field: 'commentCount', operator: '>=', value: 50 }),
  },
  {
    name: '社区之星',
    description: '声望值达到 100，获得社区认可',
    icon: '⭐',
    type: 'auto',
    condition: JSON.stringify({ field: 'reputation', operator: '>=', value: 100 }),
  },
  {
    name: '传奇大师',
    description: '声望值达到 500，成为社区传奇人物',
    icon: '🏆',
    type: 'auto',
    condition: JSON.stringify({ field: 'reputation', operator: '>=', value: 500 }),
  },
  {
    name: '官方认证',
    description: '由官方认证的特殊身份徽章',
    icon: '🎖️',
    type: 'manual',
    condition: null,
  },
];

async function main() {
  console.log('🏅 开始播种徽章数据...\n');

  const db = createClient({ url, authToken });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const badge of BADGES) {
    try {
      // 先查询徽章是否存在（按 name 唯一）
      const existing = await db.execute({
        sql: 'SELECT id FROM Badge WHERE name = ?',
        args: [badge.name],
      });

      if (existing.rows.length > 0) {
        // 已存在，使用 UPDATE 保持幂等（更新描述/图标/类型/条件）
        const existingId = existing.rows[0].id;
        await db.execute({
          sql: `UPDATE Badge
                SET description = ?, icon = ?, type = ?, condition = ?
                WHERE id = ?`,
          args: [badge.description, badge.icon, badge.type, badge.condition, existingId],
        });
        updated++;
        console.log(`🔄 更新徽章: ${badge.icon} ${badge.name}`);
      } else {
        // 不存在，插入新徽章
        await db.execute({
          sql: `INSERT INTO Badge (id, name, description, icon, type, condition, created_at)
                VALUES (lower(hex(randomblob(8))), ?, ?, ?, ?, ?, datetime('now'))`,
          args: [badge.name, badge.description, badge.icon, badge.type, badge.condition],
        });
        created++;
        console.log(`✅ 创建徽章: ${badge.icon} ${badge.name}`);
      }
    } catch (err) {
      skipped++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`⚠️  徽章 "${badge.name}" 处理失败: ${msg}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏅 徽章种子完成:`);
  console.log(`   新建: ${created}`);
  console.log(`   更新: ${updated}`);
  console.log(`   跳过: ${skipped}`);
  console.log(`   总计: ${BADGES.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ 徽章种子脚本执行失败:', err instanceof Error ? err.message : err);
  process.exit(1);
});
