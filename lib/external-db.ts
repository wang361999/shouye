import { Pool } from 'pg';
import { getJwtSecret } from './env';

// 简单加解密（基于 JWT_SECRET 的 XOR 混淆，防止明文存储）
// 密钥延迟解析：避免模块加载阶段因密钥缺失而抛出异常（构建安全），
// 同时复用 env 模块的统一密钥派生逻辑（不再使用硬编码回退值）
let cachedSecret: string | null = null;
function getSecret(): string {
  if (cachedSecret === null) {
    cachedSecret = getJwtSecret();
  }
  return cachedSecret;
}

export function encryptPassword(text: string): string {
  try {
    const SECRET = getSecret();
    const result = Buffer.from(
      text.split('').map((char, i) => 
        String.fromCharCode(char.charCodeAt(0) ^ SECRET.charCodeAt(i % SECRET.length))
      ).join('')
    ).toString('base64');
    return result;
  } catch {
    return text;
  }
}

export function decryptPassword(encrypted: string): string {
  try {
    const SECRET = getSecret();
    const decoded = Buffer.from(encrypted, 'base64').toString('binary');
    return decoded.split('').map((char, i) =>
      String.fromCharCode(char.charCodeAt(0) ^ SECRET.charCodeAt(i % SECRET.length))
    ).join('');
  } catch {
    return encrypted;
  }
}

// 构建连接字符串
export function buildConnectionString(config: {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslMode: string;
}): string {
  const pwd = encodeURIComponent(config.password);
  const ssl = config.sslMode === 'disable' ? '?sslmode=disable' 
            : config.sslMode === 'require' ? '?sslmode=require'
            : '?sslmode=prefer';
  return `postgresql://${config.username}:${pwd}@${config.host}:${config.port}/${config.database}${ssl}`;
}

// 创建连接池（用完即关）
export async function withExternalPool<T>(
  config: { host: string; port: number; database: string; username: string; password: string; sslMode: string },
  fn: (pool: Pool) => Promise<T>,
): Promise<T> {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    max: 3, // 最小连接数
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000, // 10秒连接超时
    ssl: config.sslMode === 'require' ? { rejectUnauthorized: false } : config.sslMode === 'prefer' ? { rejectUnauthorized: false } : false,
  });

  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

// 测试连接
export async function testConnection(config: {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslMode: string;
}): Promise<{ ok: boolean; message: string; serverVersion?: string }> {
  try {
    const result = await withExternalPool(config, async (pool) => {
      const client = await pool.connect();
      try {
        const res = await client.query('SELECT version()');
        return res.rows[0]?.version || 'unknown';
      } finally {
        client.release();
      }
    });
    return { ok: true, message: '连接成功', serverVersion: result };
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知错误';
    return { ok: false, message: msg };
  }
}

// 获取数据库表列表
export async function getDatabaseTables(pool: Pool): Promise<Array<{ name: string; schema: string; type: string }>> {
  const res = await pool.query(`
    SELECT 
      table_name as name,
      table_schema as schema,
      table_type as type
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name
  `);
  return res.rows;
}

