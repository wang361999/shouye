'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import UserAvatar from '@/components/common/UserAvatar';
import MarkdownRenderer from '@/components/forum/MarkdownRenderer';
import { useAppStore } from '@/lib/store';
import { cn, formatTimeAgo, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

// ============ 类型定义 ============
type ProjectStatus = 'recruiting' | 'active' | 'completed' | 'archived';
type MemberRole = 'owner' | 'maintainer' | 'member';
type TaskStatus = 'open' | 'in_progress' | 'review' | 'completed';
type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
type ContributionType = 'commit' | 'PR' | 'issue' | 'docs';
type ContributionStatus = 'pending' | 'approved' | 'rejected';
type TabKey = 'overview' | 'tasks' | 'members' | 'contributions' | 'github';

interface UserRef {
  id: string;
  username: string;
  avatar?: string | null;
  githubUsername?: string;
}

interface Member {
  id: string;
  userId: string;
  username: string;
  avatar?: string | null;
  role: MemberRole;
  githubUsername?: string;
  joinedAt: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: UserRef | null;
  dueDate?: string | null;
  createdAt: string;
}

interface Contribution {
  id: string;
  type: ContributionType;
  title: string;
  description?: string;
  url?: string;
  commitSha?: string;
  branch?: string;
  additions?: number;
  deletions?: number;
  status: ContributionStatus;
  contributor: UserRef;
  task?: { id: string; title: string } | null;
  createdAt: string;
}

interface CommitActivity {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

interface ContributorStat {
  username: string;
  commits: number;
  additions: number;
  deletions: number;
}

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
  commits?: CommitActivity[];
  contributors?: ContributorStat[];
}

interface ProjectDetail {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  techStack: string[];
  tags: string[];
  goals?: string;
  requirements?: string;
  maxMembers: number;
  memberCount: number;
  taskTotal: number;
  taskCompleted: number;
  contributionCount: number;
  owner: UserRef;
  members: Member[];
  createdAt: string;
  myRole?: MemberRole | null;
  isMember?: boolean;
}

// ============ 配置映射 ============
const statusConfig: Record<ProjectStatus, { label: string; badge: string; dot: string }> = {
  recruiting: {
    label: '招募中',
    badge: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    dot: 'bg-green-500',
  },
  active: {
    label: '进行中',
    badge: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  completed: {
    label: '已完成',
    badge: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
  archived: {
    label: '已归档',
    badge: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    dot: 'bg-gray-400',
  },
};

const taskStatusConfig: Record<TaskStatus, { label: string; badge: string }> = {
  open: {
    label: '待认领',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  },
  in_progress: {
    label: '进行中',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  review: {
    label: '待审核',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  completed: {
    label: '已完成',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
};

const priorityConfig: Record<TaskPriority, { label: string; badge: string }> = {
  urgent: { label: '紧急', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  high: { label: '高', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  medium: { label: '中', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  low: { label: '低', badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
};

const contributionTypeConfig: Record<ContributionType, { icon: string; label: string; color: string }> = {
  commit: { icon: '💾', label: 'Commit', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  PR: { icon: '🔀', label: 'PR', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  issue: { icon: '🐛', label: 'Issue', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  docs: { icon: '📄', label: 'Docs', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
};

const contributionStatusConfig: Record<ContributionStatus, { label: string; badge: string }> = {
  pending: { label: '待审核', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  approved: { label: '已通过', badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: '已拒绝', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const roleConfig: Record<MemberRole, { label: string; badge: string }> = {
  owner: { label: '发起人', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  maintainer: { label: '维护者', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  member: { label: '成员', badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
};

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: '概览', icon: '📋' },
  { key: 'tasks', label: '任务清单', icon: '✅' },
  { key: 'members', label: '团队成员', icon: '👥' },
  { key: 'contributions', label: '提交贡献', icon: '🎁' },
  { key: 'github', label: 'GitHub动态', icon: '🐙' },
];

export default function CollabDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { token, user } = useAppStore();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [joining, setJoining] = useState(false);

  // 各 Tab 数据
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [contributionsLoading, setContributionsLoading] = useState(false);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [githubLoading, setGithubLoading] = useState(false);

  // 已加载标记（避免重复请求）
  const [loadedTabs, setLoadedTabs] = useState<Set<TabKey>>(new Set());

  // 获取项目详情
  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/collab/projects/${id}`, { headers });
      if (!res.ok) throw new Error('项目不存在');
      const data = await res.json();
      setProject(data);
    } catch (err: any) {
      toast.error(err.message || '获取项目失败');
      router.replace('/collab');
    } finally {
      setLoading(false);
    }
  }, [id, router, token]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // 获取任务列表
  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/collab/projects/${id}/tasks`, { headers });
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      // 静默处理
    } finally {
      setTasksLoading(false);
    }
  }, [id, token]);

  // 获取贡献列表
  const fetchContributions = useCallback(async () => {
    setContributionsLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/collab/projects/${id}/contributions`, { headers });
      if (res.ok) {
        const data = await res.json();
        setContributions(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      // 静默处理
    } finally {
      setContributionsLoading(false);
    }
  }, [id, token]);

  // 获取 GitHub 动态
  const fetchGithubActivity = useCallback(async () => {
    if (!project?.repoOwner || !project?.repoName) return;
    setGithubLoading(true);
    try {
      const params = new URLSearchParams({
        owner: project.repoOwner,
        repo: project.repoName,
      });
      const res = await fetch(`/api/collab/github/repo-info?${params}`);
      if (res.ok) {
        const data = await res.json();
        // API 返回 { data: repoInfo }，兼容直接返回对象的情况
        setRepoInfo(data.data || data);
      }
    } catch {
      // 静默处理
    } finally {
      setGithubLoading(false);
    }
  }, [project?.repoOwner, project?.repoName]);

  // Tab 切换时懒加载数据
  useEffect(() => {
    if (!project) return;
    if (activeTab === 'tasks' && !loadedTabs.has('tasks')) {
      fetchTasks();
      setLoadedTabs((prev) => new Set(prev).add('tasks'));
    }
    if (activeTab === 'contributions' && !loadedTabs.has('contributions')) {
      fetchContributions();
      setLoadedTabs((prev) => new Set(prev).add('contributions'));
    }
    if (activeTab === 'github' && !loadedTabs.has('github')) {
      fetchGithubActivity();
      setLoadedTabs((prev) => new Set(prev).add('github'));
    }
  }, [activeTab, project, loadedTabs, fetchTasks, fetchContributions, fetchGithubActivity]);

  // 加入/离开项目
  const handleJoin = async () => {
    if (!token) {
      toast.error('请先登录');
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/collab/projects/${id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加入失败');
      toast.success('已加入项目');
      fetchProject();
      setLoadedTabs((prev) => {
        const next = new Set(prev);
        next.delete('tasks');
        next.delete('contributions');
        return next;
      });
    } catch (err: any) {
      toast.error(err.message || '加入失败');
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!token) return;
    if (!confirm('确定要离开这个项目吗？')) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/collab/projects/${id}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '离开失败');
      toast.success('已离开项目');
      fetchProject();
    } catch (err: any) {
      toast.error(err.message || '离开失败');
    } finally {
      setJoining(false);
    }
  };

  // 刷新单个 Tab
  const refreshTab = (tab: TabKey) => {
    if (tab === 'tasks') fetchTasks();
    if (tab === 'contributions') fetchContributions();
  };

  // ============ 权限计算 ============
  const isOwner = !!user && !!project && !!project.owner && project.owner.id === user.id;
  const myRole = project?.myRole ?? null;
  const isMember = project?.isMember ?? myRole !== null;
  const canManage = isOwner || myRole === 'maintainer';

  // ============ 加载态 ============
  if (loading) {
    return (
      <Container className="py-8 max-w-5xl">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-32 bg-gray-100 dark:bg-gray-700 rounded-xl" />
          <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded w-full" />
          <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-xl" />
        </div>
      </Container>
    );
  }

  if (!project) {
    return (
      <Container className="py-16 text-center">
        <p className="text-gray-500 dark:text-gray-400">项目不存在</p>
      </Container>
    );
  }

  const status = statusConfig[project.status] ?? statusConfig.recruiting;
  const taskProgress =
    project.taskTotal > 0
      ? Math.round((project.taskCompleted / project.taskTotal) * 100)
      : 0;

  return (
    <Container className="py-8 max-w-5xl">
      {/* 返回链接 */}
      <Link
        href="/collab"
        className="inline-block text-sm text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors mb-4"
      >
        &larr; 返回召集令列表
      </Link>

      {/* ============ 顶部信息区 ============ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        {/* 标题 + 状态 */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {project.title}
          </h1>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border whitespace-nowrap flex-shrink-0',
              status.badge
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
            {status.label}
          </span>
        </div>

        {/* 描述 */}
        <div className="mb-5">
          <MarkdownRenderer content={project.description} />
        </div>

        {/* 仓库信息卡片 */}
        {project.repoUrl && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700 mb-4">
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              {project.repoOwner}/{project.repoName}
            </a>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 sm:ml-auto">
              {repoInfo?.language && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  {repoInfo.language}
                </span>
              )}
              {typeof repoInfo?.stars === 'number' && (
                <span className="inline-flex items-center gap-1">⭐ {repoInfo.stars}</span>
              )}
              {typeof repoInfo?.forks === 'number' && (
                <span className="inline-flex items-center gap-1">🍴 {repoInfo.forks}</span>
              )}
              {repoInfo?.defaultBranch && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {repoInfo.defaultBranch}
                </span>
              )}
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-500 hover:underline"
              >
                在 GitHub 查看
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          </div>
        )}

        {/* 技术栈 + 标签 */}
        {(project.techStack?.length > 0 || project.tags?.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {project.techStack?.map((tech) => (
              <span
                key={tech}
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
              >
                {tech}
              </span>
            ))}
            {project.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* 发起人 + 操作按钮 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2.5">
            <UserAvatar username={project.owner?.username || '未知用户'} avatar={project.owner?.avatar} size="md" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {project.owner?.username || '未知用户'}
                {project.owner?.githubUsername && (
                  <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                    @{project.owner.githubUsername}
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                发起于 {formatDate(project.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwner ? (
              <Link
                href={`/collab/${project.id}?edit=1`}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                ✏️ 编辑项目
              </Link>
            ) : isMember ? (
              <button
                onClick={handleLeave}
                disabled={joining}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
              >
                {joining ? '处理中...' : '离开项目'}
              </button>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining || project.status === 'archived'}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {joining ? '处理中...' : '+ 加入项目'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============ Tab 切换 ============ */}
      <div className="flex items-center gap-1 mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 min-w-fit px-3 sm:px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200',
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============ Tab 内容 ============ */}
      <div className="animate-fade-in" key={activeTab}>
        {activeTab === 'overview' && <OverviewTab project={project} taskProgress={taskProgress} />}
        {activeTab === 'tasks' && (
          <TasksTab
            projectId={id}
            tasks={tasks}
            loading={tasksLoading}
            canManage={canManage}
            isMember={isMember}
            currentUserId={user?.id}
            token={token}
            onRefresh={() => refreshTab('tasks')}
            onProjectRefresh={fetchProject}
          />
        )}
        {activeTab === 'members' && (
          <MembersTab project={project} />
        )}
        {activeTab === 'contributions' && (
          <ContributionsTab
            projectId={id}
            contributions={contributions}
            loading={contributionsLoading}
            canManage={canManage}
            isMember={isMember}
            tasks={tasks}
            token={token}
            onRefresh={() => refreshTab('contributions')}
          />
        )}
        {activeTab === 'github' && (
          <GithubTab repoInfo={repoInfo} loading={githubLoading} project={project} />
        )}
      </div>
    </Container>
  );
}

// ============ Tab 1: 概览 ============
function OverviewTab({
  project,
  taskProgress,
}: {
  project: ProjectDetail;
  taskProgress: number;
}) {
  const norms = [
    {
      icon: '🛡️',
      title: '分支保护',
      desc: '主分支受保护，所有变更通过 Pull Request 提交，禁止直接推送。',
    },
    {
      icon: '✅',
      title: '代码规范',
      desc: '代码需通过 CI 自动化检查（Lint、测试）后方可合并。',
    },
    {
      icon: '📌',
      title: '任务认领',
      desc: '先在「任务清单」认领任务再开始开发，避免重复工作。',
    },
    {
      icon: '🔍',
      title: '审核流程',
      desc: '由管理员审核 PR，通过后合并到主分支并记录贡献。',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 项目目标 */}
      {project.goals ? (
        <SectionCard title="🎯 项目目标">
          <MarkdownRenderer content={project.goals} />
        </SectionCard>
      ) : (
        <SectionCard title="🎯 项目目标">
          <p className="text-sm text-gray-400 dark:text-gray-500">暂未设置项目目标</p>
        </SectionCard>
      )}

      {/* 参与要求 */}
      <SectionCard title="📋 参与要求">
        {project.requirements ? (
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {project.requirements}
          </p>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">暂未设置参与要求，欢迎所有开发者加入</p>
        )}
      </SectionCard>

      {/* 统计概览 */}
      <SectionCard title="📊 统计概览">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="团队成员" value={`${project.memberCount}/${project.maxMembers}`} icon="👥" />
          <StatCard
            label="任务完成率"
            value={`${taskProgress}%`}
            icon="✅"
            sub={`${project.taskCompleted}/${project.taskTotal}`}
          />
          <StatCard label="贡献总数" value={project.contributionCount} icon="🎁" />
        </div>
      </SectionCard>

      {/* 协作规范 */}
      <SectionCard title="📐 协作规范">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {norms.map((norm) => (
            <div
              key={norm.title}
              className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700"
            >
              <span className="text-xl flex-shrink-0">{norm.icon}</span>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{norm.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                  {norm.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ============ Tab 2: 任务清单 ============
function TasksTab({
  projectId,
  tasks,
  loading,
  canManage,
  isMember,
  currentUserId,
  token,
  onRefresh,
  onProjectRefresh,
}: {
  projectId: string;
  tasks: Task[];
  loading: boolean;
  canManage: boolean;
  isMember: boolean;
  currentUserId?: string;
  token: string | null;
  onRefresh: () => void;
  onProjectRefresh: () => void;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleClaim = async (taskId: string) => {
    if (!token) {
      toast.error('请先登录');
      return;
    }
    setUpdatingId(taskId);
    try {
      const res = await fetch(`/api/collab/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'in_progress' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '认领失败');
      toast.success('已认领任务');
      onRefresh();
      onProjectRefresh();
    } catch (err: any) {
      toast.error(err.message || '认领失败');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    if (!token) return;
    setUpdatingId(taskId);
    try {
      const res = await fetch(`/api/collab/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '更新失败');
      toast.success('任务状态已更新');
      onRefresh();
      onProjectRefresh();
    } catch (err: any) {
      toast.error(err.message || '更新失败');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 头部操作 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          任务清单 <span className="text-sm font-normal text-gray-400">({tasks.length})</span>
        </h3>
        {canManage && (
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showCreateForm ? '取消' : '+ 新建任务'}
          </button>
        )}
      </div>

      {/* 新建任务表单 */}
      {showCreateForm && canManage && (
        <TaskCreateForm
          projectId={projectId}
          token={token}
          onSuccess={() => {
            setShowCreateForm(false);
            onRefresh();
            onProjectRefresh();
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* 任务列表 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3" />
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyBox icon="📝" text="暂无任务" subText={canManage ? '点击「新建任务」创建第一个任务' : '任务将由项目管理者创建'} />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              canManage={canManage}
              isMember={isMember}
              currentUserId={currentUserId}
              updating={updatingId === task.id}
              onClaim={() => handleClaim(task.id)}
              onStatusChange={(status) => handleStatusChange(task.id, status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============ 任务项 ============
function TaskItem({
  task,
  canManage,
  isMember,
  currentUserId,
  updating,
  onClaim,
  onStatusChange,
}: {
  task: Task;
  canManage: boolean;
  isMember: boolean;
  currentUserId?: string;
  updating: boolean;
  onClaim: () => void;
  onStatusChange: (status: TaskStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = taskStatusConfig[task.status];
  const priority = priorityConfig[task.priority];
  const isAssignee = task.assignee?.id === currentUserId;
  const canClaim = isMember && task.status === 'open';
  const canUpdateStatus = canManage || isAssignee;

  // 下一个状态流转
  const nextStatus: Record<TaskStatus, TaskStatus | null> = {
    open: 'in_progress',
    in_progress: 'review',
    review: 'completed',
    completed: null,
  };
  const nextStatusLabel: Record<TaskStatus, string> = {
    open: '认领任务',
    in_progress: '提交审核',
    review: '标记完成',
    completed: '',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium rounded', status.badge)}>
              {status.label}
            </span>
            <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium rounded', priority.badge)}>
              {priority.label}
            </span>
            {task.dueDate && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(task.dueDate)}
              </span>
            )}
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-left text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {task.title}
            {task.description && (
              <span className="ml-1 text-gray-400">{expanded ? '▲' : '▼'}</span>
            )}
          </button>
          {expanded && task.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          )}
        </div>

        {/* 指派人 */}
        {task.assignee && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <UserAvatar username={task.assignee.username} avatar={task.assignee.avatar} size="sm" />
            <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
              {task.assignee.username}
            </span>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        {canClaim && (
          <button
            onClick={onClaim}
            disabled={updating}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {updating ? '处理中...' : nextStatusLabel[task.status]}
          </button>
        )}
        {!canClaim && canUpdateStatus && nextStatus[task.status] && (
          <button
            onClick={() => onStatusChange(nextStatus[task.status]!)}
            disabled={updating}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50 transition-colors"
          >
            {updating ? '处理中...' : nextStatusLabel[task.status]}
          </button>
        )}
        {canManage && task.status !== 'completed' && (
          <select
            value={task.status}
            onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
            disabled={updating}
            className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="open">待认领</option>
            <option value="in_progress">进行中</option>
            <option value="review">待审核</option>
            <option value="completed">已完成</option>
          </select>
        )}
      </div>
    </div>
  );
}

// ============ 新建任务表单 ============
function TaskCreateForm({
  projectId,
  token,
  onSuccess,
  onCancel,
}: {
  projectId: string;
  token: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('请输入任务标题');
      return;
    }
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/collab/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建失败');
      toast.success('任务创建成功');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 p-4 space-y-3"
    >
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          任务标题 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="简要描述任务..."
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          任务描述（可选）
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="详细说明任务要求..."
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            优先级
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="urgent">紧急</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            截止日期（可选）
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? '创建中...' : '创建任务'}
        </button>
      </div>
    </form>
  );
}

// ============ Tab 3: 团队成员 ============
function MembersTab({ project }: { project: ProjectDetail }) {
  const members = project.members || [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          团队成员 <span className="text-sm font-normal text-gray-400">({members.length})</span>
        </h3>
        <span className="text-sm text-gray-400 dark:text-gray-500">
          {project.memberCount} / {project.maxMembers} 人
        </span>
      </div>

      {members.length === 0 ? (
        <EmptyBox icon="👥" text="暂无成员" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {members.map((member) => {
            const role = roleConfig[member.role];
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <UserAvatar username={member.username} avatar={member.avatar} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {member.username}
                    </p>
                    <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium rounded', role.badge)}>
                      {role.label}
                    </span>
                  </div>
                  {member.githubUsername && (
                    <a
                      href={`https://github.com/${member.githubUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mt-0.5"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                      @{member.githubUsername}
                    </a>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    加入于 {formatDate(member.joinedAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ Tab 4: 提交贡献 ============
function ContributionsTab({
  projectId,
  contributions,
  loading,
  canManage,
  isMember,
  tasks,
  token,
  onRefresh,
}: {
  projectId: string;
  contributions: Contribution[];
  loading: boolean;
  canManage: boolean;
  isMember: boolean;
  tasks: Task[];
  token: string | null;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const handleReview = async (contribId: string, status: 'approved' | 'rejected') => {
    if (!token) return;
    setReviewingId(contribId);
    try {
      const res = await fetch(`/api/collab/projects/${projectId}/contributions/${contribId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '审核失败');
      toast.success(status === 'approved' ? '已通过贡献' : '已拒绝贡献');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || '审核失败');
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          提交贡献 <span className="text-sm font-normal text-gray-400">({contributions.length})</span>
        </h3>
        {isMember && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showForm ? '取消' : '+ 提交贡献'}
          </button>
        )}
      </div>

      {/* 提交贡献表单 */}
      {showForm && isMember && (
        <ContributionForm
          projectId={projectId}
          token={token}
          tasks={tasks}
          onSuccess={() => {
            setShowForm(false);
            onRefresh();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* 贡献列表 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-3" />
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : contributions.length === 0 ? (
        <EmptyBox
          icon="🎁"
          text="暂无贡献"
          subText={isMember ? '完成开发后提交你的贡献记录' : '成员提交的贡献将显示在这里'}
        />
      ) : (
        <div className="space-y-3">
          {contributions.map((contrib) => {
            const typeCfg = contributionTypeConfig[contrib.type];
            const statusCfg = contributionStatusConfig[contrib.status];
            const canReview = canManage && contrib.status === 'pending';
            return (
              <div
                key={contrib.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* 类型图标 */}
                  <span className={cn('inline-flex items-center justify-center w-9 h-9 rounded-lg text-base flex-shrink-0', typeCfg.color)}>
                    {typeCfg.icon}
                  </span>

                  <div className="flex-1 min-w-0">
                    {/* 标题行 */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={cn('inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded', typeCfg.color)}>
                            {typeCfg.label}
                          </span>
                          <span className={cn('inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded', statusCfg.badge)}>
                            {statusCfg.label}
                          </span>
                        </div>
                        {contrib.url ? (
                          <a
                            href={contrib.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            {contrib.title}
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{contrib.title}</p>
                        )}
                      </div>
                    </div>

                    {/* 描述 */}
                    {contrib.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {contrib.description}
                      </p>
                    )}

                    {/* 元信息 */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-400 dark:text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <UserAvatar username={contrib.contributor.username} avatar={contrib.contributor.avatar} size="xs" />
                        {contrib.contributor.username}
                      </span>
                      {contrib.task && (
                        <span className="inline-flex items-center gap-1">
                          <span>📌</span>
                          {contrib.task.title}
                        </span>
                      )}
                      {contrib.commitSha && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <span>🔗</span>
                          {contrib.commitSha.slice(0, 7)}
                        </span>
                      )}
                      {contrib.branch && (
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          {contrib.branch}
                        </span>
                      )}
                      {typeof contrib.additions === 'number' && (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-green-600 dark:text-green-400">+{contrib.additions}</span>
                          <span className="text-red-600 dark:text-red-400">-{contrib.deletions ?? 0}</span>
                        </span>
                      )}
                      <span>{formatTimeAgo(contrib.createdAt)}</span>
                    </div>

                    {/* 审核按钮 */}
                    {canReview && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <button
                          onClick={() => handleReview(contrib.id, 'approved')}
                          disabled={reviewingId === contrib.id}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          ✓ 通过
                        </button>
                        <button
                          onClick={() => handleReview(contrib.id, 'rejected')}
                          disabled={reviewingId === contrib.id}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                        >
                          ✕ 拒绝
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ 提交贡献表单 ============
function ContributionForm({
  projectId,
  token,
  tasks,
  onSuccess,
  onCancel,
}: {
  projectId: string;
  token: string | null;
  tasks: Task[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<ContributionType>('commit');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const [branch, setBranch] = useState('');
  const [additions, setAdditions] = useState('');
  const [deletions, setDeletions] = useState('');
  const [taskId, setTaskId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('请输入贡献标题');
      return;
    }
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/collab/projects/${projectId}/contributions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim() || undefined,
          url: url.trim() || undefined,
          commitSha: commitSha.trim() || undefined,
          branch: branch.trim() || undefined,
          additions: additions ? Number(additions) : undefined,
          deletions: deletions ? Number(deletions) : undefined,
          taskId: taskId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '提交失败');
      toast.success('贡献提交成功，等待审核');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 p-4 space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            贡献类型 <span className="text-red-500">*</span>
          </label>
          <select value={type} onChange={(e) => setType(e.target.value as ContributionType)} className={inputCls}>
            <option value="commit">Commit 提交</option>
            <option value="PR">Pull Request</option>
            <option value="issue">Issue</option>
            <option value="docs">文档</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            关联任务（可选）
          </label>
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className={inputCls}>
            <option value="">不关联任务</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          标题 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="简要描述这次贡献..."
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          描述（可选）
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="详细说明贡献内容..."
          rows={2}
          className={cn(inputCls, 'resize-y')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            链接 URL（可选）
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/..."
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Commit SHA（可选）
          </label>
          <input
            type="text"
            value={commitSha}
            onChange={(e) => setCommitSha(e.target.value)}
            placeholder="完整 commit SHA"
            className={cn(inputCls, 'font-mono')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            分支（可选）
          </label>
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="feature-xxx"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            增加行数
          </label>
          <input
            type="number"
            value={additions}
            onChange={(e) => setAdditions(e.target.value)}
            placeholder="0"
            min={0}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            删除行数
          </label>
          <input
            type="number"
            value={deletions}
            onChange={(e) => setDeletions(e.target.value)}
            placeholder="0"
            min={0}
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? '提交中...' : '提交贡献'}
        </button>
      </div>
    </form>
  );
}

// ============ Tab 5: GitHub 动态 ============
function GithubTab({
  repoInfo,
  loading,
  project,
}: {
  repoInfo: RepoInfo | null;
  loading: boolean;
  project: ProjectDetail;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-full mb-2" />
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!repoInfo) {
    return (
      <EmptyBox
        icon="🐙"
        text="暂无 GitHub 动态"
        subText={project.repoUrl ? '无法获取仓库信息，请检查仓库是否公开' : '该项目暂未关联 GitHub 仓库'}
      />
    );
  }

  const commits = repoInfo.commits || [];
  const contributors = repoInfo.contributors || [];

  return (
    <div className="space-y-6">
      {/* 最近提交记录 */}
      <SectionCard title="📜 最近提交">
        {commits.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">暂无提交记录</p>
        ) : (
          <div className="space-y-2">
            {commits.map((commit) => (
              <div
                key={commit.sha}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-mono flex-shrink-0">
                  {commit.author?.charAt(0).toUpperCase() || '?'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">{commit.message}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-400 dark:text-gray-500">
                    <span>{commit.author}</span>
                    <span className="font-mono">{commit.sha.slice(0, 7)}</span>
                    <span>{formatTimeAgo(commit.date)}</span>
                    {commit.url && (
                      <a
                        href={commit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        查看 →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 贡献者统计 */}
      <SectionCard title="🏆 贡献者统计">
        {contributors.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">暂无贡献者数据</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 pr-4 font-medium">贡献者</th>
                  <th className="pb-2 px-4 font-medium text-center">提交数</th>
                  <th className="pb-2 px-4 font-medium text-center">新增</th>
                  <th className="pb-2 pl-4 font-medium text-center">删除</th>
                </tr>
              </thead>
              <tbody>
                {contributors.map((c, i) => (
                  <tr
                    key={c.username}
                    className="border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                  >
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                        <a
                          href={`https://github.com/${c.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {c.username}
                        </a>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-center text-gray-600 dark:text-gray-300">{c.commits}</td>
                    <td className="py-2.5 px-4 text-center text-green-600 dark:text-green-400">+{c.additions}</td>
                    <td className="py-2.5 pl-4 text-center text-red-600 dark:text-red-400">-{c.deletions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* 仓库概览 */}
      <SectionCard title="📦 仓库概览">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Stars" value={repoInfo.stars ?? 0} icon="⭐" />
          <StatCard label="Forks" value={repoInfo.forks ?? 0} icon="🍴" />
          <StatCard label="Issues" value={repoInfo.openIssues ?? 0} icon="🐛" />
          <StatCard label="默认分支" value={repoInfo.defaultBranch || '-'} icon="🌿" />
        </div>
        {repoInfo.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">{repoInfo.description}</p>
        )}
      </SectionCard>
    </div>
  );
}

// ============ 通用组件 ============
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700">
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">{value}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {label}
          {sub && <span className="ml-1">({sub})</span>}
        </p>
      </div>
    </div>
  );
}

function EmptyBox({
  icon,
  text,
  subText,
}: {
  icon: string;
  text: string;
  subText?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-3xl mb-3">
        {icon}
      </div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{text}</p>
      {subText && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subText}</p>}
    </div>
  );
}
