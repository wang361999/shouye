/**
 * 后台操作日志共享函数
 * 消除 20+ 个 API 路由中重复的 prisma.operationLog.create 调用
 */
import prisma from './prisma';

export async function logOperation(
  userId: string,
  username: string,
  action: string,
  target?: string,
  detail?: string,
): Promise<void> {
  await prisma.operationLog.create({
    data: { userId, username, action, target, detail },
  });
}