// 获取表结构
export async function getTableStructure(pool: Pool, tableName: string, schema = 'public'): Promise<{
  columns: Array<{ name: string; type: string; nullable: boolean; default: string | null; isPrimaryKey: boolean }>;
  rowCount: number;
  sizeBytes: number;
}> {
  // 列信息
  const colRes = await pool.query(`
    SELECT 
      column_name as name,
      data_type as type,
      is_nullable = 'YES' as nullable,
      column_default as default,
      EXISTS (
        SELECT 1 FROM information_schema.key_column_usage k
        JOIN information_schema.table_constraints tc ON k.constraint_name = tc.constraint_name
        WHERE k.table_name = $1 AND k.table_schema = $2
          AND tc.constraint_type = 'PRIMARY KEY'
          AND k.column_name = column_name
      ) as is_primary_key
    FROM information_schema.columns
    WHERE table_name = $1 AND table_schema = $2
    ORDER BY ordinal_position
  `, [tableName, schema]);

  // 行数估计
  const countRes = await pool.query(`SELECT count(*) as cnt FROM "${schema}"."${tableName}"`);
  const rowCount = parseInt(countRes.rows[0]?.cnt || '0', 10);

  // 表大小
  let sizeBytes = 0;
  try {
    const sizeRes = await pool.query(`
      SELECT pg_total_relation_size(relid) as size
      FROM pg_catalog.pg_statio_user_tables
      WHERE relname = $1
    `, [tableName]);
    sizeBytes = parseInt(sizeRes.rows[0]?.size || '0', 10);
  } catch {
    // 忽略
  }

  return {
    columns: colRes.rows.map((r) => ({
      name: r.name,
      type: r.type,
      nullable: r.nullable,
      default: r.default,
      isPrimaryKey: r.is_primary_key,
    })),
    rowCount,
    sizeBytes,
  };
}

// 查询表数据（分页）
export async function queryTableData(
  pool: Pool,
  tableName: string,
  schema = 'public',
  options: { page?: number; pageSize?: number; orderBy?: string; orderDir?: 'asc' | 'desc' } = {},
): Promise<{ rows: Record<string, unknown>[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(200, Math.max(1, options.pageSize || 50));
  const offset = (page - 1) * pageSize;

  // 安全的 ORDER BY（只允许列名，防止SQL注入）
  const orderBy = options.orderBy ? `"${options.orderBy.replace(/[^a-zA-Z0-9_]/g, '')}"` : '1';
  const orderDir = options.orderDir === 'desc' ? 'DESC' : 'ASC';

  // 获取总数
  const countRes = await pool.query(`SELECT count(*) as cnt FROM "${schema}"."${tableName}"`);
  const total = parseInt(countRes.rows[0]?.cnt || '0', 10);

  // 获取数据
  const dataRes = await pool.query(
    `SELECT * FROM "${schema}"."${tableName}" ORDER BY ${orderBy} ${orderDir} LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );

  return { rows: dataRes.rows, total, page, pageSize };
}

// 执行自定义 SQL
export async function executeQuery(
  pool: Pool,
  sql: string,
  limit = 100,
): Promise<{ rows: Record<string, unknown>[]; rowCount: number; fields: string[]; duration: number }> {
  const start = Date.now();
  const res = await pool.query(`${sql} LIMIT ${limit}`);
  const duration = Date.now() - start;
  const fields = res.fields.map((f) => f.name);
  return {
    rows: res.rows,
    rowCount: res.rowCount || 0,
    fields,
    duration,
  };
}

// 获取数据库概览
export async function getDatabaseOverview(pool: Pool): Promise<{
  dbSize: number;
  tableCount: number;
  tables: Array<{ name: string; schema: string; sizeBytes: number; rowCount: number }>;
  serverVersion: string;
}> {
  // 数据库版本
  const versionRes = await pool.query('SELECT version()');
  const serverVersion = versionRes.rows[0]?.version || 'unknown';

  // 数据库总大小
  let dbSize = 0;
  try {
    const sizeRes = await pool.query('SELECT pg_database_size(current_database()) as size');
    dbSize = parseInt(sizeRes.rows[0]?.size || '0', 10);
  } catch {
    // 忽略
  }

  // 所有表
  const tablesRes = await pool.query(`
    SELECT 
      c.relname as name,
      n.nspname as schema,
      pg_total_relation_size(c.oid) as size_bytes,
      c.reltuples::bigint as row_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND c.relkind = 'r'
    ORDER BY size_bytes DESC
  `);

  const tables = tablesRes.rows.map((r) => ({
    name: r.name,
    schema: r.schema,
    sizeBytes: parseInt(r.size_bytes || '0', 10),
    rowCount: parseInt(r.row_count || '0', 10),
  }));

  return {
    dbSize,
    tableCount: tables.length,
    tables,
    serverVersion,
  };
}
