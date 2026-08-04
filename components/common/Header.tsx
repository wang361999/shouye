"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle";
import OnlineCounter from "./OnlineCounter";
import GitdLogo from "./GitdLogo";

const toolLinks = [
  { name: "工具库", href: "/tools" },
  { name: "开源项目", href: "/products" },
];

const forumLinks = [
  { name: "全部帖子", href: "/forum", icon: "" },
  { name: "📢 公告", href: "/forum/category/announcement", icon: "📢" },
  { name: "💬 反馈建议", href: "/forum/category/feedback", icon: "💬" },
  { name: "📖 使用教程", href: "/forum/category/tutorial", icon: "📖" },
  { name: "🗣️ 闲聊", href: "/forum/category/chat", icon: "🗣️" },
  { name: "✏️ 发布新帖", href: "/forum/new", icon: "✏️" },
  { name: "⭐ 我的收藏", href: "/forum/my/favorites", icon: "⭐" },
  { name: "✉️ 私信", href: "/messages", icon: "✉️" },
];

/**
 * 判断头像字符串是否为图片 URL
 * 支持 http(s)、data:、相对路径和 blob: 协议，其余视为 emoji 文本
 */
function isImageAvatar(avatar: string): boolean {
  return /^(https?:|data:|\/|blob:)/.test(avatar);
}

/**
 * 导航栏用户头像（32x32 圆形）
 * 支持 emoji、图片 URL，无头像时回退到用户名首字母
 */
