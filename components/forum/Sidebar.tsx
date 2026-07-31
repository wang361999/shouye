"use client";

import Link from "next/link";

interface Post {
  id: string;
  title: string;
  content: string;
  author: { username: string; avatar?: string | null };
  category: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isEssence: boolean;
  createdAt: string;
}

interface SidebarProps {
  stats: {
    totalPosts: number;
    totalUsers: number;
    todayPosts: number;
  };
  hotPosts: Post[];
}

export default function Sidebar({ stats, hotPosts }: SidebarProps) {
  return (
    <aside className="space-y-5">
      {/* 社区统计 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-base">📊</span>
          <span>社区统计</span>
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-blue-50/50">
            <p className="text-2xl font-bold text-blue-600">{stats.totalPosts}</p>
            <p className="text-xs text-gray-500 mt-0.5">帖子</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-green-50/50">
            <p className="text-2xl font-bold text-green-600">{stats.totalUsers}</p>
            <p className="text-xs text-gray-500 mt-0.5">用户</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-orange-50/50">
            <p className="text-2xl font-bold text-orange-600">{stats.todayPosts}</p>
            <p className="text-xs text-gray-500 mt-0.5">今日</p>
          </div>
        </div>
      </div>

      {/* 热门话题 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-base">🔥</span>
            <span>热门话题</span>
          </h3>
          <Link
            href="/forum"
            className="text-xs text-blue-500 hover:text-blue-600"
          >
            查看全部
          </Link>
        </div>

        {hotPosts.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-3xl mb-2 opacity-40">📝</p>
            <p className="text-sm text-gray-400">暂无热门话题</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {hotPosts.map((post, index) => (
              <li key={post.id}>
                <Link
                  href={`/forum/post/${post.id}`}
                  className="flex items-start gap-3 group py-1"
                >
                  {/* 排名徽章 */}
                  <span
                    className={`flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs font-bold rounded ${
                      index === 0
                        ? "bg-red-500 text-white"
                        : index === 1
                          ? "bg-orange-500 text-white"
                          : index === 2
                            ? "bg-yellow-500 text-white"
                            : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {index + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    {/* 标题 */}
                    <p className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors line-clamp-2 leading-relaxed">
                      {post.title}
                    </p>
                    {/* 统计 */}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>❤️ {post.likeCount}</span>
                      <span>👁 {post.viewCount}</span>
                      <span>💬 {post.commentCount}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 快捷入口 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-base">🚀</span>
          <span>快捷入口</span>
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/forum/new"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
          >
            ✏️ 发帖
          </Link>
          <Link
            href="/forum/my/posts"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
          >
            📋 我的帖子
          </Link>
          <Link
            href="/forum/my/comments"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
          >
            💬 我的评论
          </Link>
          <Link
            href="/tools"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
          >
            🛠️ 工具库
          </Link>
        </div>
      </div>
    </aside>
  );
}
