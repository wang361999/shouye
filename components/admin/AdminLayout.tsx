"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "概览",
    items: [
      { key: "dashboard", label: "仪表盘", href: "/admin", icon: "📊" },
      { key: "monitoring", label: "用量监控", href: "/admin/monitoring", icon: "📈" },
      { key: "database", label: "数据库", href: "/admin/database", icon: "🗄️" },
    ],
  },
  {
    title: "工具管理",
    items: [
      { key: "tools", label: "工具列表", href: "/admin/tools", icon: "🧩" },
      {
        key: "tools-new",
        label: "添加工具",
        href: "/admin/tools/new",
        icon: "➕",
      },
      {
        key: "tools-categories",
        label: "工具分类",
        href: "/admin/tools/categories",
        icon: "📂",
      },
    ],
  },
  {
    title: "论坛管理",
    items: [
      {
        key: "forum-posts",
        label: "帖子管理",
        href: "/admin/forum/posts",
        icon: "💬",
      },
      {
        key: "forum-comments",
        label: "评论管理",
        href: "/admin/forum/comments",
        icon: "💭",
      },
      {
        key: "forum-categories",
        label: "论坛分类",
        href: "/admin/forum/categories",
        icon: "🏷️",
      },
    ],
  },
  {
    title: "用户管理",
    items: [
      { key: "profile", label: "个人中心", href: "/admin/profile", icon: "🔑" },
      { key: "users", label: "用户列表", href: "/admin/users", icon: "👥" },
      {
        key: "users-logs",
        label: "操作日志",
        href: "/admin/users/logs",
        icon: "📋",
      },
    ],
  },
  {
    title: "产品销售",
    items: [
      { key: "products", label: "产品管理", href: "/admin/products", icon: "📦" },
      { key: "orders", label: "订单管理", href: "/admin/orders", icon: "📋" },
    ],
  },
  {
    title: "系统设置",
    items: [
      {
        key: "settings-general",
        label: "基本信息",
        href: "/admin/settings/general",
        icon: "⚙️",
      },
      {
        key: "settings-appearance",
        label: "外观定制",
        href: "/admin/settings/appearance",
        icon: "🎨",
      },
      {
        key: "settings-security",
        label: "安全设置",
        href: "/admin/settings/security",
        icon: "🔐",
      },
      {
        key: "settings-oauth-apps",
        label: "OAuth 应用",
        href: "/admin/oauth-apps",
        icon: "🔑",
      },
      {
        key: "settings-licenses",
        label: "授权管理",
        href: "/admin/licenses",
        icon: "📜",
      },
      {
        key: "settings-seo",
        label: "SEO设置",
        href: "/admin/settings/seo",
        icon: "📝",
      },
      {
        key: "settings-agreements",
        label: "协议文档",
        href: "/admin/settings/agreements",
        icon: "📄",
      },
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

  // 客户端挂载后触发 hydrate
  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  // 权限检查：等待 hydrate 完成后再判断
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

  // 切换路由时关闭移动端侧边栏
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // 未挂载或未鉴权时不渲染内容
  if (!mounted || !_hydrated || !token || !user || user.role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
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
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="flex items-center justify-between h-16 px-4 md:px-6">
          <div className="flex items-center gap-3">
            {/* 移动端菜单按钮 */}
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="切换菜单"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={
                    sidebarOpen
                      ? "M6 18L18 6M6 6l12 12"
                      : "M4 6h16M4 12h16M4 18h16"
                  }
                />
              </svg>
            </button>
            <Link href="/admin" className="flex items-center gap-2">
              <span className="text-2xl">🛠️</span>
              <span className="text-lg font-bold text-gray-900 hidden sm:inline">
                管理后台
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-blue-600 transition-colors hidden sm:inline"
            >
              访问前台
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-600 hidden sm:inline">
                {user.username}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-red-500 hover:text-red-700 transition-colors"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 侧边栏 - 桌面端 */}
        <aside className="hidden md:block w-60 flex-shrink-0 border-r border-gray-200 bg-white min-h-[calc(100vh-4rem)] sticky top-16 self-start">
          <SidebarNav activeKey={activeKey} />
        </aside>

        {/* 侧边栏 - 移动端抽屉 */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="absolute left-0 top-0 bottom-0 w-60 bg-white shadow-xl overflow-y-auto">
              <div className="h-16 flex items-center px-4 border-b border-gray-200">
                <span className="text-lg font-bold text-gray-900">导航菜单</span>
              </div>
              <SidebarNav activeKey={activeKey} />
            </aside>
          </div>
        )}

        {/* 主内容区 */}
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarNav({ activeKey }: { activeKey: string }) {
  return (
    <nav className="p-3 space-y-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <h3 className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {group.title}
          </h3>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const isActive = item.key === activeKey;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
