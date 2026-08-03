/**
 * 修复 sync-db.mjs 创建的表中 camelCase 列名 → snake_case
 * Prisma schema 使用 @map("snake_case") 映射，但 sync-db.mjs DDL 用了 camelCase
 */
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// 需要修复的表和列映射: camelCase → snake_case
const FIXES = [
  // Badge
  { table: 'Badge', from: 'createdAt', to: 'created_at' },
  // Collection
  { table: 'Collection', from: 'userId', to: 'user_id' },
  { table: 'Collection', from: 'isPublic', to: 'is_public' },
  { table: 'Collection', from: 'createdAt', to: 'created_at' },
  { table: 'Collection', from: 'updatedAt', to: 'updated_at' },
  // CollectionItem
  { table: 'CollectionItem', from: 'collectionId', to: 'collection_id' },
  { table: 'CollectionItem', from: 'postId', to: 'post_id' },
  { table: 'CollectionItem', from: 'toolId', to: 'tool_id' },
  { table: 'CollectionItem', from: 'createdAt', to: 'created_at' },
  // Conversation
  { table: 'Conversation', from: 'participant1Id', to: 'participant1_id' },
  { table: 'Conversation', from: 'participant2Id', to: 'participant2_id' },
  { table: 'Conversation', from: 'lastMessageAt', to: 'last_message_at' },
  { table: 'Conversation', from: 'createdAt', to: 'created_at' },
  // Message
  { table: 'Message', from: 'conversationId', to: 'conversation_id' },
  { table: 'Message', from: 'senderId', to: 'sender_id' },
  { table: 'Message', from: 'isRead', to: 'is_read' },
  { table: 'Message', from: 'createdAt', to: 'created_at' },
  // UserBadge
  { table: 'UserBadge', from: 'userId', to: 'user_id' },
  { table: 'UserBadge', from: 'badgeId', to: 'badge_id' },
  { table: 'UserBadge', from: 'awardedAt', to: 'awarded_at' },
];

async function getColumns(table) {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return result.rows.map(r => r.name);
}

async function columnExists(table, col) {
  const cols = await getColumns(table);
  return cols.includes(col);
}

async function fixTable() {
  console.log('开始修复列名...\n');

  for (const fix of FIXES) {
    const hasOld = await columnExists(fix.table, fix.from);
    const hasNew = await columnExists(fix.table, fix.to);

    if (hasNew) {
      console.log(`✅ ${fix.table}.${fix.to} 已存在，跳过`);
      continue;
    }

    if (!hasOld) {
      console.log(`⚠️ ${fix.table}.${fix.from} 不存在，跳过`);
      continue;
    }

    try {
      // SQLite/LibSQL: ALTER TABLE ... RENAME COLUMN
      await client.execute(`ALTER TABLE ${fix.table} RENAME COLUMN "${fix.from}" TO "${fix.to}"`);
      console.log(`✅ ${fix.table}: ${fix.from} → ${fix.to}`);
    } catch (e) {
      console.error(`❌ ${fix.table}: ${fix.from} → ${fix.to} 失败: ${e.message}`);
    }
  }

  // 验证所有表结构
  console.log('\n=== 验证表结构 ===');
  const tables = ['Badge', 'Collection', 'CollectionItem', 'Conversation', 'Message', 'UserBadge'];
  for (const table of tables) {
    try {
      const cols = await getColumns(table);
      console.log(`${table}: ${cols.join(', ')}`);
    } catch (e) {
      console.log(`${table}: 查询失败 - ${e.message}`);
    }
  }

  console.log('\n修复完成！');
}

fixTable().catch(err => {
  console.error('修复失败:', err);
  process.exit(1);
});
