"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";

interface DashboardStats {
  toolTotal: number;
  toolOnline: number;
  postTotal: number;
  postToday: number;
  commentPending: number;
  categoryTotal: number;
}

interface QuickLink {
  title: string;
  desc: string;
  href: string;
  icon: string;
  color: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    title: "工具管理",
    desc: "管理工具的增删改查",
    href: "/admin/tools",
    icon: "🧩",
    color: "blue",
  },
  {
    title: "添加工具",
    desc: "添加新的工具",
    href: "/admin/tools/new",
    icon: "➕",
    color: "green",
  },
  {
    title: "帖子管理",
    desc: "管理论坛帖子",
    href: "/admin/forum/posts",
    icon: "💬",
    color: "purple",
  },
  {
    title: "评论管理",
    desc: "审核和管理评论",
    href: "/admin/forum/comments",
    icon: "💭",
    color: "orange",
  },
  {
    title: "论坛分类",
    desc: "管理论坛分类",
    href: "/admin/forum/categories",
    icon: "🏷️",
    color: "pink",
  },
  {
    title: "工具分类",
    desc: "管理工具分类标签",
    href: "/admin/tools/categories",
    icon: "📂",
    color: "indigo",
  },
];

export default function AdminDashboardPage() {
  const { token, user } = useAppStore();
  const [stats, setStats] = useState<DashboardStats>({
    toolTotal: 0,
    toolOnline: 0,
    postTotal: 0,
    postToday: 0,
    commentPending: 0,
    categoryTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    async function fetchStats() {
      try {
        setLoading(true);
        // 并行获取各项统计
        const [toolsRes, postsRes, commentsRes, categoriesRes] =
          await Promise.all([
            fetch("/api/tools", {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch("/api/forum/posts?admin=1&limit=200", {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch("/api/forum/comments?approved=false&limit=1", {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch("/api/forum/categories"),
          ]);

        const toolsData = toolsRes.ok ? await toolsRes.json() : [];
        const postsData = postsRes.ok ? await postsRes.json() : { posts: [] };
        const commentsData = commentsRes.ok
          ? await commentsRes.json()
          : { total: 0 };
        const categoriesData = categoriesRes.ok
          ? await categoriesRes.json()
          : [];

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        setStats({
          toolTotal: toolsData.length,
          toolOnline: toolsData.filter((t: { isActive: boolean }) => t.isActive)
            .length,
          postTotal: postsData.posts?.length || 0,
          postToday:
            postsData.posts?.filter(
              (p: { createdAt: string }) =>
                new Date(p.createdAt).getTime() >= todayStart.getTime()
            ).length || 0,
          commentPending: commentsData.total || 0,
          categoryTotal: categoriesData.length,
        });
      } catch {
        // 忽略统计获取失败
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [token]);

  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-green-50 text-green-700 border-green-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
    orange: "bg-orange-50 text-orange-700 border-orange-100",
    pink: "bg-pink-50 text-pink-700 border-pink-100",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
  };

  return (
    <AdminLayout activeKey="dashboard">
      <div className="space-y-6">
        {/* 欢迎区 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📊 仪表盘</h1>
          <p className="mt-1 text-sm text-gray-500">
            欢迎回来，{user?.username}！这里是管理后台概览。
          </p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatBox
            label="工具总数"
            value={stats.toolTotal}
            sub={`在线 ${stats.toolOnline}`}
            icon="🧩"
            loading={loading}
          />
          <StatBox
            label="帖子总数"
            value={stats.postTotal}
            sub={`今日 ${stats.postToday}`}
            icon="💬"
            loading={loading}
          />
          <StatBox
            label="待审评论"
            value={stats.commentPending}
            sub="条待处理"
            icon="💭"
            loading={loading}
            highlight={stats.commentPending > 0}
          />
          <StatBox
            label="论坛分类"
            value={stats.categoryTotal}
            sub="个分类"
            icon="🏷️"
            loading={loading}
          />
        </div>

        {/* 快捷入口 */}
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            快捷入口
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all hover:shadow-sm ${
                  colorMap[link.color]
                } hover:-translate-y-0.5`}
              >
                <span className="text-2xl flex-shrink-0">{link.icon}</span>
                <div className="min-w-0">
                  <div className="font-medium">{link.title}</div>
                  <div className="text-xs opacity-75 mt-0.5 truncate">
                    {link.desc}
                  </div>
                </div>
                <svg
                  className="w-4 h-4 ml-auto flex-shrink-0 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

// ============ 统计卡片 ============
function StatBox({
  label,
  value,
  sub,
  icon,
  loading,
  highlight,
}: {
  label: string;
  value: number;
  sub: string;
  icon: string;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "bg-orange-50 border-orange-200"
          : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
        {highlight && (
          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {loading ? (
          <span className="inline-block w-8 h-6 bg-gray-100 rounded animate-pulse" />
        ) : (
          value
        )}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {label}
        <span className="ml-1 text-gray-400">· {sub}</span>
      </div>
    </div>
  );
}
