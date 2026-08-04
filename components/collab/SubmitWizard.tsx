'use client';

import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

// ============ Props ============
interface SubmitWizardProps {
  owner: string;
  repo: string;
  token: string | null;
  isMember: boolean;
  projectId: string;
  defaultBranch: string;
  branches: string[];
  currentBranch: string;
  onPRSuccess?: () => void;
  onClose: () => void;
}

// ============ 数据类型 ============
type TreeItemType = 'file' | 'dir' | 'symlink' | 'submodule';

interface TreeItem {
  path: string;
  type: TreeItemType;
  size?: number;
  sha?: string;
  url?: string;
}

interface CreatedPR {
  number: number;
  title: string;
  url: string;
  state: string;
}

type WizardStep = 'directory' | 'filename' | 'code' | 'review' | 'success';

// ============ 工具函数 ============
function authHeaders(
  token: string | null,
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function basename(path: string): string {
  return path.split('/').pop() || path;
}

// 步骤配置
const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'directory', label: '选择目录' },
  { key: 'filename', label: '创建文件' },
  { key: 'code', label: '编写代码' },
  { key: 'review', label: '提交审核' },
];

// 步骤图标（SVG）
function StepIcon({ stepKey, className }: { stepKey: WizardStep; className?: string }) {
  const common = { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' } as const;
  switch (stepKey) {
    case 'directory':
      return (
        <svg className={className} {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    case 'filename':
      return (
        <svg className={className} {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'code':
      return (
        <svg className={className} {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case 'review':
      return (
        <svg className={className} {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      );
    default:
      return null;
  }
}

// ============ 主组件 ============
export default function SubmitWizard({
  owner,
  repo,
  token,
  isMember,
  projectId,
  defaultBranch,
  branches,
  currentBranch,
  onPRSuccess,
  onClose,
}: SubmitWizardProps) {
  const [step, setStep] = useState<WizardStep>('directory');
  const [submitting, setSubmitting] = useState(false);

  // 目录浏览
  const [dirCache, setDirCache] = useState<Record<string, TreeItem[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  const [selectedDir, setSelectedDir] = useState<string>('');

  // 文件信息
  const [filePath, setFilePath] = useState('');
  const [fileContent, setFileContent] = useState('');

  // 提交信息
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [commitMsg, setCommitMsg] = useState('');

  // 成功结果
  const [createdPR, setCreatedPR] = useState<CreatedPR | null>(null);

  // ============ 获取目录内容 ============
  const fetchDir = useCallback(
    async (path: string) => {
      setLoadingDirs((prev) => new Set(prev).add(path));
      try {
        const params = new URLSearchParams({ owner, repo, path });
        if (currentBranch) params.set('ref', currentBranch);
        const res = await fetch(
          `/api/collab/github/contents?${params.toString()}`,
          { headers: authHeaders(token) },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || '获取目录失败');
        const items: TreeItem[] = Array.isArray(json?.data) ? json.data : [];
        items.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
          return a.path.localeCompare(b.path);
        });
        setDirCache((prev) => ({ ...prev, [path]: items }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '获取目录失败');
      } finally {
        setLoadingDirs((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
    },
    [owner, repo, token, currentBranch],
  );

  // 初始加载根目录
  useEffect(() => {
    fetchDir('');
  }, [fetchDir]);

  const toggleDir = useCallback(
    (path: string) => {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
      if (!dirCache[path] && !loadingDirs.has(path)) {
        fetchDir(path);
      }
    },
    [dirCache, loadingDirs, fetchDir],
  );

  // ============ 自动提交贡献记录 ============
  const autoSubmitContribution = useCallback(
    async (data: {
      type: 'commit' | 'pull_request';
      title: string;
      description?: string;
      url?: string;
      commitSha?: string;
      branch?: string;
    }) => {
      try {
        const res = await fetch(`/api/collab/projects/${projectId}/contributions`, {
          method: 'POST',
          headers: authHeaders(token, { 'Content-Type': 'application/json' }),
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          console.warn('[AUTO CONTRIBUTION] 提交失败:', errJson?.error || res.status);
        }
      } catch {
        // 静默处理
      }
    },
    [projectId, token],
  );

  // ============ 提交审核（核心流程） ============
  const handleSubmit = useCallback(async () => {
    if (!isMember) {
      toast.error('仅项目成员可提交代码');
      return;
    }
    if (!filePath.trim()) {
      toast.error('请输入文件路径');
      return;
    }
    if (!commitMsg.trim()) {
      toast.error('请输入 commit message');
      return;
    }
    if (!prTitle.trim()) {
      toast.error('请输入 PR 标题');
      return;
    }

    setSubmitting(true);

    // 生成分支名：contrib/{时间戳}
    const timestamp = Date.now();
    const branchName = `contrib/${timestamp}`;
    // 拼接完整路径
    const fullPath = selectedDir
      ? `${selectedDir.replace(/\/$/, '')}/${filePath.trim()}`
      : filePath.trim();

    try {
      // Step 1: 创建新分支（基于当前分支或默认分支）
      toast.loading('正在创建分支…', { id: 'submit-progress' });
      const branchRes = await fetch('/api/collab/github/branches', {
        method: 'POST',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          owner,
          repo,
          branchName,
          fromBranch: currentBranch || defaultBranch || undefined,
        }),
      });
      const branchJson = await branchRes.json().catch(() => null);
      if (!branchRes.ok) {
        throw new Error(branchJson?.error || '创建分支失败');
      }

      // Step 2: 在新分支上创建文件
      toast.loading('正在创建文件…', { id: 'submit-progress' });
      const fileRes = await fetch('/api/collab/github/edit-file', {
        method: 'PUT',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          owner,
          repo,
          path: fullPath,
          content: fileContent,
          message: commitMsg,
          branch: branchName,
        }),
      });
      const fileJson = await fileRes.json().catch(() => null);
      if (!fileRes.ok) {
        throw new Error(fileJson?.error || '创建文件失败');
      }

      // Step 3: 发起 PR（从新分支到默认分支）
      toast.loading('正在发起 PR 审核请求…', { id: 'submit-progress' });
      const prRes = await fetch('/api/collab/github/pull-request', {
        method: 'POST',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          owner,
          repo,
          title: prTitle,
          body: prBody || `新增文件：${fullPath}\n\n提交者通过在线编辑器创建`,
          head: branchName,
          base: defaultBranch || undefined,
        }),
      });
      const prJson = await prRes.json().catch(() => null);
      if (!prRes.ok) {
        throw new Error(prJson?.error || '创建 PR 失败');
      }

      // Step 4: 自动提交贡献记录
      await autoSubmitContribution({
        type: 'pull_request',
        title: prTitle,
        description: prBody || `新增文件：${fullPath}`,
        url: prJson.url,
        branch: branchName,
        commitSha: fileJson.commitSha,
      });

      toast.success('提交成功！等待发起人审核', { id: 'submit-progress' });
      setCreatedPR({
        number: prJson.number,
        title: prJson.title,
        url: prJson.url,
        state: prJson.state,
      });
      setStep('success');
      onPRSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '提交失败', { id: 'submit-progress' });
    } finally {
      setSubmitting(false);
    }
  }, [
    isMember,
    filePath,
    commitMsg,
    prTitle,
    prBody,
    selectedDir,
    owner,
    repo,
    token,
    currentBranch,
    defaultBranch,
    fileContent,
    autoSubmitContribution,
    onPRSuccess,
  ]);

  // ============ 步骤导航 ============
  const currentStepIndex = STEPS.findIndex((s) => s.key === step);
  const canGoNext = () => {
    switch (step) {
      case 'directory':
        return true; // 目录可选（根目录也行）
      case 'filename':
        return filePath.trim().length > 0;
      case 'code':
        return true; // 允许空文件
      case 'review':
        return prTitle.trim().length > 0 && commitMsg.trim().length > 0;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (!canGoNext()) return;
    if (step === 'directory') setStep('filename');
    else if (step === 'filename') {
      // 自动填充默认 PR 标题和 commit message
      const name = basename(filePath.trim());
      if (!prTitle) setPrTitle(`新增 ${name}`);
      if (!commitMsg) setCommitMsg(`feat: 新增 ${filePath.trim()}`);
      setStep('code');
    } else if (step === 'code') setStep('review');
  };

  const goPrev = () => {
    if (step === 'filename') setStep('directory');
    else if (step === 'code') setStep('filename');
    else if (step === 'review') setStep('code');
  };

  // ============ 目录树节点（内联渲染，简化版） ============
  const renderDirNode = (item: TreeItem, depth: number) => {
    if (item.type !== 'dir') return null;
    const isExpanded = expandedPaths.has(item.path);
    const isSelected = selectedDir === item.path;
    const isLoading = loadingDirs.has(item.path);
    const padLeft = depth * 16 + 12;

    return (
      <div key={item.path}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => toggleDir(item.path)}
            className="flex items-center gap-1.5 flex-1 text-left py-[5px] px-2 rounded-lg text-[13px] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
            style={{ paddingLeft: `${padLeft}px` }}
          >
            <span className="text-[13px] leading-none">{isExpanded ? '📂' : '📁'}</span>
            <span className="truncate text-gray-700 dark:text-gray-300">
              {basename(item.path)}
            </span>
            {isLoading && (
              <span className="ml-auto flex-shrink-0 w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedDir(item.path);
              toast.success(`已选择目录：${item.path}`);
            }}
            className={cn(
              'text-[11px] px-2 py-0.5 rounded-lg transition-colors flex-shrink-0',
              isSelected
                ? 'bg-indigo-600 text-white'
                : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
            )}
          >
            {isSelected ? '✓ 已选' : '选择'}
          </button>
        </div>
        {isExpanded &&
          dirCache[item.path]?.map((child) => renderDirNode(child, depth + 1))}
      </div>
    );
  };

  const rootDirs = (dirCache[''] || []).filter((i) => i.type === 'dir');

  // ============ 渲染 ============
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-3xl h-[90vh] sm:h-[85vh] rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            提交代码贡献
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 transition-colors disabled:opacity-40"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 'success' && createdPR ? (
          /* ===== 成功页面 ===== */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100 mb-2">
              提交成功！
            </h2>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-1">
              PR #{createdPR.number} 已创建，等待发起人审核
            </p>
            <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-6">
              {createdPR.title}
            </p>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 max-w-md text-left text-[12px] text-indigo-700 dark:text-indigo-300 leading-relaxed mb-6">
              <p className="font-medium mb-1">审核流程：</p>
              <p>1. 发起人将在项目详情页看到此 PR</p>
              <p>2. 审核通过后，代码将直接合并到 {defaultBranch} 分支</p>
              <p>3. 合并后您的贡献将自动记录</p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={createdPR.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                在 GitHub 查看 PR ↗
              </a>
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-lg text-[13px] font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                完成
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 步骤指示器 */}
            <div className="flex items-center px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-medium transition-colors',
                        i < currentStepIndex
                          ? 'bg-emerald-500 text-white'
                          : i === currentStepIndex
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
                      )}
                    >
                      {i < currentStepIndex ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-[11px] whitespace-nowrap flex items-center gap-1',
                        i === currentStepIndex
                          ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                          : 'text-gray-400 dark:text-gray-500',
                      )}
                    >
                      <StepIcon stepKey={s.key} className="w-3 h-3" />
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2 mb-5 rounded transition-colors',
                        i < currentStepIndex
                          ? 'bg-emerald-500'
                          : 'bg-gray-200 dark:bg-gray-700',
                      )}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* ===== Step 1: 选择目录 ===== */}
              {step === 'directory' && (
                <div className="space-y-3">
                  <div className="text-[13px] text-gray-600 dark:text-gray-400">
                    选择要在哪个目录下创建文件，也可以直接使用根目录。
                  </div>
                  {/* 当前选择 */}
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                    <span className="text-[12px] text-indigo-600 dark:text-indigo-400 font-medium">
                      当前选择：
                    </span>
                    <span className="text-[13px] font-mono text-indigo-700 dark:text-indigo-300">
                      {selectedDir || '（根目录）'}
                    </span>
                    {selectedDir && (
                      <button
                        type="button"
                        onClick={() => setSelectedDir('')}
                        className="ml-auto text-[12px] text-red-500 hover:text-red-600"
                      >
                        重置为根目录
                      </button>
                    )}
                  </div>
                  {/* 根目录选择按钮 */}
                  <button
                    type="button"
                    onClick={() => setSelectedDir('')}
                    className={cn(
                      'w-full flex items-center gap-2 py-2 px-3 rounded-lg text-[13px] transition-colors',
                      selectedDir === ''
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent',
                    )}
                  >
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span className="text-gray-700 dark:text-gray-300">根目录</span>
                    {selectedDir === '' && (
                      <span className="ml-auto text-[11px] text-indigo-600 dark:text-indigo-400">✓ 已选</span>
                    )}
                  </button>
                  {/* 目录树 */}
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 max-h-[400px] overflow-y-auto p-2 bg-gray-50/50 dark:bg-gray-800/30">
                    {loadingDirs.has('') && !dirCache[''] ? (
                      <div className="py-4 space-y-2 animate-pulse">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                      </div>
                    ) : rootDirs.length > 0 ? (
                      rootDirs.map((item) => renderDirNode(item, 0))
                    ) : (
                      <div className="text-[13px] text-gray-400 dark:text-gray-500 py-4 text-center">
                        仓库中没有子目录
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===== Step 2: 创建文件 ===== */}
              {step === 'filename' && (
                <div className="space-y-4">
                  <div className="text-[13px] text-gray-600 dark:text-gray-400">
                    输入要创建的文件路径，支持嵌套目录。
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      所在目录
                    </label>
                    <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-[13px] font-mono text-gray-500 dark:text-gray-400">
                      📁 {selectedDir || '（根目录）'}/
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      文件路径 <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={filePath}
                      onChange={(e) => setFilePath(e.target.value)}
                      placeholder="例如：src/components/Button.tsx 或 README.md"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canGoNext()) goNext();
                      }}
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 text-[16px] sm:text-sm font-mono text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                    />
                    <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">
                      输入 a/b/c.ts 可自动创建嵌套目录
                    </p>
                  </div>
                  {/* 完整路径预览 */}
                  {filePath.trim() && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                      <span className="text-[12px] text-emerald-600 dark:text-emerald-400 font-medium">
                        完整路径：
                      </span>
                      <span className="text-[13px] font-mono text-emerald-700 dark:text-emerald-300 break-all">
                        {selectedDir ? `${selectedDir.replace(/\/$/, '')}/` : ''}{filePath.trim()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ===== Step 3: 编写代码 ===== */}
              {step === 'code' && (
                <div className="space-y-3 h-full flex flex-col">
                  <div className="text-[13px] text-gray-600 dark:text-gray-400">
                    编写文件内容，留空则创建空文件。
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-gray-400 dark:text-gray-500">
                    <span>📄</span>
                    <span className="font-mono">
                      {selectedDir ? `${selectedDir.replace(/\/$/, '')}/` : ''}{filePath.trim()}
                    </span>
                  </div>
                  <textarea
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    placeholder="// 输入文件内容..."
                    className="flex-1 min-h-[300px] w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 text-[16px] sm:text-sm font-mono text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-y"
                    spellCheck={false}
                  />
                </div>
              )}

              {/* ===== Step 4: 提交审核 ===== */}
              {step === 'review' && (
                <div className="space-y-4">
                  <div className="text-[13px] text-gray-600 dark:text-gray-400">
                    确认提交信息，提交后发起人将收到审核请求。
                  </div>
                  {/* 提交摘要 */}
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-[12px] font-medium text-gray-500 dark:text-gray-400">
                      提交摘要
                    </div>
                    <div className="p-3 space-y-2 text-[13px]">
                      <div className="flex gap-2">
                        <span className="text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">目录：</span>
                        <span className="font-mono text-gray-700 dark:text-gray-300">
                          {selectedDir || '（根目录）'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">文件：</span>
                        <span className="font-mono text-gray-700 dark:text-gray-300 break-all">
                          {filePath.trim()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">完整路径：</span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 break-all">
                          {selectedDir ? `${selectedDir.replace(/\/$/, '')}/` : ''}{filePath.trim()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">文件大小：</span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {new Blob([fileContent]).size} bytes
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">目标分支：</span>
                        <span className="font-mono text-gray-700 dark:text-gray-300">
                          {defaultBranch || 'main'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Commit message */}
                  <div>
                    <label className="block text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      Commit message <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={commitMsg}
                      onChange={(e) => setCommitMsg(e.target.value)}
                      placeholder="例如：feat: 新增用户登录组件"
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 text-[16px] sm:text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                    />
                  </div>

                  {/* PR 标题 */}
                  <div>
                    <label className="block text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      PR 标题 <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={prTitle}
                      onChange={(e) => setPrTitle(e.target.value)}
                      placeholder="例如：新增用户登录页"
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 text-[16px] sm:text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                    />
                  </div>

                  {/* PR 描述 */}
                  <div>
                    <label className="block text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      PR 描述（可选）
                    </label>
                    <textarea
                      value={prBody}
                      onChange={(e) => setPrBody(e.target.value)}
                      placeholder="描述本次变更的内容与目的…"
                      rows={3}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 text-[16px] sm:text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-y"
                    />
                  </div>

                  {/* 流程说明 */}
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-[12px] text-amber-700 dark:text-amber-400">
                    <svg className="w-4 h-4 flex-shrink-0 mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      提交后将自动创建分支并发起 PR，发起人审核通过后代码将合并到{' '}
                      <span className="font-mono font-medium">{defaultBranch || 'main'}</span> 分支。
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 底部操作栏 */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 flex-shrink-0">
              <div className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {step === 'directory' && '提示：不选目录则默认在根目录创建'}
                {step === 'filename' && '提示：支持 a/b/c.ts 嵌套路径'}
                {step === 'code' && '提示：可留空创建空文件'}
                {step === 'review' && '提示：提交后可在 GitHub 查看审核状态'}
              </div>
              <div className="flex items-center gap-2">
                {step !== 'directory' && (
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={submitting}
                    className="h-9 px-4 rounded-lg text-[13px] font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    上一步
                  </button>
                )}
                {step !== 'review' ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canGoNext()}
                    className="h-9 px-4 rounded-lg text-[13px] font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    下一步
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || !canGoNext()}
                    className="h-9 px-6 rounded-lg text-[13px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {submitting ? (
                      <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                    {submitting ? '提交中' : '提交审核'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
