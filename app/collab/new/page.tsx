'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ============ 类型定义 ============
interface RepoInfo {
  owner: string;
  name: string;
  fullName: string;
  url: string;
  description?: string;
  defaultBranch?: string;
  language?: string;
  stars?: number;
  forks?: number;
  openIssues?: number;
}

interface FormErrors {
  title?: string;
  description?: string;
  repoUrl?: string;
  repoName?: string;
  maxMembers?: string;
}

type RepoSourceMode = 'existing' | 'create';

// ============ 辅助函数 ============
// 从 GitHub URL 中解析 owner 和 repo
function parseGithubRepo(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim();
  // 匹配 https://github.com/owner/repo 或 github.com/owner/repo
  const match = trimmed.match(/github\.com\/([^/\s]+)\/([^/\s?#]+)/);
  if (match) {
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  }
  // 支持 owner/repo 简写
  const simple = trimmed.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (simple) {
    return { owner: simple[1], repo: simple[2].replace(/\.git$/, '') };
  }
  return null;
}

export default function NewCollabPage() {
  const router = useRouter();
  const { user, token } = useAppStore();

  // 表单字段
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [repoSourceMode, setRepoSourceMode] = useState<RepoSourceMode>('existing');
  const [repoUrl, setRepoUrl] = useState('');
  const [techStack, setTechStack] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [goals, setGoals] = useState('');
  const [requirements, setRequirements] = useState('');
  const [maxMembers, setMaxMembers] = useState(10);

  // 方式B：创建新仓库
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);
  const [newRepoInitReadme, setNewRepoInitReadme] = useState(true);
  const [creatingRepo, setCreatingRepo] = useState(false);
  const [githubBound, setGithubBound] = useState<boolean | null>(null);

  // 仓库信息预览
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [repoInfoLoading, setRepoInfoLoading] = useState(false);

  // 提交状态
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // 未登录重定向
  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user, router]);

  // 获取仓库信息预览（防抖）
  const fetchRepoInfo = useCallback(async (url: string) => {
    const parsed = parseGithubRepo(url);
    if (!parsed) {
      setRepoInfo(null);
      return;
    }
    setRepoInfoLoading(true);
    try {
      const params = new URLSearchParams({
        owner: parsed.owner,
        repo: parsed.repo,
      });
      const res = await fetch(`/api/collab/github/repo-info?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRepoInfo(data);
      } else {
        setRepoInfo(null);
      }
    } catch {
      setRepoInfo(null);
    } finally {
      setRepoInfoLoading(false);
    }
  }, []);

  useEffect(() => {
    if (repoSourceMode !== 'existing' || !repoUrl.trim()) {
      setRepoInfo(null);
      return;
    }
    const timer = setTimeout(() => {
      fetchRepoInfo(repoUrl);
    }, 600);
    return () => clearTimeout(timer);
  }, [repoUrl, repoSourceMode, fetchRepoInfo]);

  // 切换方式时重置 GitHub 绑定状态
  useEffect(() => {
    if (repoSourceMode === 'create') {
      setGithubBound(null);
    }
  }, [repoSourceMode]);

  // 创建 GitHub 仓库（方式B）
  const handleCreateRepo = async () => {
    if (!token) {
      toast.error('请先登录');
      return;
    }
    if (!newRepoName.trim()) {
      toast.error('请输入仓库名称');
      return;
    }
    setCreatingRepo(true);
    try {
      const res = await fetch('/api/collab/github/create-repo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newRepoName.trim(),
          description: newRepoDesc.trim() || undefined,
          private: newRepoPrivate,
          autoInit: newRepoInitReadme,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 检测未绑定 GitHub
        const errMsg = data.error || data.message || '创建仓库失败';
        if (
          res.status === 401 ||
          res.status === 403 ||
          /绑定|未授权|github|授权|bind/i.test(errMsg)
        ) {
          setGithubBound(false);
        }
        throw new Error(errMsg);
      }
      setGithubBound(true);
      const repoUrl = data.html_url || data.url || data.repoUrl;
      setRepoUrl(repoUrl);
      toast.success('GitHub 仓库创建成功');
      // 自动拉取仓库信息
      fetchRepoInfo(repoUrl);
    } catch (err: any) {
      toast.error(err.message || '创建仓库失败');
    } finally {
      setCreatingRepo(false);
    }
  };

  // 表单校验
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!title.trim()) {
      newErrors.title = '请输入项目标题';
    } else if (title.trim().length < 2) {
      newErrors.title = '标题至少需要 2 个字符';
    } else if (title.trim().length > 100) {
      newErrors.title = '标题不能超过 100 个字符';
    }

    if (!description.trim()) {
      newErrors.description = '请输入项目描述';
    } else if (description.trim().length < 10) {
      newErrors.description = '描述至少需要 10 个字符';
    }

    if (repoSourceMode === 'existing' && !repoUrl.trim()) {
      newErrors.repoUrl = '请输入 GitHub 仓库 URL';
    }
    if (repoSourceMode === 'existing' && repoUrl.trim() && !parseGithubRepo(repoUrl)) {
      newErrors.repoUrl = '仓库 URL 格式不正确，例如 https://github.com/owner/repo';
    }

    if (repoSourceMode === 'create' && !repoUrl) {
      newErrors.repoName = '请先创建 GitHub 仓库';
    }

    if (maxMembers < 2 || maxMembers > 50) {
      newErrors.maxMembers = '成员数范围为 2-50';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交创建项目
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('请先登录');
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      const parsed = parseGithubRepo(repoUrl);
      const payload = {
        title: title.trim(),
        description: description.trim(),
        repoOwner: parsed?.owner,
        repoName: parsed?.repo,
        repoUrl: repoUrl.trim(),
        techStack,
        tags,
        goals: goals.trim() || undefined,
        requirements: requirements.trim() || undefined,
        maxMembers,
      };
      const res = await fetch('/api/collab/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '创建项目失败');
      }
      toast.success('召集令发布成功！');
      router.push(`/collab/${data.id}`);
    } catch (err: any) {
      toast.error(err.message || '创建项目失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <Container className="py-16 text-center">
        <p className="text-gray-500 dark:text-gray-400">正在跳转到登录页...</p>
      </Container>
    );
  }

  return (
    <Container className="py-8 max-w-3xl">
      {/* 顶部导航 */}
      <Link
        href="/collab"
        className="inline-block text-sm text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors mb-6"
      >
        &larr; 返回召集令列表
      </Link>

      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        <span className="mr-2">📣</span>
        发起召集令
      </h1>

      {/* 表单 */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        {/* 标题 */}
        <Field label="项目标题" required>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((p) => ({ ...p, title: undefined }));
            }}
            placeholder="给你的协作项目起个名字..."
            maxLength={100}
            className={inputClass(!!errors.title)}
          />
          {errors.title && <ErrorText>{errors.title}</ErrorText>}
          <CharCount current={title.length} max={100} />
        </Field>

        {/* 描述 */}
        <Field label="项目描述" required hint="支持 Markdown 语法，至少 10 个字符">
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description) setErrors((p) => ({ ...p, description: undefined }));
            }}
            placeholder="描述项目的背景、目标和主要内容...&#10;例如：这是一个基于 Next.js 的全栈协作项目，旨在..."
            rows={6}
            className={cn(inputClass(!!errors.description), 'font-mono resize-y')}
          />
          {errors.description && <ErrorText>{errors.description}</ErrorText>}
        </Field>

        {/* 仓库来源 */}
        <Field label="GitHub 仓库来源" required>
          {/* 方式切换 */}
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-lg p-1 mb-4">
            <button
              type="button"
              onClick={() => setRepoSourceMode('existing')}
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                repoSourceMode === 'existing'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              🔗 添加已有仓库
            </button>
            <button
              type="button"
              onClick={() => setRepoSourceMode('create')}
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                repoSourceMode === 'create'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              ✨ 创建新仓库
            </button>
          </div>

          {/* 方式A：添加已有仓库 */}
          {repoSourceMode === 'existing' && (
            <div>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  if (errors.repoUrl) setErrors((p) => ({ ...p, repoUrl: undefined }));
                }}
                placeholder="https://github.com/owner/repo"
                className={inputClass(!!errors.repoUrl)}
              />
              {errors.repoUrl && <ErrorText>{errors.repoUrl}</ErrorText>}
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                输入 GitHub 仓库地址，将自动获取仓库信息
              </p>

              {/* 仓库信息预览 */}
              <RepoPreview repoInfo={repoInfo} loading={repoInfoLoading} hasUrl={!!repoUrl.trim()} />
            </div>
          )}

          {/* 方式B：创建新仓库 */}
          {repoSourceMode === 'create' && (
            <div className="space-y-4">
              {/* 未绑定 GitHub 提示 */}
              {githubBound === false && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <span className="text-lg">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                      请先绑定 GitHub 账号
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                      创建仓库需要授权访问你的 GitHub 账号
                    </p>
                    <a
                      href="/api/auth/github"
                      className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                      绑定 GitHub 账号
                    </a>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  仓库名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newRepoName}
                  onChange={(e) => {
                    setNewRepoName(e.target.value);
                    if (errors.repoName) setErrors((p) => ({ ...p, repoName: undefined }));
                  }}
                  placeholder="my-awesome-project"
                  className={inputClass(!!errors.repoName)}
                />
                {errors.repoName && <ErrorText>{errors.repoName}</ErrorText>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  仓库描述（可选）
                </label>
                <input
                  type="text"
                  value={newRepoDesc}
                  onChange={(e) => setNewRepoDesc(e.target.value)}
                  placeholder="简短描述这个仓库..."
                  className={inputClass(false)}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRepoPrivate}
                    onChange={(e) => setNewRepoPrivate(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">私有仓库</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRepoInitReadme}
                    onChange={(e) => setNewRepoInitReadme(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">初始化 README</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleCreateRepo}
                disabled={creatingRepo || !newRepoName.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-800 dark:bg-gray-700 rounded-lg hover:bg-gray-900 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creatingRepo ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    创建中...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    创建仓库
                  </>
                )}
              </button>

              {/* 创建成功后的仓库信息预览 */}
              {repoUrl && (
                <div className="pt-2">
                  <p className="text-xs text-green-600 dark:text-green-400 mb-2">
                    ✓ 仓库已创建：{repoUrl}
                  </p>
                  <RepoPreview repoInfo={repoInfo} loading={repoInfoLoading} hasUrl={!!repoUrl} />
                </div>
              )}
            </div>
          )}
        </Field>

        {/* 技术栈标签 */}
        <Field label="技术栈" hint="可选，按回车添加，如 React、TypeScript、Node.js">
          <TagInput
            tags={techStack}
            onChange={setTechStack}
            placeholder="输入技术名称后按回车..."
            color="indigo"
          />
        </Field>

        {/* 项目标签 */}
        <Field label="项目标签" hint="可选，按回车添加，如 全栈、入门友好">
          <TagInput
            tags={tags}
            onChange={setTags}
            placeholder="输入标签后按回车..."
            color="blue"
          />
        </Field>

        {/* 项目目标 */}
        <Field label="项目目标" hint="可选，支持 Markdown 语法">
          <textarea
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="项目的阶段性目标、里程碑等..."
            rows={4}
            className={cn(inputClass(false), 'font-mono resize-y')}
          />
        </Field>

        {/* 参与要求 */}
        <Field label="参与要求" hint="可选">
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="对参与者的技能要求、时间投入等..."
            rows={3}
            className={cn(inputClass(false), 'resize-y')}
          />
        </Field>

        {/* 最大成员数 */}
        <Field label="最大成员数" required hint="范围 2-50，默认 10">
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={maxMembers}
              min={2}
              max={50}
              onChange={(e) => {
                setMaxMembers(Number(e.target.value));
                if (errors.maxMembers) setErrors((p) => ({ ...p, maxMembers: undefined }));
              }}
              className={cn(inputClass(!!errors.maxMembers), 'w-32')}
            />
            <input
              type="range"
              min={2}
              max={50}
              value={maxMembers}
              onChange={(e) => setMaxMembers(Number(e.target.value))}
              className="flex-1 accent-blue-600"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-8 text-center">
              {maxMembers}
            </span>
          </div>
          {errors.maxMembers && <ErrorText>{errors.maxMembers}</ErrorText>}
        </Field>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {submitting ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                发布中...
              </>
            ) : (
              '发布召集令'
            )}
          </button>
        </div>
      </form>
    </Container>
  );
}

// ============ 表单字段包装 ============
function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && !required && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      )}
    </div>
  );
}

// ============ 输入框样式 ============
function inputClass(hasError: boolean): string {
  return cn(
    'w-full px-4 py-2.5 text-sm border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-shadow',
    hasError
      ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
  );
}

// ============ 错误提示 ============
function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-red-500">{children}</p>;
}

// ============ 字数统计 ============
function CharCount({ current, max }: { current: number; max: number }) {
  return (
    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 text-right">
      {current}/{max}
    </p>
  );
}

// ============ 仓库信息预览 ============
function RepoPreview({
  repoInfo,
  loading,
  hasUrl,
}: {
  repoInfo: RepoInfo | null;
  loading: boolean;
  hasUrl: boolean;
}) {
  if (!hasUrl) return null;
  if (loading) {
    return (
      <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-2/3" />
      </div>
    );
  }
  if (!repoInfo) return null;
  return (
    <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <a
          href={repoInfo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          {repoInfo.fullName}
        </a>
        {repoInfo.language && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            {repoInfo.language}
          </span>
        )}
      </div>
      {repoInfo.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
          {repoInfo.description}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
        {repoInfo.defaultBranch && (
          <span className="inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {repoInfo.defaultBranch}
          </span>
        )}
        {typeof repoInfo.stars === 'number' && (
          <span className="inline-flex items-center gap-1">
            <span>⭐</span>
            {repoInfo.stars}
          </span>
        )}
        {typeof repoInfo.forks === 'number' && (
          <span className="inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 3a3 3 0 100 6 3 3 0 000-6zm12 0a3 3 0 100 6 3 3 0 000-6zM6 15a3 3 0 100 6 3 3 0 000-6zm9.5-4.5l-4 4 1.4 1.4 4-4-1.4-1.4z" />
            </svg>
            {repoInfo.forks}
          </span>
        )}
      </div>
    </div>
  );
}

// ============ 标签输入组件 ============
function TagInput({
  tags,
  onChange,
  placeholder,
  color = 'blue',
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  color?: 'blue' | 'indigo';
}) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const value = input.trim();
    if (!value) return;
    if (tags.includes(value)) {
      setInput('');
      return;
    }
    onChange([...tags, value]);
    setInput('');
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const colorClass =
    color === 'indigo'
      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
      : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2 py-2 min-h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-shadow">
      {tags.map((tag, index) => (
        <span
          key={index}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded',
            colorClass
          )}
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(index)}
            className="hover:text-red-500 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] px-2 py-1 text-sm bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
      />
    </div>
  );
}
