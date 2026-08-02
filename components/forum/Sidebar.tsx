"use client";

import { useState, useEffect } from "react";
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

interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

interface SidebarProps {
  stats: {
    totalPosts: number;
    totalUsers: number;
    todayPosts: number;
  };
  hotPosts: Post[];
}

// 标签加载状态：加载中 / 成功 / 失败
type TagsState =
  | { status: "loading" }
  | { status: "success"; tags: Tag[] }
  | { status: "error"; message: string; detail?: string };

export default function Sidebar({ stats, hotPosts }: SidebarProps) {
  const [tagsState, setTagsState] = useState<TagsState>({ status: "loading" });

  // 获取热门标签
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch("/api/forum/tags");

        // 处理 HTTP 错误
        if (!res.ok) {
          let errorDetail = `服务器返回 ${res.status}`;
          try {
            const errorData = await res.json();
            if (errorData.detail) {
              errorDetail = errorData.detail;
            }
          } catch {
            // JSON 解析失败，使用默认描述
          }

          const statusText = res.status === 503
            ? "数据库未配置或服务不可用"
            : `请求失败 (${res.status})`;

          setTagsState({
            status: "error",
            message: statusText,
            detail: errorDetail,
          });
          return;
        }

        const data = await res.json();

        // 验证返回数据格式
        if (!Array.isArray(data)) {
          console.error("[Sidebar] 标签 API 返回格式异常:", data);
          setTagsState({
            status: "error",
            message: "数据格式异常",
            detail: "API 返回了非预期的数据格式",
          });
          return;
        }

        setTagsState({ status: "success", tags: data.slice(0, 20) });
      } catch (err) {
        // 网络错误
        console.error("[Sidebar] 获取标签失败:", err);
        const errorMessage = err instanceof Error ? err.message : "网络请求失败";
        setTagsState({
          status: "error",
          message: "网络请求失败",
          detail: errorMessage,
        });
      }
    };
    fetchTags();
  }, []);

  // 标签字体大小根据帖子数量映射
  const getTagFontSize = (count: number, maxCount: number) => {
    if (maxCount === 0) return "text-xs";
    const ratio = count / maxCount;
    if (ratio > 0.75) return "text-base font-bold";
    if (ratio > 0.5) return "text-sm font-semibold";
    if (ratio > 0.25) return "text-sm font-medium";
    return "text-xs";
  };

  const tags = tagsState.status === "success" ? tagsState.tags : [];
  const maxCount = tags.length > 0 ? Math.max(...tags.map((t) => t.postCount)) : 0;

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

      {/* 标签云 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-base">🏷️</span>
            <span>热门标签</span>
          </h3>
          <Link href="/forum" className="text-xs text-blue-500 hover:text-blue-600">
            全部
          </Link>
        </div>

        {tagsState.status === "loading" ? (
          <div className="flex flex-wrap gap-2 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-6 bg-gray-100 rounded-full" style={{ width: `${40 + Math.random() * 40}px` }} />
            ))}
          </div>
        ) : tagsState.status === "error" ? (
          <div className="text-center py-4">
            <p className="text-2xl mb-1 opacity-40">⚠️</p>
            <p className="text-xs text-red-500 font-medium">{tagsState.message}</p>
            {tagsState.detail && (
              <p className="text-xs text-gray-400 mt-1 max-w-full overflow-hidden text-ellipsis" title={tagsState.detail}>
                {tagsState.detail}
              </p>
            )}
            <button
              onClick={() => {
                setTagsState({ status: "loading" });
                // 触发重新获取 - useEffect 依赖数组为空，需要手动触发
                window.location.reload();
              }}
              className="mt-2 text-xs text-blue-500 hover:text-blue-600 underline"
            >
              点击重试
            </button>
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-2xl mb-1 opacity-40">🏷️</p>
            <p className="text-xs text-gray-400">暂无标签</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/forum?tag=${encodeURIComponent(tag.slug)}`}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors ${getTagFontSize(tag.postCount, maxCount)}`}
              >
                {tag.name}
                {tag.postCount > 0 && (
                  <span className="text-[10px] text-blue-400">{tag.postCount}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 热门话题 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-base">🔥</span>
            <span>热门话题</span>
          </h3>
          <Link href="/forum" className="text-xs text-blue-500 hover:text-blue-600">
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
                    <p className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors line-clamp-2 leading-relaxed">
                      {post.title}
                    </p>
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

      {/* RSS 订阅 */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <span className="text-base">📡</span>
          <span>RSS 订阅</span>
        </h3>
        <p className="text-xs text-gray-500 mb-3">订阅论坛最新动态</p>
        <a
          href="/api/forum/rss"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 bg-white border border-orange-300 rounded-lg hover:bg-orange-100 transition-colors"
        >
          📋 获取 RSS 链接
        </a>
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
