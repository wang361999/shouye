"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// ============ 类型定义 ============
interface RecentCheckIn {
  date: string;
  expReward: number;
  continuousDays: number;
}

interface CheckInStatus {
  checkedInToday: boolean;
  todayReward: number;
  currentStreak: number;
  totalCheckIns: number;
  recentCheckIns: RecentCheckIn[];
  nextReward: number;
}

// ============ SVG 图标 ============
const CalendarCheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l2 2 4-4" />
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

const GiftIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      d="M21 11.5v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-8M21 8V6a1 1 0 00-1-1H4a1 1 0 00-1 1v2M3 8h18M12 8v13M7.5 8a2.5 2.5 0 010-5C11 3 12 8 12 8M16.5 8a2.5 2.5 0 000-5C13 3 12 8 12 8"
    />
  </svg>
);

const ChartIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
    />
  </svg>
);

// ============ 工具函数 ============
/** 将日期格式化为 YYYY-MM-DD（本地时区，避免 UTC 偏移导致日期错位） */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ============ 7 天签到日历（小圆点） ============
interface CalendarDotsProps {
  recentCheckIns: RecentCheckIn[];
}

function CalendarDots({ recentCheckIns }: CalendarDotsProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const checkInDates = new Set(recentCheckIns.map((c) => c.date));
  const dayNames = ["日", "一", "二", "三", "四", "五", "六"];

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-1.5">
        {days.map((d, i) => {
          const dateStr = formatLocalDate(d);
          const isChecked = checkInDates.has(dateStr);
          const isToday = i === 6;

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-gray-400">{dayNames[d.getDay()]}</span>
              <div className="relative">
                <span
                  className={cn(
                    "block w-2.5 h-2.5 rounded-full transition-colors",
                    isChecked ? "bg-green-500" : "bg-gray-200",
                    isToday && !isChecked && "ring-2 ring-indigo-200 ring-offset-1",
                    isToday && isChecked && "ring-2 ring-green-200 ring-offset-1",
                  )}
                />
                {isToday && (
                  <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] font-medium text-indigo-500 whitespace-nowrap">
                    今
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex items-center justify-center gap-4 text-[11px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          已签到
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-200" />
          未签到
        </span>
      </div>
    </div>
  );
}

// ============ 主组件 ============
export default function CheckInWidget() {
  const { user, token } = useAppStore();
  const [status, setStatus] = useState<CheckInStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  // 获取签到状态
  const fetchStatus = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/check-in", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: CheckInStatus = await res.json();
        setStatus(data);
      }
    } catch {
      // 静默降级，不阻塞侧边栏渲染
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // 执行签到
  const handleCheckIn = async () => {
    if (!token || checkingIn || status?.checkedInToday) return;
    setCheckingIn(true);
    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `签到成功！获得 ${data.expReward} 声望值`);
        // 签到成功后刷新状态
        await fetchStatus();
      } else if (data.checkedIn) {
        toast("今日已签到，明天再来吧", { icon: "i" });
        await fetchStatus();
      } else {
        toast.error(data.error || "签到失败，请稍后重试");
      }
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setCheckingIn(false);
    }
  };

  // 是否达成 7 天连续签到（额外奖励）
  const reachedSevenDayMilestone =
    !!status && status.currentStreak > 0 && status.currentStreak % 7 === 0;
  // 距离下一个 7 天里程碑还差几天
  const daysToNextMilestone = status
    ? 7 - (status.currentStreak % 7 === 0 ? 0 : status.currentStreak % 7)
    : 7;

  // ---------- 未登录状态 ----------
  if (!user || !token) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarCheckIcon className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-700">每日签到</h3>
        </div>
        <div className="flex flex-col items-center py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-3">
            <LockIcon className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 mb-4">登录后签到，积累声望值</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg hover:shadow-md hover:from-indigo-600 hover:to-indigo-700 transition-all"
          >
            登录后签到
          </Link>
        </div>
      </div>
    );
  }

  // ---------- 主组件 ----------
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-5">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarCheckIcon className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-700">每日签到</h3>
        </div>
        {status?.checkedInToday && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-green-700 bg-green-50 rounded-full border border-green-200">
            <CheckCircleIcon className="w-3 h-3" />
            已签到
          </span>
        )}
      </div>

      {/* 加载骨架 */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="text-center bg-gray-50 rounded-lg py-3">
                <div className="h-6 w-8 mx-auto bg-gray-200 rounded" />
                <div className="h-3 w-10 mx-auto bg-gray-100 rounded mt-2" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="h-2 w-6 bg-gray-100 rounded" />
                <div className="w-2.5 h-2.5 bg-gray-200 rounded-full" />
              </div>
            ))}
          </div>
          <div className="h-10 bg-gray-100 rounded-lg" />
        </div>
      ) : (
        <>
          {/* 统计数据 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center bg-gray-50 rounded-lg py-2.5">
              <div className="flex items-center justify-center gap-0.5">
                <FlameIcon className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-lg font-bold text-orange-600">
                  {status?.currentStreak ?? 0}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">连续天数</p>
            </div>
            <div className="text-center bg-gray-50 rounded-lg py-2.5">
              <div className="flex items-center justify-center gap-0.5">
                <ChartIcon className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-lg font-bold text-gray-700">
                  {status?.totalCheckIns ?? 0}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">总签到</p>
            </div>
            <div className="text-center bg-gray-50 rounded-lg py-2.5">
              <div className="flex items-center justify-center gap-0.5">
                <GiftIcon className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-lg font-bold text-indigo-600">
                  {status?.nextReward ?? 10}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">下次奖励</p>
            </div>
          </div>

          {/* 7 天签到日历 */}
          {status && (
            <CalendarDots recentCheckIns={status.recentCheckIns} />
          )}

          {/* 连续 7 天额外奖励提示 */}
          {status && reachedSevenDayMilestone ? (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
              <SparklesIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                恭喜达成 {status.currentStreak} 天连续签到，已获得额外 50 声望奖励！
              </p>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50/60 border border-indigo-100">
              <GiftIcon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <p className="text-xs text-indigo-600">
                再连续签到 {daysToNextMilestone} 天，可获额外 50 声望奖励
              </p>
            </div>
          )}

          {/* 签到按钮 */}
          <button
            onClick={handleCheckIn}
            disabled={checkingIn || status?.checkedInToday}
            className={cn(
              "w-full mt-4 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-1.5",
              status?.checkedInToday
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:shadow-lg hover:from-indigo-600 hover:to-indigo-700 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none",
            )}
          >
            {checkingIn ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                签到中...
              </>
            ) : status?.checkedInToday ? (
              <>
                <CheckCircleIcon className="w-4 h-4" />
                今日已签到
              </>
            ) : (
              <>
                <CalendarCheckIcon className="w-4 h-4" />
                立即签到
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
