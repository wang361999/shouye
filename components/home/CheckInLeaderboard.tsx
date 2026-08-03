"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Container } from "@/components/common/Container";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import UserAvatar from "@/components/common/UserAvatar";

// ============ 类型定义 ============
interface CheckInStatus {
  checkedInToday: boolean;
  todayReward: number;
  currentStreak: number;
  totalCheckIns: number;
  recentCheckIns: { date: string; expReward: number; continuousDays: number }[];
  nextReward: number;
}

interface LeaderboardUser {
  rank: number;
  id: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  reputation?: number;
  postCount?: number;
  commentCount?: number;
  continuousDays?: number;
  expReward?: number;
}

interface LeaderboardData {
  reputation: LeaderboardUser[];
  posts: LeaderboardUser[];
  checkIn: LeaderboardUser[];
}

// ============ 连续签到日历组件 ============
function CheckInCalendar({ recentCheckIns, checkedInToday }: { recentCheckIns: CheckInStatus["recentCheckIns"]; checkedInToday: boolean }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const checkInDates = new Set(recentCheckIns.map((c) => c.date));

  return (
    <div className="flex items-center justify-between gap-1.5 mt-3">
      {days.map((d, i) => {
        const dateStr = d.toISOString().split("T")[0];
        const isChecked = checkInDates.has(dateStr);
        const isToday = i === 6;
        const dayNames = ["日", "一", "二", "三", "四", "五", "六"];

        return (
          <div
            key={i}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-colors",
              isChecked
                ? "bg-green-50 border border-green-200"
                : "bg-gray-50 border border-gray-100",
              isToday && !isChecked && "ring-2 ring-blue-200"
            )}
          >
            <span className="text-[10px] text-gray-400">{dayNames[d.getDay()]}</span>
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                isChecked
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-400"
              )}
            >
              {isChecked ? "✓" : d.getDate()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ 排行榜列表组件 ============
function LeaderboardList({ users, metric, unit }: { users: LeaderboardUser[]; metric: "reputation" | "postCount" | "continuousDays"; unit: string }) {
  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        暂无排行数据
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {users.slice(0, 5).map((u) => (
        <Link
          key={u.id}
          href="/profile"
          className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
        >
          {/* 排名 */}
          <div
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
              u.rank === 1
                ? "bg-yellow-100 text-yellow-700"
                : u.rank === 2
                ? "bg-gray-200 text-gray-600"
                : u.rank === 3
                ? "bg-orange-100 text-orange-600"
                : "bg-gray-50 text-gray-400"
            )}
          >
            {u.rank}
          </div>

          {/* 头像 */}
          <UserAvatar username={u.username} avatar={u.avatar} size="sm" />

          {/* 用户名 */}
          <span className="flex-1 text-sm text-gray-700 group-hover:text-blue-600 transition-colors truncate">
            {u.username}
          </span>

          {/* 数值 */}
          <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
            {u[metric] ?? 0}
            <span className="text-xs text-gray-400 font-normal ml-0.5">{unit}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

// ============ 主组件 ============
export default function CheckInLeaderboard() {
  const { user, token } = useAppStore();
  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [activeTab, setActiveTab] = useState<"reputation" | "posts" | "checkIn">("reputation");
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);

  // 获取签到状态
  const fetchCheckInStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/check-in", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCheckInStatus(data);
      }
    } catch {
      // 静默降级
    }
  }, [token]);

  // 获取排行榜
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch {
      // 静默降级
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    if (token) fetchCheckInStatus();
  }, [token, fetchCheckInStatus, fetchLeaderboard]);

  // 执行签到
  async function handleCheckIn() {
    if (!token || checkingIn) return;
    setCheckingIn(true);
    setCheckInMessage(null);
    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setCheckInMessage(`🎉 ${data.message}`);
        fetchCheckInStatus();
      } else if (data.checkedIn) {
        setCheckInMessage("今日已签到，明天再来吧～");
      } else {
        setCheckInMessage(data.error || "签到失败");
      }
    } catch {
      setCheckInMessage("网络错误，请稍后重试");
    } finally {
      setCheckingIn(false);
    }
  }

  const TAB_CONFIG = [
    { key: "reputation" as const, label: "声望榜", icon: "🏆" },
    { key: "posts" as const, label: "发帖榜", icon: "📝" },
    { key: "checkIn" as const, label: "签到榜", icon: "🔥" },
  ];

  return (
    <section className="bg-gray-50 py-16 md:py-20">
      <Container>
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="h-px w-8 bg-blue-300" />
          <span className="text-sm font-medium uppercase tracking-widest text-blue-500">Daily</span>
          <span className="h-px w-8 bg-blue-300" />
        </div>
        <h2 className="mb-3 text-center text-3xl font-bold text-gray-900 md:text-4xl">
          签到 & 排行榜
        </h2>
        <p className="mb-12 text-center text-gray-500">
          每日签到积累声望，看看社区的活跃之星
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ===== 左侧：签到卡片 ===== */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>📅</span> 每日签到
                </h3>
                {checkInStatus?.checkedInToday && (
                  <span className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-full border border-green-200">
                    ✓ 已签到
                  </span>
                )}
              </div>

              {user ? (
                <>
                  {/* 签到数据展示 */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center bg-gray-50 rounded-xl py-3">
                      <div className="text-2xl font-bold text-orange-600">
                        {checkInStatus?.currentStreak ?? 0}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">连续天数</div>
                    </div>
                    <div className="text-center bg-gray-50 rounded-xl py-3">
                      <div className="text-2xl font-bold text-blue-600">
                        {checkInStatus?.totalCheckIns ?? 0}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">累计签到</div>
                    </div>
                    <div className="text-center bg-gray-50 rounded-xl py-3">
                      <div className="text-2xl font-bold text-green-600">
                        {checkInStatus?.nextReward ?? 10}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">今日奖励</div>
                    </div>
                  </div>

                  {/* 签到日历 */}
                  {checkInStatus && (
                    <CheckInCalendar
                      recentCheckIns={checkInStatus.recentCheckIns}
                      checkedInToday={checkInStatus.checkedInToday}
                    />
                  )}

                  {/* 签到按钮 */}
                  <button
                    onClick={handleCheckIn}
                    disabled={checkingIn || checkInStatus?.checkedInToday}
                    className={cn(
                      "w-full mt-4 py-3 rounded-xl font-semibold text-sm transition-all",
                      checkInStatus?.checkedInToday
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:-translate-y-0.5"
                    )}
                  >
                    {checkingIn
                      ? "签到中..."
                      : checkInStatus?.checkedInToday
                      ? "今日已签到"
                      : "立即签到 +声望"}
                  </button>

                  {/* 签到消息 */}
                  {checkInMessage && (
                    <p className="mt-3 text-center text-sm text-blue-600 animate-fade-in">
                      {checkInMessage}
                    </p>
                  )}

                  {/* 奖励规则说明 */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-2">签到奖励规则：</p>
                    <div className="text-xs text-gray-500 space-y-1">
                      <div className="flex justify-between">
                        <span>基础奖励</span>
                        <span>10 声望/天</span>
                      </div>
                      <div className="flex justify-between">
                        <span>连续签到加成</span>
                        <span>+2/天（最多+14）</span>
                      </div>
                      <div className="flex justify-between">
                        <span>连续7天奖励</span>
                        <span className="text-orange-600 font-medium">额外+50声望</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🔒</div>
                  <p className="text-sm text-gray-500 mb-4">
                    登录后即可每日签到，积累声望值
                  </p>
                  <Link
                    href="/login"
                    className="inline-block px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    前往登录
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* ===== 右侧：排行榜 ===== */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-1 mb-5 border-b border-gray-100">
                {TAB_CONFIG.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                      activeTab === tab.key
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                  >
                    <span className="mr-1">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 排行榜内容 */}
              {activeTab === "reputation" && leaderboard && (
                <LeaderboardList users={leaderboard.reputation} metric="reputation" unit="声望" />
              )}
              {activeTab === "posts" && leaderboard && (
                <LeaderboardList users={leaderboard.posts} metric="postCount" unit="帖" />
              )}
              {activeTab === "checkIn" && leaderboard && (
                <LeaderboardList users={leaderboard.checkIn} metric="continuousDays" unit="天" />
              )}

              {!leaderboard && (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-2 py-2 animate-pulse">
                      <div className="w-7 h-7 bg-gray-200 rounded-lg" />
                      <div className="w-8 h-8 bg-gray-200 rounded-full" />
                      <div className="h-4 bg-gray-200 rounded w-24 flex-1" />
                      <div className="h-4 bg-gray-200 rounded w-12" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
