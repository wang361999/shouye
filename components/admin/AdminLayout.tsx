"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";
import { Icons, Spinner } from "@/components/admin/ui";

type IconType = React.ComponentType<{ className?: string }>;

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: IconType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "概览",
    items: [
      { key: "dashboard", label: "仪表盘", href: "/admin", icon: Icons.Dashboard },
      { key: "free-dashboard", label: "运营看板", href: "/admin/free-dashboard", icon: Icons.Chart },
      { key: "auto-content", label: "AI 自动内容", href: "/admin/auto-content", icon: Icons.Robot },
      { key: "monitoring", label: "用量监控", href: "/admin/monitoring", icon: Icons.Chart },
      { key: "database", label: "数据库", href: "/admin/database", icon: Icons.Database },
    ],
  },
  {
    title: "工具管理",
    items: [
      { key: "tools", label: "工具列表", href: "/admin/tools", icon: Icons.Tool },
      { key: "tools-new", label: "添加工具", href: "/admin/tools/new", icon: Icons.Plus },
      { key: "tools-categories", label: "工具分类", href: "/admin/tools/categories", icon: Icons.Tag },
    ],
  },
  {
    title: "论坛管理",
    items: [
      { key: "forum-posts", label: "帖子管理", href: "/admin/forum/posts", icon: Icons.Chat },
      { key: "forum-comments", label: "评论管理", href: "/admin/forum/comments", icon: Icons.Comment },
      { key: "forum-categories", label: "论坛分类", href: "/admin/forum/categories", icon: Icons.Tag },
      { key: "forum-reports", label: "举报管理", href: "/admin/forum/reports", icon: Icons.Flag },
    ],
  },
  {
    title: "用户管理",
    items: [
      { key: "users", label: "用户列表", href: "/admin/users", icon: Icons.Users },
      { key: "users-logs", label: "操作日志", href: "/admin/users/logs", icon: Icons.Clipboard },
      { key: "profile", label: "个人中心", href: "/admin/profile", icon: Icons.User },
    ],
  },
  {
    title: "产品销售",
    items: [
      { key: "products", label: "产品管理", href: "/admin/products", icon: Icons.Box },
      { key: "orders", label: "订单管理", href: "/admin/orders", icon: Icons.Receipt },
      { key: "licenses", label: "授权管理", href: "/admin/licenses", icon: Icons.Scroll },
    ],
  },
  {
    title: "系统设置",
    items: [
      { key: "settings-general", label: "基本信息", href: "/admin/settings/general", icon: Icons.Settings },
      { key: "settings-sponsor", label: "赞助设置", href: "/admin/settings/sponsor", icon: Icons.Heart },
      { key: "settings-appearance", label: "外观定制", href: "/admin/settings/appearance", icon: Icons.Paint },
      { key: "settings-security", label: "安全设置", href: "/admin/settings/security", icon: Icons.Lock },
      { key: "settings-oauth-apps", label: "OAuth 应用", href: "/admin/oauth-apps", icon: Icons.Key },
      { key: "settings-seo", label: "SEO 设置", href: "/admin/settings/seo", icon: Icons.Globe },
      { key: "settings-agreements", label: "协议文档", href: "/admin/settings/agreements", icon: Icons.Doc },
    ],
  },
];

interface AdminLayoutProps {
  children: ReactNode;
  activeKey: string;
}

export default function AdminLayout({ children, activeKey }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, logout, hydrate, _hydrated } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!mounted || !_hydrated) return;
    if (!token || !user) {
      toast.error("请先登录");
      router.replace("/admin/login");
      return;
    }
    if (user.role !== "ADMIN") {
      toast.error("需要管理员权限");
      router.replace("/");
    }
  }, [mounted, _hydrated, token, user, router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!mounted || !_hydrated || !token || !user || user.role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner className="w-8 h-8 mx-auto mb-3" />
          <p className="text-sm text-gray-500">正在验证权限...</p>
        </div>
      </div>
    );
  }

  function handleLogout() {
    logout();
    toast.success("已退出登录");
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 h-14">
        <div className="flex items-center justify-between h-full px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100"
              aria-label="切换菜单"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
            <Link href="/admin" className="flex items-center gap-2">
              <span className="text-brand-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <span className="text-base font-semibold text-gray-900">Gitd 管理后台</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 transition-colors"
            >
              <Icons.ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">访问前台</span>
            </Link>
            <div className="h-5 w-px bg-gray-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-sm font-medium">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-600 hidden sm:inline">{user.username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
              <Icons.Logout className="w-4 h-4" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:block w-60 flex-shrink-0 border-r border-gray-200 bg-white h-[calc(100vh-3.5rem)] sticky top-14 self-start overflow-y-auto">
          <SidebarNav activeKey={activeKey} />
        </aside>

        {/* Sidebar - Mobile */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl overflow-y-auto animate-dropdown">
              <div className="h-14 flex items-center px-4 border-b border-gray-200">
                <span className="text-base font-semibold text-gray-900">导航菜单</span>
              </div>
              <SidebarNav activeKey={activeKey} />
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarNav({ activeKey }: { activeKey: string }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleGroup(title: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  return (
    <nav className="p-3 space-y-1">
      {NAV_GROUPS.map((group) => {
        const isCollapsed = collapsed.has(group.title);
        return (
          <div key={group.title}>
            <button
              onClick={() => toggleGroup(group.title)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
            >
              <span>{group.title}</span>
              <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? "rotate-180" : ""}`} />
            </button>
            {!isCollapsed && (
              <ul className="space-y-0.5 mb-2">
                {group.items.map((item) => {
                  const isActive = item.key === activeKey;
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? "bg-brand-50 text-brand-700 font-medium"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        <Icon className={`w-[18px] h-[18px] ${isActive ? "text-brand-600" : "text-gray-400"}`} />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
