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

type TagsState =
  | { status: "loading" }
  | { status: "success"; tags: Tag[] }
  | { status: "error"; message: string; detail?: string };

// SVG 图标
const FireIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.24 17 7c.5 1 1.5 2 2 3a8 8 0 01-1.343 8.657z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
  </svg>
);

const TagIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const ChartIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const RssIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
  </svg>
);

const LinkIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const EditIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const ListIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const MsgIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const StarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

const MailIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const ToolIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
  </svg>
);

export default function Sidebar({ stats, hotPosts }: SidebarProps) {
  const [tagsState, setTagsState] = useState<TagsState>({ status: "loading" });

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch("/api/forum/tags");
        if (!res.ok) {
          let errorDetail = `服务器返回 ${res.status}`;
          try {
            const errorData = await res.json();
            if (errorData.detail) errorDetail = errorData.detail;
          } catch {
            // ignore
          }
          const statusText = res.status === 503 ? "数据库未配置或服务不可用" : `请求失败 (${res.status})`;
          setTagsState({ status: "error", message: statusText, detail: errorDetail });
          return;
        }
        const data = await res.json();
        if (!Array.isArray(data)) {
          setTagsState({ status: "error", message: "数据格式异常", detail: "API 返回了非预期的数据格式" });
          return;
        }
        setTagsState({ status: "success", tags: data.slice(0, 20) });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "网络请求失败";
        setTagsState({ status: "error", message: "网络请求失败", detail: errorMessage });
      }
    };
    fetchTags();
  }, []);

  const tags = tagsState.status === "success" ? tagsState.tags : [];

  // 快捷入口配置
  const quickLinks = [
    { href: "/forum/new", label: "发帖", icon: EditIcon },
    { href: "/forum/my/posts", label: "我的帖子", icon: ListIcon },
    { href: "/forum/my/comments", label: "我的评论", icon: MsgIcon },
    { href: "/forum/my/favorites", label: "我的收藏", icon: StarIcon },
    { href: "/messages", label: "私信", icon: MailIcon },
    { href: "/tools", label: "工具库", icon: ToolIcon },
  ];

  return (
    <aside className="space-y-4">
      {/* 社区统计 */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ChartIcon className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">社区统计</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">{stats.totalPosts}</p>
            <p className="text-xs text-gray-400 mt-0.5">帖子</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-xl font-bold text-gray-900">{stats.totalUsers}</p>
            <p className="text-xs text-gray-400 mt-0.5">用户</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-indigo-600">{stats.todayPosts}</p>
            <p className="text-xs text-gray-400 mt-0.5">今日</p>
          </div>
        </div>
      </div>

      {/* 热门话题 */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FireIcon className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-gray-700">热门话题</h3>
          </div>
        </div>

        {hotPosts.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-300">暂无热门话题</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {hotPosts.map((post, index) => (
              <li key={post.id}>
                <Link href={`/forum/post/${post.id}`} className="flex items-start gap-3 group py-0.5">
                  <span
                    className={`flex-shrink-0 w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded ${
                      index === 0
                        ? "bg-red-500 text-white"
                        : index === 1
                          ? "bg-orange-500 text-white"
                          : index === 2
                            ? "bg-amber-500 text-white"
                            : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-600 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                      {post.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>{post.likeCount} 赞</span>
                      <span>{post.viewCount} 浏览</span>
                      <span>{post.commentCount} 评论</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 标签云 */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TagIcon className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">热门标签</h3>
          </div>
        </div>

        {tagsState.status === "loading" ? (
          <div className="flex flex-wrap gap-2 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-6 bg-gray-100 rounded-full" style={{ width: `${40 + Math.random() * 40}px` }} />
            ))}
          </div>
        ) : tagsState.status === "error" ? (
          <div className="text-center py-4">
            <p className="text-xs text-red-500 font-medium">{tagsState.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-xs text-indigo-500 hover:text-indigo-600 underline"
            >
              点击重试
            </button>
          </div>
        ) : tags.length === 0 ? (
          <p className="text-sm text-gray-300 text-center py-4">暂无标签</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/forum?tag=${encodeURIComponent(tag.slug)}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              >
                {tag.name}
                {tag.postCount > 0 && (
                  <span className="text-[10px] text-gray-400">{tag.postCount}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 快捷入口 */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-5">
        <div className="flex items-center gap-2 mb-4">
          <LinkIcon className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">快捷入口</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex flex-col items-center gap-1.5 py-3 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-indigo-600 transition-colors"
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* RSS 订阅 */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200/80 p-5">
        <div className="flex items-center gap-2 mb-2">
          <RssIcon className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-gray-700">RSS 订阅</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">订阅论坛最新动态</p>
        <a
          href="/api/forum/rss"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:text-gray-900 transition-colors"
        >
          获取 RSS 链接
        </a>
      </div>
    </aside>
  );
}
