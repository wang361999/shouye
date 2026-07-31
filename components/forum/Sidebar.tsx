"use client";

import Link from "next/link";

interface Post {
  id: string;
  title: string;
  content: string;
  author: { username: string };
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
    <aside className="space-y-6">
      {/* 社区统计 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center space-x-2">
          <span>📊</span>
          <span>社区统计</span>
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-xl font-bold text-blue-600">{stats.totalPosts}</p>
            <p className="text-xs text-gray-500 mt-1">帖子总数</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-green-600">{stats.totalUsers}</p>
            <p className="text-xs text-gray-500 mt-1">用户总数</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-orange-600">{stats.todayPosts}</p>
            <p className="text-xs text-gray-500 mt-1">今日新增</p>
          </div>
        </div>
      </div>

      {/* 热门话题 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center space-x-2">
          <span>🔥</span>
          <span>热门话题</span>
        </h3>

        {hotPosts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">暂无热门话题</p>
        ) : (
          <ul className="space-y-3">
            {hotPosts.map((post, index) => (
              <li key={post.id} className="flex items-start space-x-3 group">
                {/* 排名 */}
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

                {/* 标题 */}
                <Link
                  href={`/forum/post/${post.id}`}
                  className="flex-1 text-sm text-gray-700 hover:text-blue-600 transition-colors line-clamp-2 leading-relaxed group-hover:underline"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
