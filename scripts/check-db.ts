import { createClient } from '@libsql/client/http';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const db = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN!,
});

async function check() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');

  // 检查各表数据量
  const tables = ['User', 'Post', 'Category', 'Tag', 'Comment', 'CollabProject', 'Tool'];
  for (const table of tables) {
    try {
      const result = await db.execute({ sql: `SELECT COUNT(*) as count FROM ${table}`, args: [] });
      console.log(`${table}:`, result.rows[0]);
    } catch (e: any) {
      console.log(`${table} ERROR:`, e.message);
    }
  }

  // 检查帖子状态分布
  try {
    const result = await db.execute({ sql: 'SELECT status, COUNT(*) as count FROM Post GROUP BY status', args: [] });
    console.log('\nPost status distribution:');
    for (const row of result.rows) {
      console.log('  ', row);
    }
  } catch (e: any) {
    console.log('Post status ERROR:', e.message);
  }

  // 检查最近5条帖子
  try {
    const result = await db.execute({ sql: 'SELECT id, title, status, created_at FROM Post ORDER BY created_at DESC LIMIT 5', args: [] });
    console.log('\nRecent posts:');
    for (const row of result.rows) {
      console.log('  ', row);
    }
  } catch (e: any) {
    console.log('Recent posts ERROR:', e.message);
  }

  // 检查标签
  try {
    const result = await db.execute({ sql: 'SELECT id, name, slug, post_count FROM Tag ORDER BY post_count DESC LIMIT 10', args: [] });
    console.log('\nTop tags:');
    for (const row of result.rows) {
      console.log('  ', row);
    }
  } catch (e: any) {
    console.log('Tags ERROR:', e.message);
  }

  // 检查分类
  try {
    const result = await db.execute({ sql: 'SELECT id, name, slug, sort_order FROM Category ORDER BY sort_order ASC', args: [] });
    console.log('\nCategories:');
    for (const row of result.rows) {
      console.log('  ', row);
    }
  } catch (e: any) {
    console.log('Categories ERROR:', e.message);
  }

  // 检查 PostTag 关联
  try {
    const result = await db.execute({ sql: 'SELECT COUNT(*) as count FROM PostTag', args: [] });
    console.log('\nPostTag count:', result.rows[0]);
  } catch (e: any) {
    console.log('PostTag ERROR:', e.message);
  }

  // 检查协作项目
  try {
    const result = await db.execute({ sql: 'SELECT id, title, status FROM CollabProject ORDER BY created_at DESC LIMIT 5', args: [] });
    console.log('\nRecent CollabProjects:');
    for (const row of result.rows) {
      console.log('  ', row);
    }
  } catch (e: any) {
    console.log('CollabProject ERROR:', e.message);
  }

  // 检查表结构 - 看 Post 表是否存在
  try {
    const result = await db.execute({ sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", args: [] });
    console.log('\nAll tables:');
    for (const row of result.rows) {
      console.log('  ', row);
    }
  } catch (e: any) {
    console.log('Tables list ERROR:', e.message);
  }
}

check().catch(console.error);
