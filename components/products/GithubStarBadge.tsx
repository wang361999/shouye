'use client';

import { useState, useEffect } from 'react';

/**
 * GitHub Star 徽章
 *
 * 在产品列表卡片上轻量展示 GitHub Star 数。
 * 数据来源于 /api/products/[slug]/github 接口（已带 10 分钟服务端缓存）。
 * 失败时静默降级，不显示任何内容，避免影响卡片布局。
 */

interface GithubStarBadgeProps {
  slug: string;
}

export default function GithubStarBadge({ slug }: GithubStarBadgeProps) {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStars() {
      try {
        const res = await fetch(`/api/products/${slug}/github`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.available && data.repoInfo) {
          setStars(data.repoInfo.stars);
        }
      } catch {
        // 静默降级
      }
    }

    fetchStars();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // 未获取到 Star 数据时不显示
  if (stars === null) return null;

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded">
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      {stars >= 1000 ? (stars / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : stars}
    </span>
  );
}
