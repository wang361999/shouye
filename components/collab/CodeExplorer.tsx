'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

// ============ Props ============
interface CodeExplorerProps {
  /** GitHub 仓库 owner */
  owner: string;
  /** GitHub 仓库名 */
  repo: string;
  /** GitHub 仓库 URL（用于 Web IDE 链接） */
  repoUrl: string;
  /** 用户登录 token */
  token: string | null;
  /** 是否为项目成员（只有成员能编辑） */
  isMember: boolean;
  /** 协作项目 ID（用于自动提交贡献记录） */
  projectId: string;
  /** 保存文件成功后的回调（用于刷新最近提交、贡献列表等） */
  onSaveSuccess?: () => void;
  /** 创建 PR 成功后的回调 */
  onPRSuccess?: () => void;
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

interface FileContent {
  content: string;
  sha: string;
  path: string;
  size: number;
}

interface CreatedPR {
  number: number;
  title: string;
  url: string;
  state: string;
}

// ============ 工具函数 ============
/** 构建带认证的请求头 */
function authHeaders(
  token: string | null,
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/** 格式化文件大小 */
function formatSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 从完整路径中提取文件/目录名 */
function basename(path: string): string {
  return path.split('/').pop() || path;
}

// ============ 递归文件树节点（定义在组件外部，避免每次渲染重新挂载） ============
interface TreeNodeProps {
  item: TreeItem;
  depth: number;
  expanded: boolean;
  expandedPaths: Set<string>;
  dirCache: Record<string, TreeItem[]>;
  loadingDirs: Set<string>;
  selectedPath: string | null;
  onToggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
}

function TreeNode({
  item,
  depth,
  expanded,
  expandedPaths,
  dirCache,
  loadingDirs,
  selectedPath,
  onToggleDir,
  onSelectFile,
}: TreeNodeProps) {
  const isDir = item.type === 'dir';
  const isSelected = selectedPath === item.path;
  const isLoading = loadingDirs.has(item.path);
  const name = basename(item.path);
  const padLeft = depth * 12 + 8;

  return (
    <div>
      <button
        type="button"
        onClick={() => (isDir ? onToggleDir(item.path) : onSelectFile(item.path))}
        className={cn(
          'flex items-center gap-1.5 w-full text-left px-2 py-1 rounded text-sm transition-colors',
          'hover:bg-gray-100 dark:hover:bg-gray-700',
          isSelected
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            : 'text-gray-700 dark:text-gray-300',
        )}
        style={{ paddingLeft: `${padLeft}px` }}
        title={item.path}
      >
        <span className="flex-shrink-0 text-xs leading-none">
          {isDir ? (expanded ? '📂' : '📁') : '📄'}
        </span>
        <span className="truncate">{name}</span>
        {isDir && isLoading && (
          <span className="ml-auto text-xs text-gray-400 animate-pulse">…</span>
        )}
      </button>

      {isDir && expanded && (
        <div>
          {isLoading && !dirCache[item.path] ? (
            <div
              className="py-2 space-y-2 animate-pulse"
              style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
            >
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          ) : dirCache[item.path] && dirCache[item.path].length > 0 ? (
            dirCache[item.path].map((child) => (
              <TreeNode
                key={child.path}
                item={child}
                depth={depth + 1}
                expanded={expandedPaths.has(child.path)}
                expandedPaths={expandedPaths}
                dirCache={dirCache}
                loadingDirs={loadingDirs}
                selectedPath={selectedPath}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
              />
            ))
          ) : (
            <div
              className="text-xs text-gray-400 dark:text-gray-500 py-1"
              style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
            >
              （空目录）
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ 主组件 ============
export default function CodeExplorer({
  owner,
  repo,
  repoUrl,
  token,
  isMember,
  projectId,
  onSaveSuccess,
  onPRSuccess,
}: CodeExplorerProps) {
  // ---- 分支相关 ----
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [branchesLoading, setBranchesLoading] = useState(false);

  // ---- 文件树相关 ----
  const [dirCache, setDirCache] = useState<Record<string, TreeItem[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());

  // ---- 文件内容相关 ----
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [file, setFile] = useState<FileContent | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [editContent, setEditContent] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // ---- 新建分支表单 ----
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchFrom, setNewBranchFrom] = useState('');
  const [creatingBranch, setCreatingBranch] = useState(false);

  // ---- PR 表单 ----
  const [showPR, setShowPR] = useState(false);
  const [prForm, setPrForm] = useState({ title: '', body: '', head: '', base: '' });
  const [creatingPR, setCreatingPR] = useState(false);
  const [createdPR, setCreatedPR] = useState<CreatedPR | null>(null);
  const [prError, setPrError] = useState<string | null>(null);

  // ---- 移动端文件树切换 ----
  const [showFileTree, setShowFileTree] = useState(false);

  // ============ API: 获取内容（目录或文件） ============
  const fetchContents = useCallback(
    async (path: string, ref: string) => {
      const params = new URLSearchParams({ owner, repo, path });
      if (ref) params.set('ref', ref);
      const res = await fetch(
        `/api/collab/github/contents?${params.toString()}`,
        { headers: authHeaders(token) },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || '获取内容失败');
      }
      return json;
    },
    [owner, repo, token],
  );

  // ============ API: 获取分支列表 ============
  const fetchBranches = useCallback(async () => {
    const params = new URLSearchParams({ owner, repo });
    const res = await fetch(
      `/api/collab/github/branches?${params.toString()}`,
      { headers: authHeaders(token) },
    );
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.error || '获取分支列表失败');
    }
    return (json?.data as string[]) || [];
  }, [owner, repo, token]);

  // ============ 获取目录列表（带缓存与排序） ============
  const fetchDir = useCallback(
    async (path: string) => {
      if (!currentBranch) return;
      setLoadingDirs((prev) => new Set(prev).add(path));
      try {
        const json = await fetchContents(path, currentBranch);
        const items: TreeItem[] = Array.isArray(json?.data) ? json.data : [];
        // 排序：目录在前，文件在后，再按名称排序
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
    [currentBranch, fetchContents],
  );

  // ============ 展开/折叠目录 ============
  const toggleDir = useCallback(
    (path: string) => {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
      // 尚未加载时触发拉取
      if (!dirCache[path] && !loadingDirs.has(path)) {
        fetchDir(path);
      }
    },
    [dirCache, loadingDirs, fetchDir],
  );

  // ============ 选中并加载文件 ============
  const selectFile = useCallback(
    async (path: string) => {
      if (!currentBranch) return;
      setSelectedPath(path);
      setMode('view');
      setFile(null);
      setFileLoading(true);
      // 移动端选中文件后自动关闭文件树
      setShowFileTree(false);
      try {
        const json = await fetchContents(path, currentBranch);
        const data = json?.data;
        if (data && !Array.isArray(data) && data.content !== undefined) {
          const fc: FileContent = {
            content: data.content,
            sha: data.sha,
            path: data.path,
            size: data.size,
          };
          setFile(fc);
          setEditContent(fc.content);
        } else {
          toast.error('无法加载文件内容');
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '加载文件失败');
      } finally {
        setFileLoading(false);
      }
    },
    [currentBranch, fetchContents],
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
        // 贡献记录提交失败不影响主流程，静默处理
      }
    },
    [projectId, token],
  );

  // ============ 保存文件 ============
  const handleSave = useCallback(async () => {
    if (!file || !currentBranch) return;
    if (!commitMessage.trim()) {
      toast.error('请填写 commit message');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/collab/github/edit-file', {
        method: 'PUT',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          owner,
          repo,
          path: file.path,
          content: editContent,
          message: commitMessage,
          branch: currentBranch,
          sha: file.sha,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || '保存失败');
      }
      // 更新 sha 与内容，避免下次保存冲突
      setFile((prev) =>
        prev
          ? {
              ...prev,
              sha: json?.sha || prev.sha,
              content: editContent,
            }
          : prev,
      );
      // 自动提交贡献记录
      await autoSubmitContribution({
        type: 'commit',
        title: commitMessage,
        description: `编辑文件：${file.path}`,
        commitSha: json?.commitSha,
        branch: currentBranch,
        url: `https://github.com/${owner}/${repo}/commit/${json?.commitSha || ''}`,
      });
      toast.success('保存成功，贡献已自动记录');
      setCommitMessage('');
      setMode('view');
      // 通知父组件刷新数据（最近提交、贡献列表等）
      onSaveSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [file, currentBranch, commitMessage, editContent, owner, repo, token, autoSubmitContribution, onSaveSuccess]);

  // ============ 创建分支 ============
  const handleCreateBranch = useCallback(async () => {
    if (!newBranchName.trim()) {
      toast.error('请输入分支名');
      return;
    }
    setCreatingBranch(true);
    try {
      const res = await fetch('/api/collab/github/branches', {
        method: 'POST',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          owner,
          repo,
          branchName: newBranchName.trim(),
          fromBranch: newBranchFrom || currentBranch || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || '创建分支失败');
      }
      toast.success(json?.message || '分支创建成功');
      // 加入列表并自动切换到新分支
      const newName = json.branchName || newBranchName.trim();
      setBranches((prev) => (prev.includes(newName) ? prev : [...prev, newName]));
      setCurrentBranch(newName);
      setShowNewBranch(false);
      setNewBranchName('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建分支失败');
    } finally {
      setCreatingBranch(false);
    }
  }, [newBranchName, newBranchFrom, currentBranch, owner, repo, token]);

  // ============ 创建 PR ============
  const handleCreatePR = useCallback(async () => {
    if (!prForm.title.trim()) {
      toast.error('请填写 PR 标题');
      return;
    }
    if (!prForm.head) {
      toast.error('请选择源分支');
      return;
    }
    // 客户端校验：head 和 base 不能相同（GitHub 会返回 422 错误）
    if (prForm.base && prForm.head === prForm.base) {
      toast.error('源分支和目标分支不能相同，请选择不同的分支');
      return;
    }
    // 只有一个分支时提示用户先新建分支
    if (branches.length < 2 && !prForm.base) {
      toast.error('仓库只有一个分支，请先点击「+ 新建分支」创建功能分支后再发起 PR');
      return;
    }
    setCreatingPR(true);
    setPrError(null);
    try {
      const res = await fetch('/api/collab/github/pull-request', {
        method: 'POST',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          owner,
          repo,
          title: prForm.title,
          body: prForm.body,
          head: prForm.head,
          base: prForm.base || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const errMsg = json?.error || '创建 PR 失败';
        setPrError(errMsg);
        throw new Error(errMsg);
      }
      setCreatedPR({
        number: json.number,
        title: json.title,
        url: json.url,
        state: json.state,
      });
      // 自动提交贡献记录
      await autoSubmitContribution({
        type: 'pull_request',
        title: prForm.title,
        description: prForm.body || `PR #${json.number}: ${prForm.head} → ${prForm.base || '默认分支'}`,
        url: json.url,
        branch: prForm.head,
      });
      toast.success('PR 创建成功，贡献已自动记录');
      // 通知父组件刷新数据
      onPRSuccess?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '创建 PR 失败';
      setPrError(msg);
    } finally {
      setCreatingPR(false);
    }
  }, [prForm, owner, repo, token, branches, autoSubmitContribution, onPRSuccess]);

  // ============ 打开新建分支表单 ============
  const openNewBranch = useCallback(() => {
    setNewBranchFrom(currentBranch || branches[0] || '');
    setNewBranchName('');
    setShowNewBranch(true);
  }, [currentBranch, branches]);

  // ============ 打开 PR 表单 ============
  const openPR = useCallback(() => {
    setCreatedPR(null);
    setPrError(null);
    // 智能选择默认 head 和 base，避免两者相同（相同会导致 GitHub 422 错误）
    // 策略：head 默认当前分支，base 默认第一个与 head 不同的分支
    const defaultHead = currentBranch || branches[0] || '';
    let defaultBase = '';
    if (branches.length >= 2) {
      defaultBase = branches.find((b) => b !== defaultHead) || branches[0];
    } else if (branches.length === 1) {
      // 只有一个分支时，base 留空（让后端用默认分支），但提示用户新建分支
      defaultBase = '';
    }
    setPrForm({
      title: '',
      body: '',
      head: defaultHead,
      base: defaultBase,
    });
    setShowPR(true);
  }, [currentBranch, branches]);

  // ============ 切换到编辑模式 ============
  const enterEdit = useCallback(() => {
    if (!isMember) {
      toast.error('仅项目成员可编辑');
      return;
    }
    if (!file) return;
    setEditContent(file.content);
    setCommitMessage('');
    setMode('edit');
  }, [isMember, file]);

  // ============ 初次加载分支列表 ============
  useEffect(() => {
    if (!owner || !repo) return;
    let active = true;
    setBranchesLoading(true);
    fetchBranches()
      .then((list) => {
        if (!active) return;
        if (list.length === 0) {
          toast.error('未获取到分支，请检查仓库权限或 Token 配置');
          setBranchesLoading(false);
          return;
        }
        setBranches(list);
        setCurrentBranch(list[0]);
        setBranchesLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        toast.error(e instanceof Error ? e.message : '获取分支失败');
        setBranchesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchBranches, owner, repo]);

  // ============ 分支切换时重置并重新加载根目录 ============
  useEffect(() => {
    if (!currentBranch) return;
    setDirCache({});
    setExpandedPaths(new Set());
    setSelectedPath(null);
    setFile(null);
    setMode('view');
    fetchDir('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBranch]);

  // ============ Web IDE 链接 ============
  const codespacesUrl = `https://github.com/codespaces/new/${owner}/${repo}`;
  const gitpodUrl = `https://gitpod.io/#https://github.com/${owner}/${repo}`;

  // ============ 未登录提示 ============
  if (!token) {
    return (
      <div className="flex items-center justify-center h-[600px] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-sm">
        请先登录后使用在线代码浏览与编辑功能
      </div>
    );
  }

  // ============ 根目录列表 ============
  const rootItems = dirCache[''] || [];
  const rootLoading = loadingDirs.has('') && !dirCache[''];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden">
      {/* ===== 顶部工具栏 ===== */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex-shrink-0">
        {/* 分支选择 */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-500 dark:text-gray-400">分支:</span>
          {branchesLoading ? (
            <div className="h-8 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ) : (
            <select
              value={currentBranch}
              onChange={(e) => setCurrentBranch(e.target.value)}
              className="h-8 max-w-[180px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 新建分支 */}
        {isMember && (
          <button
            type="button"
            onClick={openNewBranch}
            disabled={branchesLoading || branches.length === 0}
            className="h-8 px-3 rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + 新建分支
          </button>
        )}

        <div className="flex-1" />

        {/* 发起 PR */}
        <button
          type="button"
          onClick={openPR}
          disabled={branchesLoading || branches.length === 0}
          className="h-8 px-3 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          发起 PR
        </button>

        {/* Web IDE 链接 */}
        <a
          href={codespacesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 inline-flex items-center px-3 rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          在 Codespaces 中打开
        </a>
        <a
          href={gitpodUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 inline-flex items-center px-3 rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          在 Gitpod 中打开
        </a>
      </div>

      {/* ===== 主体：文件树 + 编辑器 ===== */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* 左侧文件树 */}
        {/* 移动端：可切换的抽屉；桌面端：固定宽度侧边栏 */}
        <div
          className={cn(
            'border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 overflow-y-auto p-2',
            // 移动端：默认隐藏，点击切换显示
            showFileTree ? 'block max-h-[200px]' : 'hidden',
            // 桌面端：始终显示
            'md:block md:w-[280px] md:flex-shrink-0 md:max-h-none',
          )}
        >
          {rootLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
          ) : rootItems.length > 0 ? (
            rootItems.map((item) => (
              <TreeNode
                key={item.path}
                item={item}
                depth={0}
                expanded={expandedPaths.has(item.path)}
                expandedPaths={expandedPaths}
                dirCache={dirCache}
                loadingDirs={loadingDirs}
                selectedPath={selectedPath}
                onToggleDir={toggleDir}
                onSelectFile={selectFile}
              />
            ))
          ) : (
            <div className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
              仓库为空
            </div>
          )}
        </div>

        {/* 右侧编辑器 */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900 min-h-[400px]">
          {/* 移动端文件树切换按钮 */}
          <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
            <button
              type="button"
              onClick={() => setShowFileTree((prev) => !prev)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span>📁</span>
              {showFileTree ? '隐藏文件树' : '显示文件树'}
            </button>
            {selectedPath && (
              <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                {basename(selectedPath)}
              </span>
            )}
          </div>

          {!selectedPath ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500 p-4 text-center">
              从左侧选择一个文件以查看内容
            </div>
          ) : fileLoading ? (
            <div className="flex-1 p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            </div>
          ) : file ? (
            <>
              {/* 文件头 */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                <span className="text-xs">📄</span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-200 truncate">
                  {file.path}
                </span>
                {file.size != null && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatSize(file.size)}
                  </span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  @ {currentBranch}
                </span>
                <div className="flex-1" />
                {mode === 'view' ? (
                  isMember ? (
                    <button
                      type="button"
                      onClick={enterEdit}
                      className="h-7 px-3 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      编辑
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      只读模式
                    </span>
                  )
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('view');
                        setEditContent(file.content);
                        setCommitMessage('');
                      }}
                      className="h-7 px-3 rounded-md text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="h-7 px-3 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? '保存中…' : '保存'}
                    </button>
                  </div>
                )}
              </div>

              {/* 编辑模式下的 commit message 输入栏（置于编辑器上方，确保移动端可见） */}
              {mode === 'edit' && (
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-blue-50/50 dark:bg-blue-900/10">
                  <label className="block text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                    ✏️ Commit message（必填，保存时需填写）
                  </label>
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="例如：更新 README 说明"
                    className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* 文件内容区 */}
              <div className="flex-1 overflow-auto p-4">
                {mode === 'view' ? (
                  <pre className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                    {file.content}
                  </pre>
                ) : (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full min-h-[300px] md:min-h-[400px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 text-sm font-mono text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    spellCheck={false}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
              文件内容加载失败
            </div>
          )}
        </div>
      </div>

      {/* ===== 新建分支弹窗 ===== */}
      {showNewBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                新建分支
              </h3>
              <button
                type="button"
                onClick={() => setShowNewBranch(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  分支名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="例如：feature/new-ui"
                  className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  基于分支
                </label>
                <select
                  value={newBranchFrom}
                  onChange={(e) => setNewBranchFrom(e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowNewBranch(false)}
                className="h-9 px-4 rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateBranch}
                disabled={creatingBranch}
                className="h-9 px-4 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingBranch ? '创建中…' : '创建分支'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 发起 PR 弹窗 ===== */}
      {showPR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                发起 Pull Request
              </h3>
              <button
                type="button"
                onClick={() => setShowPR(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
              >
                ×
              </button>
            </div>

            {createdPR ? (
              /* PR 创建成功：展示链接 */
              <div className="p-6 text-center space-y-3">
                <div className="text-3xl">🎉</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  PR #{createdPR.number} 创建成功
                </div>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {createdPR.title}
                </div>
                <a
                  href={createdPR.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 h-9 px-4 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  查看 PR #{createdPR.number}
                  <span className="text-xs">↗</span>
                </a>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  状态：{createdPR.state}
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPR(false)}
                    className="h-9 px-4 rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    关闭
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      标题 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={prForm.title}
                      onChange={(e) =>
                        setPrForm((prev) => ({ ...prev, title: e.target.value }))
                      }
                      placeholder="例如：新增用户登录页"
                      className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      描述
                    </label>
                    <textarea
                      value={prForm.body}
                      onChange={(e) =>
                        setPrForm((prev) => ({ ...prev, body: e.target.value }))
                      }
                      placeholder="描述本次变更的内容与目的…"
                      rows={4}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        源分支 (head) <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={prForm.head}
                        onChange={(e) =>
                          setPrForm((prev) => ({ ...prev, head: e.target.value }))
                        }
                        className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">请选择</option>
                        {branches.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        目标分支 (base)
                      </label>
                      <select
                        value={prForm.base}
                        onChange={(e) =>
                          setPrForm((prev) => ({ ...prev, base: e.target.value }))
                        }
                        className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">默认分支</option>
                        {branches.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {/* 单分支提示 */}
                  {branches.length < 2 && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                      <span className="flex-shrink-0">⚠️</span>
                      <span>
                        仓库目前只有一个分支，无法直接发起 PR。请先点击「+ 新建分支」创建功能分支，
                        在功能分支上修改代码后，再从功能分支向主分支发起 PR。
                      </span>
                    </div>
                  )}
                  {/* head == base 提示 */}
                  {prForm.head && prForm.base && prForm.head === prForm.base && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
                      <span className="flex-shrink-0">✗</span>
                      <span>源分支和目标分支不能相同，请选择不同的分支</span>
                    </div>
                  )}
                  {/* 服务端返回的错误信息（内联展示，方便阅读长文本） */}
                  {prError && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
                      <span className="flex-shrink-0">✗</span>
                      <span className="leading-relaxed whitespace-pre-wrap">{prError}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowPR(false)}
                    className="h-9 px-4 rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleCreatePR}
                    disabled={creatingPR}
                    className="h-9 px-4 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingPR ? '创建中…' : '创建 PR'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