function HeaderAvatar({
  avatar,
  username,
}: {
  avatar?: string | null;
  username: string;
}) {
  const hasAvatar = !!avatar;
  const isImg = hasAvatar && isImageAvatar(avatar as string);
  return (
    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center overflow-hidden flex-shrink-0 border border-blue-200">
      {hasAvatar ? (
        isImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar as string}
            alt={username}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xl leading-none">{avatar}</span>
        )
      ) : (
        <span className="text-sm font-bold">
          {username.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default function Header({ siteName: initialSiteName = "Gitd" }: { siteName?: string }) {
  const { user, token, logout, hydrate, updateAvatar } = useAppStore();
  const [toolOpen, setToolOpen] = useState(false);
  const [forumOpen, setForumOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [siteName, setSiteName] = useState<string>(initialSiteName);
  const [searchQuery, setSearchQuery] = useState("");
  const toolRef = useRef<HTMLDivElement>(null);
  const forumRef = useRef<HTMLDivElement>(null);
  // 记录已为哪个用户拉取过头像，避免 avatar 为 null 时重复请求导致死循环
  const avatarFetchedForRef = useRef<string | null>(null);

  // 客户端水合：从 localStorage 恢复登录态
  useEffect(() => { hydrate(); }, []);

  // 拉取用户头像：store 中没有 avatar 时从 /api/user/profile 获取（依赖 httpOnly cookie 鉴权）
  useEffect(() => {
    if (!user) {
      avatarFetchedForRef.current = null;
      return;
    }
    // 已有头像或已为该用户拉取过则跳过
    if (user.avatar || avatarFetchedForRef.current === user.id) return;
    avatarFetchedForRef.current = user.id;

    let active = true;
    const headers: HeadersInit = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    fetch("/api/user/profile", { headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && data.avatar !== undefined) {
          updateAvatar(data.avatar);
        }
      })
      .catch(() => {
        // 静默降级，不影响导航栏基本功能
      });
    return () => {
      active = false;
    };
  }, [user, token, updateAvatar]);

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

  // 动态获取网站名称（仅当 prop 为默认值时才请求，避免不必要的 fetch）
  useEffect(() => {
    // 如果 prop 已经是数据库中的值，不需要再 fetch
    if (initialSiteName !== "Gitd") return;
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
  }, [initialSiteName]);

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
    <>
    {/* 移动端顶部品牌栏 */}
    <header className="md:hidden sticky top-0 z-50 bg-white border-b border-gray-100 dark:bg-slate-800 dark:border-slate-700">
      <div className="flex items-center justify-between h-12 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-bold text-gray-900 dark:text-white"
        >
          <GitdLogo className="h-6 w-6 flex-shrink-0" />
          <span>{siteName}</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/search"
            className="grid h-8 w-8 place-items-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700"
            aria-label="搜索"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="grid h-8 w-8 place-items-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700"
            aria-label="菜单"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 space-y-1 dark:bg-slate-800 dark:border-slate-700">
          <Link href="/forum" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg dark:text-gray-300">社区</Link>
          <Link href="/tools" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg dark:text-gray-300">工具</Link>
          <Link href="/collab" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg dark:text-gray-300">协作</Link>
          <Link href="/products" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg dark:text-gray-300">开源项目</Link>
          <Link href="/docs" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg dark:text-gray-300">文档</Link>
          <hr className="border-gray-100 dark:border-slate-700" />
          {user ? (
            <>
              <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg dark:text-gray-300">我的</Link>
              <button onClick={handleLogout} className="block w-full text-left px-3 py-2 text-[13px] font-medium text-gray-500 hover:bg-gray-50 rounded-lg">退出</button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 rounded-lg dark:text-gray-300">登录</Link>
              <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-[13px] font-medium text-blue-600 hover:bg-blue-50 rounded-lg">注册</Link>
            </>
          )}
        </div>
      )}
    </header>

    {/* 桌面端导航 */}
    <header className="hidden md:block sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:shadow-none">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center space-x-2 text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors dark:text-white"
          >
            <GitdLogo className="h-7 w-7 flex-shrink-0" />
            <span>{siteName}</span>
          </Link>

          {/* 桌面端导航 */}
          <nav className="hidden md:flex items-center space-x-1">
            {/* 搜索框 */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
                }
              }}
              className="relative hidden md:block"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索..."
                className="w-40 lg:w-56 pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </form>

            {/* 论坛下拉（社区为主，放第一位） */}
            <div className="relative" ref={forumRef}>
              <button
                onClick={() => {
                  setForumOpen(!forumOpen);
                  setToolOpen(false);
                }}
                className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-slate-700"
              >
                <span>社区</span>
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
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 animate-dropdown dark:bg-slate-800 dark:border-slate-600">
                  <div className="absolute -top-2 left-6 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white dark:border-b-slate-800" />
                  {forumLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setForumOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors dark:text-gray-300 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 工具下拉（次要位置） */}
            <div className="relative" ref={toolRef}>
              <button
                onClick={() => {
                  setToolOpen(!toolOpen);
                  setForumOpen(false);
                }}
                className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-slate-700"
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
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 animate-dropdown dark:bg-slate-800 dark:border-slate-600">
                  {/* 小三角 */}
                  <div className="absolute -top-2 left-6 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white dark:border-b-slate-800" />
                  {toolLinks.map((link) => (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={() => setToolOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors dark:text-gray-300 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 开源 */}
            <Link
              href="/products"
              className="px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-slate-700"
            >
              开源
            </Link>

            {/* 文档 */}
            <Link
              href="/docs"
              className="px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-slate-700"
            >
              文档
            </Link>
          </nav>

          {/* 右侧用户区 */}
          <div className="hidden md:flex items-center space-x-3">
            {/* 在线人数 */}
            <OnlineCounter variant="badge" />
            {/* 主题切换 */}
            <ThemeToggle />
            {user ? (
              <div className="flex items-center space-x-3">
                {/* 私信图标 */}
                <Link
                  href="/messages"
                  className="relative p-1.5 text-gray-600 hover:text-blue-600 transition-colors dark:text-gray-400 dark:hover:text-blue-400"
                  aria-label="私信"
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
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </Link>
                {/* 通知铃铛 */}
                <Link
                  href="/notifications"
                  className="relative p-1.5 text-gray-600 hover:text-blue-600 transition-colors dark:text-gray-400 dark:hover:text-blue-400"
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
                {/* 用户名链接到 /profile（头像 + 用户名） */}
                <Link
                  href="/profile"
                  className="flex items-center space-x-2 text-sm text-gray-700 hover:text-blue-600 transition-colors dark:text-gray-300 dark:hover:text-blue-400"
                >
                  <HeaderAvatar avatar={user.avatar} username={user.username} />
                  <span>{user.username}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm text-gray-500 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors dark:text-gray-400 dark:border-slate-600 dark:hover:bg-slate-700"
                >
                  退出
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  href="/login"
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors dark:text-gray-300 dark:hover:text-blue-400"
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
            className="md:hidden p-2.5 -mr-1 rounded-md text-gray-700 hover:bg-gray-100 transition-colors touch-target flex items-center justify-center dark:text-gray-300 dark:hover:bg-slate-700"
            aria-label="菜单"
            aria-expanded={mobileMenuOpen}
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
        <div className="md:hidden border-t border-gray-100 bg-white animate-slide-down dark:bg-slate-800 dark:border-slate-700">
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
            <Link
              href="/docs"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
            >
              文档
            </Link>

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
                    {/* 用户名链接到 /profile（头像 + 用户名） */}
                    <Link
                      href="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center space-x-2 text-sm text-gray-700 hover:text-blue-600 transition-colors"
                    >
                      <HeaderAvatar avatar={user.avatar} username={user.username} />
                      <span>{user.username}</span>
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
    </>
  );
}

export { Header };

