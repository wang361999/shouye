import prisma from '@/lib/prisma';

/**
 * 发送通知给指定用户
 */
export async function sendNotification(params: {
  userId: string;       // 接收者用户ID
  type: string;         // reply | like | system | mention | authorize
  title: string;
  content?: string;
  link?: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        content: params.content || null,
        link: params.link || null,
      },
    });
  } catch (error) {
    console.error('[NOTIFY ERROR]', error);
  }
}

/**
 * 批量发送通知给所有管理员
 */
export async function notifyAllAdmins(params: {
  type: string;
  title: string;
  content?: string;
  link?: string;
}): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        sendNotification({
          ...params,
          userId: admin.id,
        })
      )
    );
  } catch (error) {
    console.error('[NOTIFY ADMINS ERROR]', error);
  }
}
