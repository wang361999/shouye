'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import UserAvatar from '@/components/common/UserAvatar';

interface SeriesPost {
  id: string;
  title: string;
  partLabel: string;
  partNumber: number;
  subTitle: string;
  createdAt: string;
  viewCount: number;
  commentCount: number;
  author: { username: string; avatar: string | null };
  category: { name: string; slug: string } | null;
}

interface SeriesGroup {
  id: string;
  name: string;
  postCount: number;
  posts: SeriesPost[];
  firstPostAt: string;
  lastPostAt: string;
  totalViews: number;
}

function formatNumber(num: number): string {
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
  return num.toLocaleString();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function SeriesPage() {
  const [series, setSeries] = useState<SeriesGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/forum/series')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!mounted) return;
        if (data?.series) {
          setSeries(data.series);
          // 默认展开第一个
          if (data.series.length > 0) {
            setExpandedId(data.series[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <Container className="py-8 max-w-4xl">
      {/* 页面标题 */}
      <div className="mb-8">
        <Link
          href="/forum"
          className="inline-block text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
        >
          &larr; 返回论坛
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          📚 系列文章专题
        </h1>
        <p className="text-gray-500 text-sm">
          系统化的技术教程合集，循序渐进，一次学透
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-5">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-4" />
              <div className="space-y-2">
                {[1, 2, 3].map(j => (
                  <div key={j} className="h-10 bg-gray-50 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : series.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📖</div>
          <p className="text-gray-500 mb-2">还没有系列文章</p>
          <p className="text-gray-400 text-sm">系列文章正在整理中，敬请期待</p>
        </div>
      ) : (
        <div className="space-y-4">
          {series.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden transition-all hover:border-blue-200 hover:shadow-md"
            >
              {/* 系列头部 */}
              <button
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-gray-900 truncate">
                      {s.name}
                    </h2>
                    <span className="shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                      {s.postCount} 篇
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>📅 {formatDate(s.firstPostAt)} ~ {formatDate(s.lastPostAt)}</span>
                    <span>👁 {formatNumber(s.totalViews)} 总浏览</span>
                  </div>
                </div>
                <div className={`shrink-0 text-gray-400 transition-transform ${expandedId === s.id ? 'rotate-180' : ''}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* 系列文章列表 */}
              {expandedId === s.id && (
                <div className="border-t border-gray-100">
                  <div className="divide-y divide-gray-50">
                    {s.posts.map((post, idx) => (
                      <Link
                        key={post.id}
                        href={`/forum/post/${post.id}`}
                        className="flex items-start gap-3 p-4 hover:bg-blue-50/30 transition-colors group"
                      >
                        {/* 序号 */}
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-sm font-bold flex items-center justify-center">
                          {idx + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                            {post.subTitle || post.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            <span className="text-purple-500 font-medium">{post.partLabel}</span>
                            {post.category && (
                              <span>{post.category.name}</span>
                            )}
                            <span>👁 {formatNumber(post.viewCount)}</span>
                            <span>💬 {post.commentCount}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
