import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// 缺失的表的 DDL（从 Prisma schema 转换）
const DDL_STATEMENTS = [
  // Collection（收藏夹）
  `CREATE TABLE IF NOT EXISTS Collection (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    userId TEXT NOT NULL,
    isPublic INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id)
  )`,

  // CollectionItem（收藏项）
  `CREATE TABLE IF NOT EXISTS CollectionItem (
    id TEXT PRIMARY KEY NOT NULL,
    collectionId TEXT NOT NULL,
    postId TEXT,
    toolId TEXT,
    note TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (collectionId) REFERENCES Collection(id),
    FOREIGN KEY (postId) REFERENCES Post(id),
    FOREIGN KEY (toolId) REFERENCES Tool(id)
  )`,

  // Conversation（私信会话）
  `CREATE TABLE IF NOT EXISTS Conversation (
    id TEXT PRIMARY KEY NOT NULL,
    participant1Id TEXT NOT NULL,
    participant2Id TEXT NOT NULL,
    lastMessageAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant1Id) REFERENCES User(id),
    FOREIGN KEY (participant2Id) REFERENCES User(id)
  )`,

  // Message（私信消息）
  `CREATE TABLE IF NOT EXISTS Message (
    id TEXT PRIMARY KEY NOT NULL,
    conversationId TEXT NOT NULL,
    senderId TEXT NOT NULL,
    content TEXT NOT NULL,
    isRead INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversationId) REFERENCES Conversation(id),
    FOREIGN KEY (senderId) REFERENCES User(id)
  )`,

  // Badge（徽章）
  `CREATE TABLE IF NOT EXISTS Badge (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT NOT NULL,
    type TEXT DEFAULT 'manual',
    condition TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // UserBadge（用户徽章关联）
  `CREATE TABLE IF NOT EXISTS UserBadge (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    badgeId TEXT NOT NULL,
    awardedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id),
    FOREIGN KEY (badgeId) REFERENCES Badge(id)
  )`,
];

// 创建索引
const INDEX_STATEMENTS = [
  'CREATE INDEX IF NOT EXISTS idx_collection_user ON Collection(userId)',
  'CREATE INDEX IF NOT EXISTS idx_collection_item_collection ON CollectionItem(collectionId)',
  'CREATE INDEX IF NOT EXISTS idx_conversation_participants ON Conversation(participant1Id, participant2Id)',
  'CREATE INDEX IF NOT EXISTS idx_message_conversation ON Message(conversationId)',
  'CREATE INDEX IF NOT EXISTS idx_message_sender ON Message(senderId)',
  'CREATE INDEX IF NOT EXISTS idx_user_badge_user ON UserBadge(userId)',
  'CREATE INDEX IF NOT EXISTS idx_user_badge_badge ON UserBadge(badgeId)',
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
