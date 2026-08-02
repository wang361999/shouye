import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/* eslint-disable @typescript-eslint/no-explicit-any */

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL || '';
  const authToken = process.env.DATABASE_AUTH_TOKEN || '';

  // 如果是 Turso/libsql 连接
  if (url.startsWith('libsql://') || url.startsWith('http://') || url.startsWith('https://')) {
    const adapter = new PrismaLibSql({ url, authToken });
    // Prisma 7.x 使用 adapter 时类型签名不同，用 any 绕过 TypeScript 检查
    return new (PrismaClient as any)({ adapter });
  }

  // 兼容本地 SQLite 文件（开发环境）
  if (url && url.startsWith('file:')) {
    return new (PrismaClient as any)({ datasources: { db: { url } } });
  }

  // DATABASE_URL 未配置时（如构建阶段）
  throw new Error(
    'DATABASE_URL 未配置。请在环境变量中设置 Turso 数据库连接地址。\n' +
    '格式：libsql://your-db.turso.io'
  );
}

/**
 * 创建惰性 Prisma 客户端代理
 *
 * 在构建阶段（DATABASE_URL 未配置时），PrismaClient 不会被实际创建，
 * 只有在运行时首次访问属性时才初始化，避免构建时因缺少数据库连接而失败。
 */
function createLazyPrismaClient(): PrismaClient {
  let client: PrismaClient | null = null;

  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      if (!client) {
        client = createPrismaClient();
      }
      const value = (client as any)[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    },
  });
}

// 使用惰性代理，构建时不会因缺少 DATABASE_URL 而崩溃
export const prisma = globalForPrisma.prisma || createLazyPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
