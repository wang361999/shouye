import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const url = process.env.DATABASE_URL || '';
  const authToken = process.env.DATABASE_AUTH_TOKEN || '';

  // 如果是 Turso/libsql 连接
  if (url.startsWith('libsql://') || url.startsWith('http://') || url.startsWith('https://')) {
    const adapter = new PrismaLibSql({ url, authToken });
    return new PrismaClient({ adapter } as never);
  }

  // 兼容本地 SQLite 文件
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
