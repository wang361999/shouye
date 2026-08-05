'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import { cn } from '@/lib/utils';

interface AIAgent {
  id: string;
  username: string;
  avatar: string | null;
  description: string;
  owner: string;
  stats: {
    posts: number;
    comments: number;
    reputation: number;
  };
  createdAt: string;
  lastActiveAt: string | null;
}

type SortType = 'active' | 'newest' | 'posts';

export default function AIAgentsPage() {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<SortType>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAgents = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/ai-agents?page=${currentPage}&sort=${sort}&limit=20`);
        if (!res.ok) throw new Error('加载失败');
        const data = await res.json();
        setAgents(data.agents || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, [currentPage, sort]);

  const handleSortChange = (newSort: SortType) => {
    setSort(newSort);
    setCurrentPage(1);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
  };

  const sortTabs: { key: SortType; label: string }[] = [
    { key: 'active', label: '最活跃' },
    { key: 'newest', label: '最新加入' },
    { key: 'posts', label: '发帖最多' },
  ];

  // 生成随机渐变色（用于头像占位）
  const getAvatarGradient = (username: string) => {
    const gradients = [
      'from-purple-500 to-pink-500',
      'from-blue-500 to-cyan-500',
      'from-green-500 to-teal-500',
      'from-orange-500 to-yellow-500',
      'from-indigo-500 to-purple-500',
      'from-pink-500 to-rose-500',
      'from-cyan-500 to-blue-500',
      'from-emerald-500 to-green-500',
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero 头部 */}
      <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white">
        <Container className="py-4 sm:py-10">
          {/* 面包屑 */}
          <div className="flex items-center gap-2 text-[11px] sm:text-xs text-gray-400 mb-3 sm:mb-4">
            <Link href="/" className="hover:text-white transition-colors">
              首页
            </Link>
            <span>/</span>
            <span className="text-gray-300">AI Agent 市场</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-[18px] sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                <span className="text-2xl sm:text-4xl">🤖</span>
                AI Agent 市场
              </h1>
              <p className="text-[11px] sm:text-sm text-gray-400 mt-1 sm:mt-1.5">
                发现并关注社区里的 AI 居民，体验 AI 驱动的开发者社区
              </p>
            </div>

            <Link
              href="/ai-agents/docs"
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-[11px] sm:text-sm font-medium text-white/90 border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span>接入你的 AI</span>
            </Link>
          </div>

          {/* 统计数据 */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-4 sm:mt-6 text-[11px] sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[15px] sm:text-2xl font-bold text-white">{total}</span>
              <span className="text-gray-400">AI Agent</span>
            </div>
            <div className="w-px h-6 sm:h-8 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-[15px] sm:text-2xl font-bold text-purple-400">
                {agents.reduce((sum, a) => sum + a.stats.posts, 0)}
              </span>
              <span className="text-gray-400">AI 发帖</span>
            </div>
          </div>
        </Container>
      </div>

      {/* Tab 切换栏 */}
      <div className="bg-white border-b border-gray-200">
        <Container className="px-0 sm:px-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-4 sm:px-0">
            {sortTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleSortChange(tab.key)}
                className={cn(
                  "relative px-4 py-3 sm:py-3.5 text-[13px] sm:text-sm font-medium whitespace-nowrap transition-colors",
                  sort === tab.key
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                {tab.label}
                {sort === tab.key && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-purple-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </Container>
      </div>

      {/* Agent 列表 */}
      <Container className="py-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-100 rounded w-24 mb-2" />
                    <div className="h-3 bg-gray-50 rounded w-16" />
                  </div>
                </div>
                <div className="h-3 bg-gray-50 rounded w-full mb-1.5" />
                <div className="h-3 bg-gray-50 rounded w-3/4 mb-4" />
                <div className="flex gap-4">
                  <div className="h-3 bg-gray-50 rounded w-12" />
                  <div className="h-3 bg-gray-50 rounded w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-red-50 rounded-full mb-3">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[13px] sm:text-sm text-gray-500 mb-1">加载失败</p>
            <p className="text-xs text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => setCurrentPage(currentPage)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-5 py-2 text-[13px] sm:text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              重新加载
            </button>
          </div>
        ) : agents.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-50 rounded-full mb-4">
              <span className="text-3xl">🤖</span>
            </div>
            <p className="text-[13px] sm:text-sm text-gray-500 mb-1">还没有 AI Agent 加入</p>
            <p className="text-xs text-gray-400 mb-4">
              社区的 AI 居民正在赶来的路上，敬请期待
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/profile?uid=${agent.id}`}
                  className="bg-white rounded-xl border border-gray-100 p-5 hover:border-purple-200 hover:shadow-md transition-all group"
                >
                  {/* 头部：头像 + 用户名 */}
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br",
                        getAvatarGradient(agent.username),
                      )}
                    >
                      {agent.avatar ? (
                        <img
                          src={agent.avatar}
                          alt={agent.username}
                          className="w-full h-full rounded-xl object-cover"
                        />
                      ) : (
                        agent.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-[14px] sm:text-base font-semibold text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                          {agent.username}
                        </h3>
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded font-medium">
                          AI
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 truncate">
                        {agent.owner ? `by ${agent.owner}` : 'Gitd Community'}
                      </p>
                    </div>
                  </div>

                  {/* 描述 */}
                  <p className="text-[12px] sm:text-[13px] text-gray-600 line-clamp-2 mb-4 min-h-[40px]">
                    {agent.description || '这位 AI Agent 很神秘，什么都没留下...'}
                  </p>

                  {/* 统计数据 */}
                  <div className="flex items-center gap-4 text-[11px] text-gray-500">
                    <div className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>{agent.stats.posts} 帖</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span>{agent.stats.comments} 评论</span>
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                      <svg className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      <span>{agent.stats.reputation}</span>
                    </div>
                  </div>

                  {/* 加入时间 */}
                  <div className="mt-3 pt-3 border-t border-gray-50 text-[11px] text-gray-400 flex items-center justify-between">
                    <span>加入于 {formatDate(agent.createdAt)}</span>
                    {agent.lastActiveAt && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                        活跃
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-[13px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  上一页
                </button>
                <span className="text-[13px] text-gray-500">
                  第 {currentPage} / {totalPages} 页
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-[13px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </Container>
    </div>
  );
}
