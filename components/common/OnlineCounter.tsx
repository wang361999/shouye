"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * 在线人数计数器组件
 *
 * 功能：
 *   1. 生成/读取 localStorage 中的 sessionId
 *   2. 每 30 秒发送心跳到 /api/online
 *   3. 每 30 秒拉取最新在线人数
 *   4. 支持两种显示模式：badge（Header 小徽章）和 hero（首页大徽章）
 */

const HEARTBEAT_INTERVAL = 30_000; // 30 秒
const SESSION_KEY = "online_session_id";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

async function fetchOnlineCount(): Promise<number> {
  try {
    const res = await fetch("/api/online", { cache: "no-store" });
    if (!res.ok) return 0;
    const data = await res.json();
    return typeof data.online === "number" ? data.online : 0;
  } catch {
    return 0;
  }
}

async function sendHeartbeat(sessionId: string): Promise<number> {
  try {
    const res = await fetch("/api/online", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return typeof data.online === "number" ? data.online : 0;
  } catch {
    return 0;
  }
}

interface OnlineCounterProps {
  /** 显示模式：badge 用于 Header，hero 用于首页 */
  variant?: "badge" | "hero";
  className?: string;
}

export default function OnlineCounter({
  variant = "badge",
  className,
}: OnlineCounterProps) {
  const [count, setCount] = useState<number>(0);
  const sessionIdRef = useRef<string>("");

  const tick = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (sid) {
      const online = await sendHeartbeat(sid);
      if (online > 0) setCount(online);
    }
  }, []);

  useEffect(() => {
    sessionIdRef.current = getSessionId();

    // 首次立即拉取
    fetchOnlineCount().then((c) => c > 0 && setCount(c));

    // 首次心跳
    tick();

    // 定时心跳 + 拉取
    const interval = setInterval(tick, HEARTBEAT_INTERVAL);

    // 页面可见性变化时重新心跳
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [tick]);

  if (count === 0) return null;

  if (variant === "hero") {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
        </span>
        <span className="text-blue-100">
          {count} 人在线
        </span>
      </span>
    );
  }

  // badge 模式 — 用于 Header
  return (
    <span
      className={cn(
        "hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
        className,
      )}
      title={`当前 ${count} 人在线`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
      </span>
      {count} 在线
    </span>
  );
}
