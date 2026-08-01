"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ReputationBadgeProps {
  reputation: number;
  badge?: string | null;
  size?: "xs" | "sm" | "md";
}

// 声望等级映射
const BADGE_MAP: Record<string, { icon: string; label: string; colorClass: string }> = {
  newcomer: { icon: "🌱", label: "新手", colorClass: "bg-green-50 text-green-600 border-green-200" },
  contributor: { icon: "⭐", label: "贡献者", colorClass: "bg-blue-50 text-blue-600 border-blue-200" },
  expert: { icon: "🏆", label: "专家", colorClass: "bg-purple-50 text-purple-600 border-purple-200" },
  master: { icon: "👑", label: "大师", colorClass: "bg-amber-50 text-amber-600 border-amber-200" },
};

// 根据声望值自动推算等级
function getBadgeFromReputation(rep: number): string {
  if (rep >= 1000) return "master";
  if (rep >= 300) return "expert";
  if (rep >= 50) return "contributor";
  return "newcomer";
}

export function ReputationBadge({ reputation, badge, size = "sm" }: ReputationBadgeProps) {
  const effectiveBadge = badge || getBadgeFromReputation(reputation);
  const config = BADGE_MAP[effectiveBadge] || BADGE_MAP.newcomer;

  const sizeClass = size === "xs" ? "text-[10px] px-1.5 py-0.5" : size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        config.colorClass,
        sizeClass
      )}
      title={`声望值: ${reputation}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

// 关注按钮组件
interface FollowButtonProps {
  targetId: string;
  targetType: "user" | "category";
  initialFollowing?: boolean;
  onToggle?: (following: boolean) => void;
  size?: "sm" | "md";
}

export function FollowButton({
  targetId,
  targetType,
  initialFollowing = false,
  onToggle,
  size = "sm",
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        window.location.href = "/login";
        return;
      }
      const res = await fetch("/api/forum/follows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: targetType, targetId }),
      });
      if (res.ok) {
        const data = await res.json();
        setFollowing(data.following);
        onToggle?.(data.following);
      }
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  };

  const sizeClass = size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-1.5 text-sm";

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium transition-colors disabled:opacity-50",
        sizeClass,
        following
          ? "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
          : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
      )}
    >
      {following ? "✓ 已关注" : "+ 关注"}
    </button>
  );
}
