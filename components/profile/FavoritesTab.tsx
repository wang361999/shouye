'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface FavoritesTabProps {
  token: string | null;
  user: { id: string };
}

// 收藏夹内最近收藏的帖子摘要（与 /api/user/collections 返回结构一致）
interface CollectionRecentPost {
  id: string;
  title: string;
  createdAt: string;
  collectedAt: string;
  author: { id: string; username: string; avatar: string | null };
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  recentPosts: CollectionRecentPost[];
}

// ============ 收藏夹 Tab 组件 ============
// 顶部标题行 + 白色卡片列表，加载时骨架屏，空状态引导创建收藏夹
export default function FavoritesTab({ token, user }: FavoritesTabProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCollections = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/user/collections', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error('获取收藏夹失败');
      }
      const data = (await res.json()) as {
        collections: Collection[];
        total: number;
      };
      setCollections(data.collections ?? []);
    } catch {
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      fetchCollections();
    }
  }, [user, fetchCollections]);

  // ---- 加载骨架屏 ----
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-5 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-100 rounded w-16" />
            </div>
            <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* 顶部标题行 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">我的收藏夹</h2>
        <Link
          href="/forum/my/favorites"
          className="text-[11px] sm:text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          管理收藏夹 →
        </Link>
      </div>

      {/* 空状态 */}
      {collections.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-16 h-16 mx-auto bg-yellow-50 rounded-full flex items-center justify-center text-3xl mb-4">
            ⭐
          </div>
          <p className="text-gray-500 mb-4">还没有创建收藏夹</p>
          <Link
            href="/forum/my/favorites"
            className="inline-block px-5 py-2.5 text-[13px] sm:text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
          >
            创建收藏夹
          </Link>
        </div>
      ) : (
        /* 收藏夹卡片列表 */
        <div className="space-y-3">
          {collections.map((col) => (
            <Link
              key={col.id}
              href={`/forum/my/favorites?col=${col.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 truncate">
                  {col.name}
                </h3>
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border flex-shrink-0 ml-2',
                    col.isPublic
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-gray-50 text-gray-600 border-gray-200',
                  )}
                >
                  {col.isPublic ? '🌐 公开' : '🔒 私有'}
                </span>
              </div>

              {col.description && (
                <p className="text-[11px] sm:text-sm text-gray-500 mb-2 line-clamp-2">
                  {col.description}
                </p>
              )}

              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex-shrink-0">📄 {col.itemCount || 0} 篇帖子</span>
                {col.recentPosts && col.recentPosts.length > 0 && (
                  <span className="truncate">最近: {col.recentPosts[0].title}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
