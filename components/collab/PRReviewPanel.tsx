'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

// ============ Props ============
interface PRReviewPanelProps {
  owner: string;
  repo: string;
  projectId: string;
  token: string | null;
  isManager: boolean;
  onPRMerged?: () => void;
}

// ============ 数据类型 ============
interface PRInfo {
  number: number;
  title: string;
  body: string | null;
  state: string;
  htmlUrl: string;
  headBranch: string;
  baseBranch: string;
  user: string | null;
  userAvatar: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  draft: boolean;
  mergeable: boolean | null;
}

// ============ 工具函数 ============
function authHeaders(
  token: string | null,
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

// ============ 主组件 ============
export default function PRReviewPanel({
  owner,
  repo,
  projectId,
  token,
  isManager,
  onPRMerged,
}: PRReviewPanelProps) {
  const [prs, setPRs] = useState<PRInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // ============ 获取 PR 列表 ============
  const fetchPRs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ owner, repo, state: 'open' });
      const res = await fetch(
        `/api/collab/github/pull-requests?${params.toString()}`,
        { headers: authHeaders(token) },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || '获取 PR 列表失败');
      }
      setPRs(json?.data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '获取 PR 列表失败');
      setPRs([]);
    } finally {
      setLoading(false);
    }
  }, [owner, repo, token]);

  useEffect(() => {
    fetchPRs();
  }, [fetchPRs]);

  // ============ 合并 PR ============
  const handleMerge = useCallback(
    async (pr: PRInfo, method: 'merge' | 'squash' | 'rebase') => {
      const key = `merge-${pr.number}`;
      setActionLoading((prev) => ({ ...prev, [key]: true }));
      try {
        const res = await fetch('/api/collab/github/merge-pr', {
          method: 'POST',
          headers: authHeaders(token, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            owner,
            repo,
            prNumber: pr.number,
            projectId,
            commitTitle: `${pr.title} (#${pr.number})`,
            mergeMethod: method,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error || '合并失败');
        }
        toast.success(`PR #${pr.number} 已合并到 ${pr.baseBranch}`);
        // 从列表中移除已合并的 PR
        setPRs((prev) => prev.filter((p) => p.number !== pr.number));
        onPRMerged?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '合并失败');
      } finally {
        setActionLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    [owner, repo, projectId, token, onPRMerged],
  );

  // ============ 关闭 PR（拒绝） ============
  const handleClose = useCallback(
    async (pr: PRInfo) => {
      const key = `close-${pr.number}`;
      setActionLoading((prev) => ({ ...prev, [key]: true }));
      try {
        const res = await fetch('/api/collab/github/merge-pr', {
          method: 'PATCH',
          headers: authHeaders(token, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            owner,
            repo,
            prNumber: pr.number,
            projectId,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error || '关闭失败');
        }
        toast.success(`PR #${pr.number} 已关闭`);
        setPRs((prev) => prev.filter((p) => p.number !== pr.number));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '关闭失败');
      } finally {
        setActionLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    [owner, repo, projectId, token],
  );

  // ============ 刷新 ============
  const handleRefresh = () => {
    fetchPRs();
  };

  // ============ 渲染 ============
  if (!isManager) {
    // 非管理员不显示审核面板
    return null;
  }

  return (
    <div className="space-y-3">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            PR 审核管理
          </h3>
          {!loading && prs.length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 font-medium">
              {prs.length} 待审核
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-[12px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <span className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          刷新
        </button>
      </div>

      {/* PR 列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <span className="w-5 h-5 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : prs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[13px] text-gray-400 dark:text-gray-500">暂无待审核的 PR</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {prs.map((pr) => {
            const mergeKey = `merge-${pr.number}`;
            const closeKey = `close-${pr.number}`;
            const isMerging = actionLoading[mergeKey];
            const isClosing = actionLoading[closeKey];
            const isActionDisabled = isMerging || isClosing;

            return (
              <div
                key={pr.number}
                className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900"
              >
                {/* PR 头部 */}
                <div className="flex items-start gap-3 p-3.5">
                  {/* 头像 */}
                  {pr.userAvatar ? (
                    <img
                      src={pr.userAvatar}
                      alt={pr.user || 'avatar'}
                      className="w-8 h-8 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0 flex items-center justify-center text-[12px] text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={pr.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] font-medium text-gray-800 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate"
                      >
                        {pr.title}
                      </a>
                      <span className="text-[12px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                        #{pr.number}
                      </span>
                      {pr.draft && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex-shrink-0">
                          草稿
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400 dark:text-gray-500 flex-wrap">
                      <span className="font-mono">
                        {pr.headBranch} → {pr.baseBranch}
                      </span>
                      <span>·</span>
                      <span>{pr.user || '未知'}</span>
                      <span>·</span>
                      <span>{formatTimeAgo(pr.createdAt)}</span>
                    </div>
                    {pr.body && (
                      <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2">
                        {pr.body}
                      </p>
                    )}
                  </div>
                </div>

                {/* 操作区 */}
                <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  {pr.mergeable === false && (
                    <span className="text-[11px] text-red-500 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      存在冲突，无法自动合并
                    </span>
                  )}
                  <div className="flex-1" />
                  <a
                    href={pr.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] h-7 px-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors inline-flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    查看详情
                  </a>
                  <button
                    type="button"
                    onClick={() => handleClose(pr)}
                    disabled={isActionDisabled}
                    className="text-[12px] h-7 px-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    {isClosing ? (
                      <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    {isClosing ? '关闭中' : '拒绝'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMerge(pr, 'merge')}
                    disabled={isActionDisabled || pr.mergeable === false}
                    className="text-[12px] h-7 px-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium inline-flex items-center gap-1.5"
                  >
                    {isMerging ? (
                      <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {isMerging ? '合并中' : '审核通过并合并'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
