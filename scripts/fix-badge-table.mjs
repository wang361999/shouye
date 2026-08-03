/**
 * 修复 Badge 表列名不匹配
 * sync-db.mjs 创建了 color/requirement，但 Prisma schema 需要 type/condition
 */
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function fixBadgeTable() {
  console.log('检查 Badge 表当前结构...');

  // 查看现有列
  const columns = await client.execute("PRAGMA table_info(Badge)");
  const colNames = columns.rows.map(r => r.name);
  console.log('当前列:', colNames);

  // 添加缺失的列
  if (!colNames.includes('type')) {
    console.log('添加 type 列...');
    await client.execute("ALTER TABLE Badge ADD COLUMN type TEXT DEFAULT 'manual'");
    console.log('✅ type 列添加成功');
  } else {
    console.log('✅ type 列已存在，跳过');
  }

  if (!colNames.includes('condition')) {
    console.log('添加 condition 列...');
    await client.execute("ALTER TABLE Badge ADD COLUMN condition TEXT");
    console.log('✅ condition 列添加成功');
  } else {
    console.log('✅ condition 列已存在，跳过');
  }

  // 如果有旧的 color/requirement 列，迁移数据后删除（SQLite 不支持 DROP COLUMN < 3.35）
  // 但 LibSQL 支持DROP COLUMN
  if (colNames.includes('color')) {
    try {
      console.log('删除旧 color 列...');
      await client.execute("ALTER TABLE Badge DROP COLUMN color");
      console.log('✅ color 列已删除');
    } catch (e) {
      console.log('⚠️ 无法删除 color 列:', e.message);
    }
  }

  if (colNames.includes('requirement')) {
    try {
      console.log('删除旧 requirement 列...');
      // 如果 requirement 有数据，迁移到 condition
      const hasData = await client.execute("SELECT COUNT(*) as c FROM Badge WHERE requirement IS NOT NULL");
      if (Number(hasData.rows[0].c) > 0) {
        await client.execute("UPDATE Badge SET condition = requirement WHERE condition IS NULL AND requirement IS NOT NULL");
        console.log('✅ 数据已从 requirement 迁移到 condition');
      }
      await client.execute("ALTER TABLE Badge DROP COLUMN requirement");
      console.log('✅ requirement 列已删除');
    } catch (e) {
      console.log('⚠️ 无法删除 requirement 列:', e.message);
    }
  }

  // 确保 Badge 表有唯一索引 on name
  try {
    await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_badge_name ON Badge(name)");
    console.log('✅ Badge(name) 唯一索引已创建');
  } catch (e) {
    console.log('⚠️ 唯一索引创建失败:', e.message);
  }

  // 验证最终结构
  const finalCols = await client.execute("PRAGMA table_info(Badge)");
  console.log('\n修复后 Badge 表列:', finalCols.rows.map(r => `${r.name}(${r.type})`));
  console.log('\nBadge 表修复完成！');
}

fixBadgeTable().catch(err => {
  console.error('修复失败:', err);
  process.exit(1);
});
