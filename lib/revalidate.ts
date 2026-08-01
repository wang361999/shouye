/**
 * 按需重新验证缓存工具
 *
 * 在写操作（创建/删除/更新帖子、召集令等）成功后调用，
 * 触发对应路由的 ISR 缓存失效，确保前端立即拿到最新数据。
 */
import { revalidatePath } from 'next/cache';

/**
 * 重新验证社区首页聚合数据缓存
 *
 * 触发 /api/community/home 与首页路由 / 重新生成，
 * 删除/创建帖子或召集令后调用，避免旧数据残留。
 */
export function revalidateCommunityHome(): void {
  try {
    revalidatePath('/api/community/home');
    revalidatePath('/');
  } catch (error) {
    // revalidatePath 仅在运行时可用，构建阶段或某些环境可能抛错，忽略即可
    console.error('[REVALIDATE COMMUNITY HOME ERROR]', error);
  }
}
