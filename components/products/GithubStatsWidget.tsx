'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

// ============ 类型定义 ============
interface GithubCommit {
  sha: string;
  message: string;
  author: string | null;
  authorAvatar: string | null;
  date: string | null;
  htmlUrl: string | null;
}

interface GithubContributor {
  login: string;
  avatarUrl: string | null;
  contributions: number;
  htmlUrl: string | null;
}

interface GithubData {
  available: boolean;
  owner?: string;
  repo?: string;
  error?: string;
  repoInfo?: {
    description: string | null;
    defaultBranch: string | null;
    language: string | null;
    stars: number;
    forks: number;
    openIssues: number;
    watchers: number;
    htmlUrl: string | null;
    homepage: string | null;
    topics: string[];
    updatedAt: string | null;
  };
  commits?: GithubCommit[];
  contributors?: GithubContributor[];
}

// ============ SVG 图标 ============
const StarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const ForkIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const IssueIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const CommitIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
  </svg>
);

const GithubIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const ExternalLinkIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

// ============ 工具函数 ============

/** 格式化数字：1000+ → 1.2k */
function formatCount(n: number): string {
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return String(n);
}

/** 格式化相对时间 */
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHr < 24) return `${diffHr} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} 周前`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)} 个月前`;
  return `${Math.floor(diffDay / 365)} 年前`;
}

/** 截断 commit message 到首行，最多 80 字符 */
function truncateCommitMessage(msg: string): string {
  const firstLine = msg.split('\n')[0];
  if (firstLine.length > 80) {
    return firstLine.slice(0, 77) + '...';
  }
  return firstLine;
}

// ============ 骨架屏 ============
function StatsSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-12 bg-gray-100" />
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-gray-50 rounded-lg" />
          ))}
        </div>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 bg-gray-50 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ 主组件 ============
interface GithubStatsWidgetProps {
  slug: string;
}

export default function GithubStatsWidget({ slug }: GithubStatsWidgetProps) {
  const [data, setData] = useState<GithubData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${slug}/github`);
      if (res.ok) {
        const json: GithubData = await res.json();
        setData(json);
      } else {
        setData({ available: false, error: '获取 GitHub 数据失败' });
      }
    } catch {
      setData({ available: false, error: '网络请求失败' });
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------- 加载中 ----------
  if (loading) {
    return <StatsSkeleton />;
  }

  // ---------- 不可用（无 GitHub 仓库或访问失败）----------
  if (!data || !data.available) {
    // 静默降级：不显示任何内容，避免干扰页面布局
    return null;
  }

  const { repoInfo, commits = [], contributors = [], owner, repo } = data;

  if (!repoInfo) return null;

  const repoFullName = `${owner}/${repo}`;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* ============ 头部：GitHub 仓库链接 ============ */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-gray-900 to-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          <GithubIcon className="w-5 h-5 text-white flex-shrink-0" />
          <span className="text-sm font-semibold text-white truncate">
            {repoFullName}
          </span>
        </div>
        {repoInfo.htmlUrl && (
          <a
            href={repoInfo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
            title="在 GitHub 查看"
          >
            <ExternalLinkIcon className="w-4 h-4" />
          </a>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* ============ 核心统计 ============ */}
        <div className="grid grid-cols-3 gap-3">
          {/* Stars */}
          <a
            href={repoInfo.htmlUrl ? `${repoInfo.htmlUrl}/stargazers` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center py-3 rounded-lg bg-amber-50 border border-amber-100 hover:border-amber-300 transition-colors group"
          >
            <StarIcon className="w-4 h-4 text-amber-500 mb-1" />
            <span className="text-lg font-bold text-gray-900">
              {formatCount(repoInfo.stars)}
            </span>
            <span className="text-[11px] text-gray-400">Stars</span>
          </a>

          {/* Forks */}
          <a
            href={repoInfo.htmlUrl ? `${repoInfo.htmlUrl}/network/members` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center py-3 rounded-lg bg-blue-50 border border-blue-100 hover:border-blue-300 transition-colors group"
          >
            <ForkIcon className="w-4 h-4 text-blue-500 mb-1" />
            <span className="text-lg font-bold text-gray-900">
              {formatCount(repoInfo.forks)}
            </span>
            <span className="text-[11px] text-gray-400">Forks</span>
          </a>

          {/* Issues */}
          <a
            href={repoInfo.htmlUrl ? `${repoInfo.htmlUrl}/issues` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center py-3 rounded-lg bg-green-50 border border-green-100 hover:border-green-300 transition-colors group"
          >
            <IssueIcon className="w-4 h-4 text-green-500 mb-1" />
            <span className="text-lg font-bold text-gray-900">
              {formatCount(repoInfo.openIssues)}
            </span>
            <span className="text-[11px] text-gray-400">Issues</span>
          </a>
        </div>

        {/* ============ 仓库元信息 ============ */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {repoInfo.language && (
            <span className="inline-flex items-center px-2 py-1 text-gray-600 bg-gray-50 border border-gray-100 rounded-md font-medium">
              {repoInfo.language}
            </span>
          )}
          {repoInfo.defaultBranch && (
            <span className="inline-flex items-center px-2 py-1 text-gray-500 bg-gray-50 border border-gray-100 rounded-md">
              分支: {repoInfo.defaultBranch}
            </span>
          )}
          {repoInfo.updatedAt && (
            <span className="inline-flex items-center px-2 py-1 text-gray-400">
              更新于 {formatRelativeTime(repoInfo.updatedAt)}
            </span>
          )}
        </div>

        {/* Topics */}
        {repoInfo.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {repoInfo.topics.slice(0, 6).map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center px-2 py-0.5 text-[11px] text-blue-600 bg-blue-50 rounded-full"
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        {/* ============ 最近提交 ============ */}
        {commits.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <CommitIcon className="w-3.5 h-3.5 text-gray-400" />
              <h4 className="text-xs font-semibold text-gray-700">最近提交</h4>
            </div>
            <ul className="space-y-2.5">
              {commits.map((commit) => (
                <li key={commit.sha}>
                  <a
                    href={commit.htmlUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2.5 group"
                  >
                    {/* 提交者头像 */}
                    {commit.authorAvatar ? (
                      <img
                        src={commit.authorAvatar}
                        alt={commit.author || ''}
                        className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-200 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                        {truncateCommitMessage(commit.message)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                        <span className="font-mono">
                          {commit.sha.slice(0, 7)}
                        </span>
                        {commit.author && (
                          <span>{commit.author}</span>
                        )}
                        <span>{formatRelativeTime(commit.date)}</span>
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ============ 贡献者 ============ */}
        {contributors.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-700 mb-3">贡献者</h4>
            <div className="flex flex-wrap items-center gap-2">
              {contributors.map((contributor) => (
                <a
                  key={contributor.login}
                  href={contributor.htmlUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-300 transition-colors group"
                  title={`${contributor.login} (${contributor.contributions} 次贡献)`}
                >
                  {contributor.avatarUrl ? (
                    <img
                      src={contributor.avatarUrl}
                      alt={contributor.login}
                      className="w-5 h-5 rounded-full"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-200" />
                  )}
                  <span className="text-xs text-gray-600 group-hover:text-gray-900 transition-colors">
                    {contributor.login}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {contributor.contributions}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
