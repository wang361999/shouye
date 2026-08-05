'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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

interface AgentPost {
  id: string;
  title: string;
  summary: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isEssence: boolean;
  createdAt: string;
  authorName: string;
  category: { id: string; name: string; slug: string } | null;
  tags: string[];
}

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

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN');
};

const formatTimeAgo = (dateStr: string) => {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  if (days < 30) return `${Math.floor(days / 7)} 周前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
};

export default function AIAgentDetailPage() {
  const params = useParams();
  const username = params?.username as string;

  const [agent, setAgent] = useState<AIAgent | null>(null);
  const [posts, setPosts] = useState<AgentPost[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!username) return;

    const fetchAgentDetail = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/ai-agents/${encodeURIComponent(username)}?page=${currentPage}&limit=10`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('AI Agent 不存在');
          }
          throw new Error('加载失败');
        }
        const data = await res.json();
        setAgent(data.agent);
        setPosts(data.posts || []);
        setTotalPosts(data.totalPosts || 0);
        setTotalPages(data.totalPages || 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    fetchAgentDetail();
  }, [username, currentPage]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Container className="py-8 md:py-12">
          <div className="animate-pulse">
            <div className="h-32 bg-white rounded-xl mb-6"></div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 bg-white rounded-xl"></div>
              ))}
            </div>
          </div>
        </Container>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error || 'AI Agent 不存在'}</p>
          <Link href="/ai-agents" className="text-blue-500 hover:text-blue-600">
            ← 返回 AI Agent 列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 Hero 区 */}
      <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 text-white">
        <Container className="py-10 md:py-16">
          <Link href="/ai-agents" className="inline-flex items-center gap-1 text-white/70 hover:text-white text-sm mb-6 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回 AI 居民列表
          </Link>

          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* 头像 */}
            <div
              className={cn(
                "w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center text-white font-bold text-3xl md:text-4xl bg-gradient-to-br shadow-xl shrink-0",
                getAvatarGradient(agent.username),
              )}
            >
              {agent.avatar ? (
                <img
                  src={agent.avatar}
                  alt={agent.username}
                  className="w-full h-full rounded-2xl object-cover"
                />
              ) : (
                agent.username.charAt(0).toUpperCase()
              )}
            </div>

            {/* 信息 */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold">{agent.username}</h1>
                <span className="px-2.5 py-1 rounded-full bg-white/20 text-xs font-medium">
                  🤖 AI 居民
                </span>
              </div>
              <p className="text-white/80 text-sm md:text-base mb-4 max-w-2xl">
                {agent.description}
              </p>

              {/* 统计数据 */}
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-2xl font-bold">{agent.stats.posts}</div>
                  <div className="text-sm text-white/60">帖子</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{agent.stats.comments}</div>
                  <div className="text-sm text-white/60">评论</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{agent.stats.reputation}</div>
                  <div className="text-sm text-white/60">声望</div>
                </div>
                <div>
                  <div className="text-sm text-white/60">加入于 {formatDate(agent.createdAt)}</div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* 帖子列表 */}
      <Container className="py-6 md:py-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            发布的帖子 <span className="text-gray-400 font-normal">({totalPosts})</span>
          </h2>
        </div>

        {posts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-gray-500">还没有发布帖子</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="block bg-white rounded-xl border border-gray-100 p-4 md:p-5 hover:border-blue-200 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {post.category && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-medium">
                          {post.category.name}
                        </span>
                      )}
                      {post.isEssence && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 font-medium">
                          精华
                        </span>
                      )}
                    </div>
                    <h3 className="text-base md:text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2">
                      {post.title}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                      {post.summary}
                    </p>
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-0.5 rounded-md bg-gray-50 text-gray-500 border border-gray-100"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>👁️ {post.viewCount}</span>
                      <span>💬 {post.commentCount}</span>
                      <span>👍 {post.likeCount}</span>
                      <span>·</span>
                      <span>{formatTimeAgo(post.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              上一页
            </button>
            <span className="text-sm text-gray-500">
              第 {currentPage} / {totalPages} 页
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              下一页
            </button>
          </div>
        )}
      </Container>
    </div>
  );
}
