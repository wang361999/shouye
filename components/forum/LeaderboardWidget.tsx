"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import UserAvatar from "@/components/common/UserAvatar";
import { cn } from "@/lib/utils";

// ============ 类型定义 ============
interface LeaderboardUser {
  rank: number;
  id: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  reputation?: number;
  postCount?: number;
  commentCount?: number;
  // 签到榜独有字段
  continuousDays?: number;
  expReward?: number;
}

interface LeaderboardData {
  reputation: LeaderboardUser[];
  posts: LeaderboardUser[];
  checkIn: LeaderboardUser[];
}

type TabKey = "reputation" | "posts" | "checkIn";

// ============ SVG 图标 ============
const TrophyIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
    />
  </svg>
);

const StarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
    />
  </svg>
);

const DocIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

const FlameIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.24 17 7c.5 1 1.5 2 2 3a8 8 0 01-1.343 8.657z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
    />
  </svg>
);

// ============ 排名徽章 ============
function rankBadgeClass(rank: number): string {
  switch (rank) {
    case 1:
      return "bg-amber-500 text-white";
    case 2:
      return "bg-gray-400 text-white";
    case 3:
      return "bg-orange-600 text-white";
    default:
      return "bg-gray-100 text-gray-500";
  }
}

// ============ 排行榜列表 ============
interface LeaderboardListProps {
  users: LeaderboardUser[];
  metric: "reputation" | "postCount" | "continuousDays";
  unit: string;
}

function LeaderboardList({ users, metric, unit }: LeaderboardListProps) {
  if (users.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-300">暂无排行数据</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {users.slice(0, 5).map((u) => (
        <li key={u.id}>
          <Link
            href={`/profile?uid=${u.id}`}
            className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            {/* 排名徽章 */}
            <span
              className={cn(
                "flex-shrink-0 w-6 h-6 flex items-center justify-center text-xs font-bold rounded-md",
                rankBadgeClass(u.rank),
              )}
            >
              {u.rank}
            </span>

            {/* 头像 */}
            <UserAvatar username={u.username} avatar={u.avatar} size="sm" />

            {/* 用户名 */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 group-hover:text-indigo-600 transition-colors truncate">
                {u.username}
              </p>
              {u.bio && (
                <p className="text-[11px] text-gray-400 truncate">{u.bio}</p>
              )}
            </div>

            {/* 数值 */}
            <span className="flex-shrink-0 text-sm font-semibold text-gray-900">
              {(u[metric] ?? 0).toLocaleString()}
              <span className="text-xs text-gray-400 font-normal ml-0.5">{unit}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ============ 骨架屏 ============
function LeaderboardSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2 animate-pulse">
          <div className="w-6 h-6 bg-gray-200 rounded-md flex-shrink-0" />
          <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-gray-200 rounded w-20" />
            <div className="h-2.5 bg-gray-100 rounded w-28" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-12 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ============ 主组件 ============
const TAB_CONFIG: { key: TabKey; label: string; Icon: typeof TrophyIcon }[] = [
  { key: "reputation", label: "声望榜", Icon: StarIcon },
  { key: "posts", label: "发帖榜", Icon: DocIcon },
  { key: "checkIn", label: "签到榜", Icon: FlameIcon },
];

export default function LeaderboardWidget() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("reputation");

  // 获取排行榜数据
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        const json: LeaderboardData = await res.json();
        setData(json);
      }
    } catch {
      // 静默降级，不阻塞侧边栏渲染
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // 当前 Tab 对应的配置
  const currentTab = TAB_CONFIG.find((t) => t.key === activeTab)!;

  // 当前 Tab 的展示数据与指标
  const tabRenderConfig: Record<
    TabKey,
    { users: LeaderboardUser[] | undefined; metric: "reputation" | "postCount" | "continuousDays"; unit: string }
  > = {
    reputation: { users: data?.reputation, metric: "reputation", unit: "声望" },
    posts: { users: data?.posts, metric: "postCount", unit: "帖" },
    checkIn: { users: data?.checkIn, metric: "continuousDays", unit: "天" },
  };

  const { users: currentUsers, metric, unit } = tabRenderConfig[activeTab];

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-5">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <TrophyIcon className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-gray-700">社区排行榜</h3>
      </div>

      {/* Tab 切换 */}
      <div className="flex items-center gap-1 mb-3 -mx-1 px-1 border-b border-gray-100">
        {TAB_CONFIG.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === key
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-400 hover:text-gray-600",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* 列表内容 */}
      {loading ? (
        <LeaderboardSkeleton />
      ) : currentUsers ? (
        <LeaderboardList users={currentUsers} metric={metric} unit={unit} />
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-gray-300">暂无排行数据</p>
        </div>
      )}

      {/* 底部提示 */}
      {!loading && currentUsers && currentUsers.length > 0 && (
        <p className="mt-3 pt-3 border-t border-gray-50 text-center text-[11px] text-gray-400">
          {currentTab.label} Top 5 · 点击查看详情
        </p>
      )}
    </div>
  );
}
