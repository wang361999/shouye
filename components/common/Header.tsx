"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const toolLinks = [
  { name: "ZIP一键上传GitHub", href: "/#zip-upload-github" },
  { name: "AI Commit生成器", href: "/#ai-commit-generator" },
  { name: "更多工具...", href: "/#tools" },
];

const forumLinks = [
  { name: "全部帖子", href: "/forum", icon: "" },
  { name: "📢 公告", href: "/forum/category/announcement", icon: "📢" },
  { name: "💬 反馈建议", href: "/forum/category/feedback", icon: "💬" },
  { name: "📖 使用教程", href: "/forum/category/tutorial", icon: "📖" },
  { name: "🗣️ 闲聊", href: "/forum/category/chat", icon: "🗣️" },
];

export default function Header() {
  const { user, logout, hydrate } = useAppStore();
  const [toolOpen, setToolOpen] = useState(false);
  const [forumOpen, setForumOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [siteName, setSiteName] = useState<string>("ET Studio");
  const toolRef = useRef<HTMLDivElement>(null);
  const forumRef = useRef<HTMLDivElement>(null);

  // 客户端水合：从 localStorage 恢复登录态
  useEffect(() => { hydrate(); }, []);

  // GitHub OAuth 登录桥接：检测 URL 参数 oauth_success，
  // 调用 /api/auth/me 从 httpOnly cookie 中提取 token 并同步到 store/localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth_success") !== "1") return;

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user && data?.token) {
          const { setAuth } = useAppStore.getState();
          setAuth(data.user, data.token);
        }
      })
      .catch(() => {})
      .finally(() => {
        // 清除 URL 参数
        window.history.replaceState({}, "", window.location.pathname);
      });
  }, []);

  // 动态获取网站名称（fetch 失败时静默降级为默认值）
  useEffect(() => {
    let active = true;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (active && data?.site_name) {
          setSiteName(data.site_name);
        }
      })
      .catch(() => {
        // 静默降级，不弹 toast
      });
    return () => {
      active = false;
    };
  }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (toolRef.current && !toolRef.current.contains(e.target as Node)) {
        setToolOpen(false);
      }
      if (forumRef.current && !forumRef.current.contains(e.target as Node)) {
        setForumOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center space-x-2 text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
          >
            <span>🛠️</span>
            <span>{siteName}</span>
          </Link>

          {/* 桌面端导航 */}
          <nav className="hidden md:flex items-center space-x-1">
            {/* 工具下拉 */}
            <div className="relative" ref={toolRef}>
              <button
                onClick={() => {
                  setToolOpen(!toolOpen);
                  setForumOpen(false);
                }}
                className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              >
                <span>工具</span>
                <svg
                  className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    toolOpen && "rotate-180"
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {/* 下拉面板 */}
              {toolOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 animate-dropdown">
                  {/* 小三角 */}
                  <div className="absolute -top-2 left-6 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white" />
                  {toolLinks.map((link) => (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={() => setToolOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 论坛下拉 */}
            <div className="relative" ref={forumRef}>
              <button
                onClick={() => {
                  setForumOpen(!forumOpen);
                  setToolOpen(false);
                }}
                className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              >
                <span>论坛</span>
                <svg
                  className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    forumOpen && "rotate-180"
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {/* 下拉面板 */}
              {forumOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 animate-dropdown">
                  <div className="absolute -top-2 left-6 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white" />
                  {forumLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setForumOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 文档 */}
            <a
              href="#"
              className="px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
            >
              文档
            </a>
          </nav>

          {/* 右侧用户区 */}
          <div className="hidden md:flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3">
                {/* 通知铃铛 */}
                <Link
                  href="/notifications"
                  className="relative p-1.5 text-gray-600 hover:text-blue-600 transition-colors"
                  aria-label="通知"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                </Link>
                {/* 用户名链接到 /profile */}
                <Link
                  href="/profile"
                  className="text-sm text-gray-700 hover:text-blue-600 transition-colors"
                >
                  {user.username}
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm text-gray-500 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                >
                  退出
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  href="/login"
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                >
                  登录
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  注册
                </Link>
              </div>
            )}
          </div>

          {/* 移动端汉堡菜单 */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 移动端菜单面板 */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white animate-slide-down">
          <div className="px-4 py-3 space-y-2">
            {/* 工具 */}
            <div>
              <button
                onClick={() => setToolOpen(!toolOpen)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              >
                <span>工具</span>
                <svg
                  className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    toolOpen && "rotate-180"
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {toolOpen && (
                <div className="ml-4 mt-1 space-y-1">
                  {toolLinks.map((link) => (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 论坛 */}
            <div>
              <button
                onClick={() => setForumOpen(!forumOpen)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              >
                <span>论坛</span>
                <svg
                  className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    forumOpen && "rotate-180"
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {forumOpen && (
                <div className="ml-4 mt-1 space-y-1">
                  {forumLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 文档 */}
            <a
              href="#"
              className="block px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
            >
              文档
            </a>

            <hr className="border-gray-100" />

            {/* 用户 */}
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center space-x-3">
                    {/* 通知铃铛 */}
                    <Link
                      href="/notifications"
                      onClick={() => setMobileMenuOpen(false)}
                      className="relative p-1.5 text-gray-600 hover:text-blue-600 transition-colors"
                      aria-label="通知"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                      </svg>
                    </Link>
                    {/* 用户名链接到 /profile */}
                    <Link
                      href="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-sm text-gray-700 hover:text-blue-600 transition-colors"
                    >
                      {user.username}
                    </Link>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 text-sm text-gray-500 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    退出
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                >
                  登录
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-2 text-sm font-medium text-center text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  注册
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export { Header };

