"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface BadgeDisplayProps {
  /** 目标用户 ID */
  userId: string;
  /** 展示尺寸 */
  size?: "xs" | "sm" | "md";
  /** 是否展示徽章名称文字（默认仅展示图标 + tooltip） */
  showLabel?: boolean;
  /** 最多展示徽章数量，超出显示 +N */
  max?: number;
  /** 自定义 className */
  className?: string;
}

interface UserBadgeItem {
  id: string;
  userId: string;
  badgeId: string;
  awardedAt: string;
  badge: {
    id: string;
    name: string;
    description: string;
    icon: string;
    type: string;
  };
}

export function BadgeDisplay({
  userId,
  size = "sm",
  showLabel = false,
  max,
  className,
}: BadgeDisplayProps) {
  const [badges, setBadges] = useState<UserBadgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchBadges() {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(false);

      try {
        const res = await fetch(`/api/badges/user?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setBadges(data.badges || []);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setBadges([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchBadges();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // 加载中：显示占位骨架
  if (loading) {
    return (
      <div className={cn("inline-flex items-center gap-1", className)}>
        <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-gray-200" />
        <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-gray-200" />
      </div>
    );
  }

  // 错误或无徽章：不渲染任何内容
  if (error || badges.length === 0) {
    return null;
  }

  // 截断展示
  const displayBadges = max ? badges.slice(0, max) : badges;
  const remaining = max ? Math.max(0, badges.length - max) : 0;

  const iconSizeClass =
    size === "xs"
      ? "text-base leading-none"
      : size === "sm"
        ? "text-lg leading-none"
        : "text-xl leading-none";

  const labelSizeClass =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5"
      : size === "sm"
        ? "text-xs px-2 py-0.5"
        : "text-sm px-2.5 py-1";

  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-1",
        className,
      )}
    >
      {displayBadges.map((item) => (
        <span
          key={item.id}
          title={`${item.badge.icon} ${item.badge.name} - ${item.badge.description}`}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 font-medium cursor-default transition-colors hover:bg-amber-100",
            labelSizeClass,
          )}
        >
          <span className={iconSizeClass} aria-hidden="true">
            {item.badge.icon}
          </span>
          {showLabel && (
            <span className="text-amber-700">{item.badge.name}</span>
          )}
        </span>
      ))}
      {remaining > 0 && (
        <span
          title={`还有 ${remaining} 个徽章`}
          className={cn(
            "inline-flex items-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 font-medium",
            labelSizeClass,
          )}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}

export default BadgeDisplay;
