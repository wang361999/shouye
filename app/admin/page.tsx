"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  StatCard,
  Icons,
} from "@/components/admin/ui";

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
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    title: "工具管理",
    desc: "管理工具的增删改查",
    href: "/admin/tools",
    icon: Icons.Tool,
    color: "blue",
  },
  {
    title: "添加工具",
    desc: "添加新的工具",
    href: "/admin/tools/new",
    icon: Icons.Plus,
    color: "green",
  },
  {
    title: "帖子管理",
    desc: "管理论坛帖子",
    href: "/admin/forum/posts",
    icon: Icons.Chat,
    color: "purple",
  },
  {
    title: "评论管理",
    desc: "审核和管理评论",
    href: "/admin/forum/comments",
    icon: Icons.Comment,
    color: "orange",
  },
  {
    title: "论坛分类",
    desc: "管理论坛分类",
    href: "/admin/forum/categories",
    icon: Icons.Tag,
    color: "pink",
  },
  {
    title: "工具分类",
    desc: "管理工具分类标签",
    href: "/admin/tools/categories",
    icon: Icons.Box,
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
            adminFetch("/api/tools"),
            adminFetch("/api/forum/posts?admin=1&limit=200"),
            adminFetch("/api/forum/comments?approved=false&limit=1"),
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
        <PageHeader
          title="仪表盘"
          subtitle={`欢迎回来，${user?.username}！这里是管理后台概览。`}
        />

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label={`工具总数 · 在线 ${stats.toolOnline}`}
            value={loading ? "—" : stats.toolTotal}
            icon={<Icons.Tool />}
            color="blue"
          />
          <StatCard
            label={`帖子总数 · 今日 ${stats.postToday}`}
            value={loading ? "—" : stats.postTotal}
            icon={<Icons.Chat />}
            color="purple"
          />
          <StatCard
            label="待审评论 · 条待处理"
            value={loading ? "—" : stats.commentPending}
            icon={<Icons.Comment />}
            color={stats.commentPending > 0 ? "yellow" : "gray"}
          />
          <StatCard
            label="论坛分类 · 个分类"
            value={loading ? "—" : stats.categoryTotal}
            icon={<Icons.Tag />}
            color="indigo"
          />
        </div>

        {/* 快捷入口 */}
        <Card>
          <CardHeader title="快捷入口" />
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {QUICK_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all hover:shadow-sm ${
                      colorMap[link.color]
                    } hover:-translate-y-0.5`}
                  >
                    <Icon className="w-6 h-6 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium">{link.title}</div>
                      <div className="text-xs opacity-75 mt-0.5 truncate">
                        {link.desc}
                      </div>
                    </div>
                    <Icons.ChevronRight className="w-4 h-4 ml-auto flex-shrink-0 opacity-50" />
                  </Link>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
}
