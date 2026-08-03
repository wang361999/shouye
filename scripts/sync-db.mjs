import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// 缺失的表的 DDL（列名使用 snake_case，与 Prisma @map 一致）
const DDL_STATEMENTS = [
  // Collection（收藏夹）
  `CREATE TABLE IF NOT EXISTS Collection (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    user_id TEXT NOT NULL,
    is_public INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(id)
  )`,

  // CollectionItem（收藏项）
  `CREATE TABLE IF NOT EXISTS CollectionItem (
    id TEXT PRIMARY KEY NOT NULL,
    collection_id TEXT NOT NULL,
    post_id TEXT,
    tool_id TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (collection_id) REFERENCES Collection(id),
    FOREIGN KEY (post_id) REFERENCES Post(id),
    FOREIGN KEY (tool_id) REFERENCES Tool(id)
  )`,

  // Conversation（私信会话）
  `CREATE TABLE IF NOT EXISTS Conversation (
    id TEXT PRIMARY KEY NOT NULL,
    participant1_id TEXT NOT NULL,
    participant2_id TEXT NOT NULL,
    last_message_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant1_id) REFERENCES User(id),
    FOREIGN KEY (participant2_id) REFERENCES User(id)
  )`,

  // Message（私信消息）
  `CREATE TABLE IF NOT EXISTS Message (
    id TEXT PRIMARY KEY NOT NULL,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES Conversation(id),
    FOREIGN KEY (sender_id) REFERENCES User(id)
  )`,

  // Badge（徽章）
  `CREATE TABLE IF NOT EXISTS Badge (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT NOT NULL,
    type TEXT DEFAULT 'manual',
    condition TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // UserBadge（用户徽章关联）
  `CREATE TABLE IF NOT EXISTS UserBadge (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(id),
    FOREIGN KEY (badge_id) REFERENCES Badge(id)
  )`,
];

// 创建索引（列名使用 snake_case）
const INDEX_STATEMENTS = [
  'CREATE INDEX IF NOT EXISTS idx_collection_user ON Collection(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_collection_item_collection ON CollectionItem(collection_id)',
  'CREATE INDEX IF NOT EXISTS idx_conversation_participants ON Conversation(participant1_id, participant2_id)',
  'CREATE INDEX IF NOT EXISTS idx_message_conversation ON Message(conversation_id)',
  'CREATE INDEX IF NOT EXISTS idx_message_sender ON Message(sender_id)',
  'CREATE INDEX IF NOT EXISTS idx_user_badge_user ON UserBadge(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_user_badge_badge ON UserBadge(badge_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_badge_name ON Badge(name)',
];

console.log('开始同步数据库 schema...');

for (const ddl of DDL_STATEMENTS) {
  const tableName = ddl.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || '?';
  try {
    await client.execute(ddl);
    console.log(`✅ 表 ${tableName} 创建成功`);
  } catch (err) {
    console.error(`❌ 表 ${tableName} 创建失败: ${err.message}`);
  }
}

for (const idx of INDEX_STATEMENTS) {
  const idxName = idx.match(/idx_\w+/)?.[0] || '?';
  try {
    await client.execute(idx);
    console.log(`✅ 索引 ${idxName} 创建成功`);
  } catch (err) {
    console.error(`❌ 索引 ${idxName} 创建失败: ${err.message}`);
  }
}

// 验证
const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
const tables = result.rows.map(r => r[0]).filter(t => !String(t).startsWith('_') && t !== 'sqlite_sequence');
console.log(`\n数据库现有 ${tables.length} 个表:`);
tables.forEach(t => console.log('  ' + t));
console.log('\n数据库同步完成！');
