"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  showBadge?: boolean;
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "首页",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/forum",
    label: "社区",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
      </svg>
    ),
  },
  {
    href: "/tools",
    label: "工具",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "搜索",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "我的",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    showBadge: true,
  },
];

// 需要显示悬浮发帖按钮的页面
const fabPages = ["/", "/forum", "/forum/category"];

export default function MobileNav() {
  const pathname = usePathname();
  const { user, token } = useAppStore();
  const [hasUnread, setHasUnread] = useState(false);

  // 已登录用户轮询未读消息/通知
  useEffect(() => {
    if (!user || !token) {
      setHasUnread(false);
      return;
    }

    let active = true;

    const checkUnread = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [msgRes, notiRes] = await Promise.allSettled([
          fetch("/api/messages/unread", { headers }),
          fetch("/api/notifications", { headers }),
        ]);

        let unread = false;

        if (msgRes.status === "fulfilled" && msgRes.value.ok) {
          const data = await msgRes.value.json();
          if (data.unreadCount > 0) unread = true;
        }

        if (!unread && notiRes.status === "fulfilled" && notiRes.value.ok) {
          const data = await notiRes.value.json();
          if (Array.isArray(data) && data.some((n: { read: boolean }) => !n.read)) {
            unread = true;
          }
        }

        if (active) setHasUnread(unread);
      } catch {
        // 静默降级
      }
    };

    checkUnread();
    // 每 60 秒轮询一次
    const interval = setInterval(checkUnread, 60_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user, token]);

  // 判断是否显示悬浮发帖按钮
  const showFab =
    user &&
    fabPages.some(
      (page) => pathname === page || (page !== "/" && pathname.startsWith(page)),
    );

  return (
    <>
      {/* 悬浮发帖按钮 */}
      {showFab && (
        <Link
          href="/forum/new"
          className="md:hidden fixed right-4 bottom-20 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-all active:scale-90 hover:bg-blue-700"
          aria-label="发帖"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </Link>
      )}

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 safe-area-pb shadow-[0_-1px_8px_rgba(0,0,0,0.06)]"
        aria-label="底部导航"
      >
        <div className="flex items-center justify-around h-14">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center flex-1 h-full text-[10px] font-medium transition-all duration-200 no-select",
                  active
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-400 dark:text-gray-500 active:text-gray-600"
                )}
              >
                <span className={cn("mb-0.5 transition-transform duration-200", active && "scale-110")}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {/* 未读消息红点 */}
                {item.showBadge && hasUnread && (
                  <span className="absolute top-1.5 right-1/2 mr-[-14px] h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-800" />
                )}
                {/* 激活指示条 */}
                <span
                  className={cn(
                    "absolute bottom-0 h-0.5 w-6 rounded-full transition-opacity duration-200",
                    active ? "opacity-100 bg-blue-600 dark:bg-blue-400" : "opacity-0"
                  )}
                />
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
