'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import { useAppStore } from '@/lib/store';
import { formatTimeAgo, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ============ 类型定义 ============
interface Notification {
  id: string;
  userId: string;
  type: string; // reply | like | system | mention
  title: string;
  content: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

// ============ 通知类型 → 图标映射 ============
const NOTIFICATION_ICONS: Record<string, { icon: string; colorClass: string }> = {
  reply: {
    icon: '💬',
    colorClass: 'bg-blue-50 text-blue-600',
  },
  like: {
    icon: '❤️',
    colorClass: 'bg-red-50 text-red-600',
  },
  system: {
    icon: '📢',
    colorClass: 'bg-yellow-50 text-yellow-600',
  },
  mention: {
    icon: '👥',
    colorClass: 'bg-purple-50 text-purple-600',
  },
};

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const { user, token, hydrate, _hydrated } = useAppStore();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);

  // ============ 客户端水合 ============
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // ============ 获取通知列表 ============
  const fetchNotifications = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!token) return;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(PAGE_SIZE),
        });
        const res = await fetch(`/api/notifications?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || '获取通知失败');
        }
        const data = await res.json();
        const list: Notification[] = (data.data || []).map((n: any) => ({
          id: String(n.id),
          userId: String(n.userId),
          type: n.type,
          title: n.title,
          content: n.content,
          link: n.link,
          isRead: n.isRead,
          createdAt: n.createdAt,
        }));

        if (append) {
          setNotifications((prev) => [...prev, ...list]);
        } else {
          setNotifications(list);
        }
        setTotal(data.total || 0);
        setUnreadCount(data.unreadCount || 0);
        setTotalPages(data.totalPages || 1);
      } catch (err: any) {
        toast.error(err.message || '获取通知失败');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token],
  );

  // 首次加载
  useEffect(() => {
    if (user && token && _hydrated) {
      fetchNotifications(1, false);
    }
  }, [user, token, _hydrated, fetchNotifications]);

  // ============ 加载更多 ============
  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage, true);
  }

  // ============ 标记单条已读 ============
  async function handleMarkRead(notification: Notification) {
    if (!token || notification.isRead) return;

    // 乐观更新：立即标记为已读
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notificationId: notification.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '标记失败');
      }
    } catch (err: any) {
      // 回滚
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, isRead: false } : n,
        ),
      );
      setUnreadCount((prev) => prev + 1);
      toast.error(err.message || '标记已读失败');
    }
  }

  // ============ 全部已读 ============
  async function handleMarkAllRead() {
    if (!token || unreadCount === 0) return;

    setMarkingAll(true);
    // 乐观更新
    const prevUnread = unreadCount;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '操作失败');
      }
      const data = await res.json();
      toast.success(data.message || '已全部标记为已读');
    } catch (err: any) {
      // 回滚
      setNotifications((prev) =>
        prev.map((n, idx) =>
          idx < prevUnread ? { ...n, isRead: false } : n,
        ),
      );
      setUnreadCount(prevUnread);
      toast.error(err.message || '操作失败');
    } finally {
      setMarkingAll(false);
    }
  }

  // ============ 点击通知 ============
  function handleClickNotification(notification: Notification) {
    // 先标记已读
    if (!notification.isRead) {
      handleMarkRead(notification);
    }
  }

  // ============ 渲染：水合中 ============
  if (!_hydrated) {
    return (
      <Container className="py-16 text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-500">加载中...</p>
      </Container>
    );
  }

  // ============ 渲染：未登录 ============
  if (!user || !token) {
    return (
      <Container className="py-16 text-center">
        <div className="max-w-sm mx-auto bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">请先登录</h2>
          <p className="text-sm text-gray-500 mb-6">
            登录后即可查看你的通知消息
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            前往登录
          </Link>
        </div>
      </Container>
    );
  }

  // ============ 渲染：主内容 ============
  return (
    <Container className="py-8 max-w-3xl">
      {/* 返回链接 */}
      <Link
        href="/"
        className="inline-block text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
      >
        &larr; 返回首页
      </Link>

      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">🔔 通知中心</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {markingAll ? '处理中...' : '全部已读'}
          </button>
        )}
      </div>

      {/* 通知列表 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse flex items-start gap-3"
            >
              <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-5xl mb-3">🔔</p>
          <p className="text-gray-400">暂无通知</p>
          <p className="text-sm text-gray-400 mt-1">
            当有人回复或点赞你的内容时，会在这里提醒你
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {notifications.map((notification) => {
              const config =
                NOTIFICATION_ICONS[notification.type] ||
                NOTIFICATION_ICONS.system;

              const content = (
                <div
                  className={cn(
                    'bg-white rounded-lg border p-4 transition-all flex items-start gap-3',
                    notification.isRead
                      ? 'border-gray-200'
                      : 'border-blue-200 bg-blue-50/30',
                  )}
                >
                  {/* 图标 */}
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0',
                      config.colorClass,
                    )}
                  >
                    {config.icon}
                  </div>

                  {/* 内容区 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3
                        className={cn(
                          'text-sm font-medium truncate',
                          notification.isRead
                            ? 'text-gray-700'
                            : 'text-gray-900',
                        )}
                      >
                        {notification.title}
                      </h3>
                      {/* 未读蓝点 */}
                      {!notification.isRead && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                    {notification.content && (
                      <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                        {notification.content}
                      </p>
                    )}
                    <span className="text-xs text-gray-400 mt-1 inline-block">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>

                  {/* 跳转箭头 */}
                  {notification.link && (
                    <div className="flex-shrink-0 self-center text-gray-300">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              );

              // 有 link 则可点击跳转
              if (notification.link) {
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleClickNotification(notification)}
                  >
                    <Link
                      href={notification.link}
                      className="block hover:shadow-md transition-shadow cursor-pointer"
                    >
                      {content}
                    </Link>
                  </div>
                );
              }

              // 无 link 仅标记已读
              return (
                <div
                  key={notification.id}
                  onClick={() => handleClickNotification(notification)}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                >
                  {content}
                </div>
              );
            })}
          </div>

          {/* 加载更多 */}
          {page < totalPages && (
            <div className="text-center pt-6">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? '加载中...' : '加载更多'}
              </button>
              <p className="text-xs text-gray-400 mt-2">
                已加载 {notifications.length} / {total} 条
              </p>
            </div>
          )}
        </>
      )}
    </Container>
  );
}
