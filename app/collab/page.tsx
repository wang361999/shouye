'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import UserAvatar from '@/components/common/UserAvatar';
import { useAppStore } from '@/lib/store';
import { cn, formatTimeAgo, truncateText, stripMarkdown } from '@/lib/utils';
import toast from 'react-hot-toast';

// ============ 类型定义 ============
type ProjectStatus = 'recruiting' | 'active' | 'completed' | 'archived';

interface ProjectOwner {
  id: string;
  username: string;
  avatar?: string | null;
  githubUsername?: string;
}

interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  techStack: string[];
  tags: string[];
  maxMembers: number;
  memberCount: number;
  taskTotal: number;
  taskCompleted: number;
  contributionCount: number;
  owner: ProjectOwner;
  createdAt: string;
}

interface ProjectListResponse {
  data: Project[];
  total: number;
  page: number;
  pageSize: number;
}

// ============ 状态徽章配置 ============
const statusConfig: Record<
  ProjectStatus,
  { label: string; badge: string; dot: string }
> = {
  recruiting: {
    label: '招募中',
    badge:
      'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    dot: 'bg-green-500',
  },
  active: {
    label: '进行中',
    badge:
      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  completed: {
    label: '已完成',
    badge:
      'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
  archived: {
    label: '已归档',
    badge:
      'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    dot: 'bg-gray-400',
  },
};

// ============ 筛选项 ============
const statusFilters: { value: string; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'recruiting', label: '招募中' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
];

const PAGE_SIZE = 12;

export default function CollabListPage() {
  const { user } = useAppStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(true);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchKeyword(searchInput.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 获取项目列表
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
      });
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (searchKeyword) {
        params.set('keyword', searchKeyword);
      }
      const res = await fetch(`/api/collab/projects?${params}`);
      if (!res.ok) {
        throw new Error('获取项目列表失败');
      }
      const data: ProjectListResponse = await res.json();
      setProjects(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || PAGE_SIZE))));
    } catch (err: any) {
      toast.error(err.message || '获取项目列表失败');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, searchKeyword]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  return (
    <Container className="py-8">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-2">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
        >
          &larr; 返回首页
        </Link>
        {user ? (
          <Link
            href="/collab/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <span className="text-base leading-none">+</span> 发起召集令
          </Link>
        ) : (
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 dark:text-blue-400 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            登录后发起
          </Link>
        )}
      </div>

      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          <span className="mr-2">🤝</span>
          GitHub 协同创作召集令
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          发起开源协作项目，召集开发者一起共建 GitHub 仓库
        </p>
      </div>

      {/* 筛选区 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        {/* 状态筛选 */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 overflow-x-auto">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => handleStatusChange(f.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors',
                statusFilter === f.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 关键词搜索 */}
        <div className="relative flex-1 sm:max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索项目标题、技术栈..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 项目列表 */}
      {loading ? (
        <ProjectGridSkeleton />
      ) : projects.length === 0 ? (
        <EmptyState hasFilter={statusFilter !== 'all' || !!searchKeyword} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}

          {/* 统计 */}
          <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
            共 {total} 个项目
          </p>
        </>
      )}
    </Container>
  );
}

// ============ 项目卡片组件 ============
function ProjectCard({ project }: { project: Project }) {
  const status = statusConfig[project.status] ?? statusConfig.recruiting;
  const repoFullName = `${project.repoOwner}/${project.repoName}`;
  const taskProgress =
    project.taskTotal > 0
      ? Math.round((project.taskCompleted / project.taskTotal) * 100)
      : 0;

  return (
    <div className="group flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 transition-all duration-200 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700">
      {/* 标题 + 状态 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          href={`/collab/${project.id}`}
          className="text-base font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2"
        >
          {project.title}
        </Link>
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border whitespace-nowrap flex-shrink-0',
            status.badge
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
          {status.label}
        </span>
      </div>

      {/* 描述摘要 */}
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 mb-3">
        {truncateText(stripMarkdown(project.description), 100)}
      </p>

      {/* 仓库信息 */}
      {project.repoUrl ? (
        <a
          href={project.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-3"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span className="truncate">{repoFullName}</span>
        </a>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">暂无仓库</p>
      )}

      {/* 技术栈标签 */}
      {project.techStack && project.techStack.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {project.techStack.slice(0, 4).map((tech) => (
            <span
              key={tech}
              className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
            >
              {tech}
            </span>
          ))}
          {project.techStack.length > 4 && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs text-gray-400 dark:text-gray-500">
              +{project.techStack.length - 4}
            </span>
          )}
        </div>
      )}

      {/* 统计数据 */}
      <div className="grid grid-cols-3 gap-2 py-3 my-1 border-y border-gray-100 dark:border-gray-700">
        <Stat label="成员" value={`${project.memberCount}/${project.maxMembers}`} />
        <Stat
          label="任务"
          value={`${project.taskCompleted}/${project.taskTotal}`}
        />
        <Stat label="贡献" value={project.contributionCount} />
      </div>

      {/* 任务进度条 */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
          <span>任务进度</span>
          <span>{taskProgress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${taskProgress}%` }}
          />
        </div>
      </div>

      {/* 底部：发起人 + 查看详情 */}
      <div className="mt-auto flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 min-w-0">
          <UserAvatar
            username={project.owner.username}
            avatar={project.owner.avatar}
            size="sm"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
              {project.owner.username}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {formatTimeAgo(project.createdAt)}
            </p>
          </div>
        </div>
        <Link
          href={`/collab/${project.id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors whitespace-nowrap"
        >
          查看详情
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

// ============ 统计小项 ============
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
    </div>
  );
}

// ============ 骨架屏 ============
function ProjectGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-16" />
          </div>
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-full mb-2" />
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-2/3 mb-4" />
          <div className="flex gap-1.5 mb-4">
            <div className="h-5 bg-gray-100 dark:bg-gray-700 rounded w-14" />
            <div className="h-5 bg-gray-100 dark:bg-gray-700 rounded w-14" />
            <div className="h-5 bg-gray-100 dark:bg-gray-700 rounded w-14" />
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-16" />
            </div>
            <div className="h-7 bg-gray-100 dark:bg-gray-700 rounded-lg w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ 空状态 ============
function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-4xl mb-4">
        {hasFilter ? '🔍' : '🚀'}
      </div>
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
        {hasFilter ? '没有找到匹配的项目' : '还没有召集令'}
      </h3>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
        {hasFilter
          ? '试试调整筛选条件或换个关键词'
          : '成为第一个发起 GitHub 协作项目的人吧'}
      </p>
      {!hasFilter && (
        <Link
          href="/collab/new"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <span className="text-base leading-none">+</span> 发起召集令
        </Link>
      )}
    </div>
  );
}

// ============ 分页组件 ============
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages: number[] = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <nav className="flex items-center justify-center gap-1.5 mt-8">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="inline-flex items-center px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        上一页
      </button>
      {start > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            1
          </button>
          {start > 2 && <span className="px-1 text-gray-400">...</span>}
        </>
      )}
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={cn(
            'px-3 py-1.5 text-sm border rounded-lg transition-colors',
            p === currentPage
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          )}
        >
          {p}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-gray-400">...</span>}
          <button
            onClick={() => onPageChange(totalPages)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {totalPages}
          </button>
        </>
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="inline-flex items-center px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        下一页
      </button>
    </nav>
  );
}
