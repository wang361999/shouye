'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/utils';

interface BadgesTabProps {
  token: string | null;
  user: { id: string };
}

interface UserBadge {
  id: string;
  awardedAt: string;
  badge: {
    icon: string;
    name: string;
    description: string;
  };
}

// ============ 徽章 Tab 组件 ============
// 网格布局展示用户已获得的徽章，加载时骨架屏，空状态引导互动
export default function BadgesTab({ token, user }: BadgesTabProps) {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchBadges = async () => {
      try {
        const res = await fetch(`/api/badges/user?userId=${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error('获取徽章失败');
        }
        // 接口返回 { badges: [...] }，兼容直接返回数组的情况
        const data = (await res.json()) as
          | UserBadge[]
          | { badges: UserBadge[] };
        if (cancelled) return;
        const list: UserBadge[] = Array.isArray(data)
          ? data
          : data.badges ?? [];
        setBadges(list);
      } catch {
        if (!cancelled) setBadges([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBadges();

    return () => {
      cancelled = true;
    };
  }, [token, user]);

  // ---- 加载骨架屏（网格布局）----
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse text-center"
          >
            <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-3" />
            <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto mb-2" />
            <div className="h-3 bg-gray-100 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  // ---- 空状态 ----
  if (badges.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <div className="w-16 h-16 mx-auto bg-yellow-50 rounded-full flex items-center justify-center text-3xl mb-4">
          🏅
        </div>
        <p className="text-gray-500 mb-2">还没有获得徽章</p>
        <p className="text-[11px] sm:text-sm text-gray-400">
          多发帖、多评论、多互动即可自动获得徽章
        </p>
      </div>
    );
  }

  // ---- 徽章网格 ----
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {badges.map((ub) => (
        <div
          key={ub.id}
          className="bg-white rounded-xl border border-gray-200 p-5 text-center hover:shadow-sm transition-shadow"
        >
          <div className="text-4xl mb-2">{ub.badge.icon || '🏅'}</div>
          <h3 className="font-semibold text-gray-900 text-[13px] sm:text-sm mb-1">
            {ub.badge.name}
          </h3>
          <p className="text-xs text-gray-400 line-clamp-2 min-h-[2rem]">
            {ub.badge.description}
          </p>
          <p className="text-[11px] text-gray-300 mt-2">
            {formatDate(ub.awardedAt)}
          </p>
        </div>
      ))}
    </div>
  );
}
