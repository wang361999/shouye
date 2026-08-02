/**
 * 为社区首页查询添加数据库索引
 *
 * 直接对 Turso 执行 CREATE INDEX，无需 Prisma migrate。
 * 幂等设计：IF NOT EXISTS 确保可重复执行。
 */
import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url) {
  console.error('❌ DATABASE_URL 未配置');
  process.exit(1);
}

const db = createClient({ url, authToken });

const indexes = [
  // Post 表 — 社区首页最新帖子和热门帖子查询
  {
    name: 'idx_post_status_created_at',
    sql: 'CREATE INDEX IF NOT EXISTS idx_post_status_created_at ON Post (status, created_at)',
    desc: '最新帖子：WHERE status + ORDER BY created_at',
  },
  {
    name: 'idx_post_status_like_view',
    sql: 'CREATE INDEX IF NOT EXISTS idx_post_status_like_view ON Post (status, like_count, view_count)',
    desc: '热门帖子：WHERE status + ORDER BY like_count, view_count',
  },
  // User 表 — 活跃成员查询
  {
    name: 'idx_user_status_post_comment',
    sql: 'CREATE INDEX IF NOT EXISTS idx_user_status_post_comment ON User (status, post_count, comment_count)',
    desc: '活跃成员：WHERE status + ORDER BY post_count, comment_count',
  },
  // Comment 表 — 社区统计中的评论数
  {
    name: 'idx_comment_deleted_approved',
    sql: 'CREATE INDEX IF NOT EXISTS idx_comment_deleted_approved ON Comment (deleted_at, is_approved)',
    desc: '评论统计：WHERE deleted_at IS NULL AND is_approved = 1',
  },
  // CollabProject 表 — 协作召集令查询
  {
    name: 'idx_collab_status_created',
    sql: 'CREATE INDEX IF NOT EXISTS idx_collab_status_created ON CollabProject (status, created_at)',
    desc: '协作召集令：WHERE status IN (...) + ORDER BY created_at',
  },
];

console.log('🔧 开始添加数据库索引...\n');

let success = 0;
let skipped = 0;

for (const idx of indexes) {
  try {
    await db.execute(idx.sql);
    console.log(`  ✅ ${idx.name} — ${idx.desc}`);
    success++;
  } catch (err) {
    if (err.message?.includes('already exists')) {
      console.log(`  ⏭️  ${idx.name} — 已存在，跳过`);
      skipped++;
    } else {
      console.error(`  ❌ ${idx.name} — ${err.message}`);
    }
  }
}

console.log(`\n📊 结果：${success} 个新建，${skipped} 个已存在，共 ${indexes.length} 个索引`);
console.log('✨ 索引添加完成！');
