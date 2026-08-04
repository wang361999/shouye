'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import { formatTimeAgo, truncateText, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ============ 类型定义 ============
interface SearchPost {
  id: string;
  title: string;
  content: string;
  author: { username: string };
  category: { name: string } | null;
  createdAt: string;
}

interface SearchTool {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  url: string;
}

type ResultTab = 'posts' | 'tools';

// ============ 搜索内容组件（使用 useSearchParams） ============
function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState<ResultTab>('posts');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [tools, setTools] = useState<SearchTool[]>([]);
  const [total, setTotal] = useState(0);
  const [postsTotal, setPostsTotal] = useState(0);
  const [toolsTotal, setToolsTotal] = useState(0);

  // ============ 执行搜索 ============
  const doSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setPosts([]);
        setTools([]);
        setTotal(0);
        setPostsTotal(0);
        setToolsTotal(0);
        setSearched(false);
        return;
      }

      setLoading(true);
      setSearched(true);
      try {
        const params = new URLSearchParams({
          q: trimmed,
          page: '1',
          limit: '10',
          type: 'all',
        });
        const res = await fetch(`/api/search?${params}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || '搜索失败');
        }
        const data = await res.json();
        setPosts(data.posts || []);
        setTools(data.tools || []);
        setTotal(data.total || 0);
        setPostsTotal(data.postsTotal || 0);
        setToolsTotal(data.toolsTotal || 0);
      } catch (err: any) {
        toast.error(err.message || '搜索失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ============ 从 URL 参数初始化搜索 ============
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
    setInputValue(q);
    if (q) {
      doSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ============ 提交搜索 ============
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) {
      toast.error('请输入搜索关键词');
      return;
    }
    setQuery(trimmed);
    // 更新 URL 参数
    const params = new URLSearchParams(searchParams.toString());
    params.set('q', trimmed);
    router.push(`/search?${params.toString()}`);
    doSearch(trimmed);
  }

  // ============ 渲染 ============
  return (
    <Container className="py-8">
      {/* 返回链接 */}
      <Link
        href="/"
        className="inline-block text-[11px] sm:text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
      >
        &larr; 返回首页
      </Link>

      {/* 页面标题 */}
      <h1 className="text-[18px] sm:text-2xl font-bold text-gray-900 mb-6">🔍 全站搜索</h1>

      {/* 搜索框 */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="搜索帖子或工具..."
              className="w-full pl-10 pr-4 py-2.5 text-[11px] sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white text-[11px] sm:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? '搜索中...' : '搜索'}
          </button>
        </div>
      </form>

      {/* 搜索结果 */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse"
            >
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-full mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : !searched ? (
        /* 初始状态 */
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-5xl mb-3">🔍</p>
          <p className="text-gray-500 mb-1">输入关键词开始搜索</p>
          <p className="text-[11px] sm:text-sm text-gray-400">
            可以搜索论坛帖子和工具箱中的工具
          </p>
        </div>
      ) : total === 0 ? (
        /* 无结果 */
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-5xl mb-3">📭</p>
          <p className="text-gray-500 mb-1">
            未找到与「{query}」相关的内容
          </p>
          <p className="text-[11px] sm:text-sm text-gray-400">试试其他关键词吧</p>
        </div>
      ) : (
        <>
          {/* 结果统计 */}
          <p className="text-[11px] sm:text-sm text-gray-500 mb-4">
            共找到 <span className="font-medium text-gray-700">{total}</span>{' '}
            条与「{query}」相关的结果
          </p>

          {/* Tab 切换 */}
          <div className="flex gap-1 border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('posts')}
              className={cn(
                'px-4 py-2.5 text-[11px] sm:text-sm font-medium border-b-2 transition-colors',
                activeTab === 'posts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              📝 帖子
              {postsTotal > 0 && (
                <span className="ml-1 text-[11px] sm:text-xs text-gray-400">
                  ({postsTotal})
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={cn(
                'px-4 py-2.5 text-[11px] sm:text-sm font-medium border-b-2 transition-colors',
                activeTab === 'tools'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              🧩 工具
              {toolsTotal > 0 && (
                <span className="ml-1 text-[11px] sm:text-xs text-gray-400">
                  ({toolsTotal})
                </span>
              )}
            </button>
          </div>

          {/* 帖子结果 */}
          {activeTab === 'posts' && (
            <div>
              {posts.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                  <p className="text-4xl mb-3">📝</p>
                  <p className="text-gray-400">没有找到相关帖子</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 hover:shadow-md transition-shadow"
                    >
                      {/* 分类标签 */}
                      {post.category && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] sm:text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 mb-2">
                          {post.category.name}
                        </span>
                      )}

                      {/* 标题（可点击） */}
                      <h3 className="text-[13px] sm:text-lg font-semibold mb-1.5">
                        <Link
                          href={`/forum/post/${post.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          {post.title}
                        </Link>
                      </h3>

                      {/* 内容摘要 */}
                      <p className="text-[11px] sm:text-sm text-gray-500 mb-3 line-clamp-2 leading-relaxed">
                        {truncateText(post.content, 200)}
                      </p>

                      {/* 底部信息 */}
                      <div className="flex items-center text-[11px] sm:text-xs text-gray-400 space-x-3">
                        <span className="text-gray-600 font-medium">
                          {post.author.username}
                        </span>
                        <span>·</span>
                        <span>{formatTimeAgo(post.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 工具结果 */}
          {activeTab === 'tools' && (
            <div>
              {tools.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                  <p className="text-4xl mb-3">🧩</p>
                  <p className="text-gray-400">没有找到相关工具</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tools.map((tool) => (
                    <div
                      key={tool.id}
                      className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow flex items-start gap-4"
                    >
                      {/* 图标 */}
                      <div className="text-[20px] sm:text-3xl flex-shrink-0">
                        {tool.icon || '🔧'}
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        {/* 名称（可点击） */}
                        <h3 className="text-[13px] sm:text-base font-semibold mb-1">
                          <Link
                            href={tool.url}
                            className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {tool.name}
                          </Link>
                        </h3>
                        {/* 描述 */}
                        <p className="text-[11px] sm:text-sm text-gray-500 line-clamp-2 leading-relaxed">
                          {tool.description || '暂无描述'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Container>
  );
}

// ============ 默认导出（包裹 Suspense） ============
// useSearchParams 需要 Suspense 边界
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <Container className="py-16 text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
          <p className="text-[11px] sm:text-sm text-gray-500">加载中...</p>
        </Container>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
