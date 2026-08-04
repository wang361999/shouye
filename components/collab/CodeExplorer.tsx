'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import SubmitWizard from './SubmitWizard';

// ============ Props ============
interface CodeExplorerProps {
  owner: string;
  repo: string;
  repoUrl: string;
  token: string | null;
  isMember: boolean;
  projectId: string;
  onSaveSuccess?: () => void;
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
function authHeaders(
  token: string | null,
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function formatSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function basename(path: string): string {
  return path.split('/').pop() || path;
}

/** 根据扩展名返回文件图标 */
function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: '🟦', tsx: '🟦', js: '🟨', jsx: '🟨',
    json: '📋', md: '📝', txt: '📄',
    css: '🎨', scss: '🎨', html: '🌐',
    py: '🐍', go: '🐹', rs: '🦀', java: '☕',
    yml: '⚙️', yaml: '⚙️', toml: '⚙️',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️',
    sh: '🔧', bat: '🔧',
  };
  return map[ext] || '📄';
}

/** 获取文件语言标识 */
function fileLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', jsx: 'JSX',
    json: 'JSON', md: 'Markdown', css: 'CSS', scss: 'SCSS',
    html: 'HTML', py: 'Python', go: 'Go', rs: 'Rust',
    yml: 'YAML', yaml: 'YAML', sh: 'Shell',
  };
  return map[ext] || 'Text';
}

// ============ 递归文件树节点 ============
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
  onContextAction?: (item: TreeItem) => void;
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
  const padLeft = depth * 14 + 12;

  return (
    <div>
      <button
        type="button"
        onClick={() => (isDir ? onToggleDir(item.path) : onSelectFile(item.path))}
        className={cn(
          'flex items-center gap-2 w-full text-left py-[5px] pr-2 rounded-md text-[13px] transition-all duration-150 group',
          isSelected
            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60',
        )}
        style={{ paddingLeft: `${padLeft}px` }}
        title={item.path}
      >
        {/* 展开/折叠箭头 */}
        {isDir ? (
          <span className={cn(
            'flex-shrink-0 w-3 h-3 flex items-center justify-center text-[10px] text-gray-400 transition-transform duration-150',
            expanded && 'rotate-90',
          )}>
            ▶
          </span>
        ) : (
          <span className="flex-shrink-0 w-3" />
        )}
        {/* 图标 */}
        <span className="flex-shrink-0 text-[13px] leading-none">
          {isDir ? (expanded ? '📂' : '📁') : fileIcon(name)}
        </span>
        <span className="truncate flex-1">{name}</span>
        {isDir && isLoading && (
          <span className="flex-shrink-0 w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        )}
      </button>

      {isDir && expanded && (
        <div>
          {isLoading && !dirCache[item.path] ? (
            <div className="py-1.5 space-y-1.5" style={{ paddingLeft: `${(depth + 1) * 14 + 12}px` }}>
              <div className="h-3 bg-gray-150 dark:bg-gray-700/50 rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-gray-150 dark:bg-gray-700/50 rounded w-1/2 animate-pulse" />
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
              className="text-[11px] text-gray-300 dark:text-gray-600 py-1 italic"
              style={{ paddingLeft: `${(depth + 1) * 14 + 12}px` }}
            >
              空目录
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
  const [defaultBranch, setDefaultBranch] = useState<string>('');

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
  const [hasChanges, setHasChanges] = useState(false);

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

  // ---- 新建文件 ----
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const [newFileCommitMsg, setNewFileCommitMsg] = useState('');
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileBaseDir, setNewFileBaseDir] = useState('');

  // ---- 更多操作菜单 ----
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // ---- 引导式提交向导 ----
  const [showSubmitWizard, setShowSubmitWizard] = useState(false);

  // ---- 编辑器 ref ----
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // ============ API: 获取内容 ============
  const fetchContents = useCallback(
    async (path: string, ref: string) => {
      const params = new URLSearchParams({ owner, repo, path });
      if (ref) params.set('ref', ref);
      const res = await fetch(`/api/collab/github/contents?${params.toString()}`, {
        headers: authHeaders(token),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || '获取内容失败');
      return json;
    },
    [owner, repo, token],
  );

  // ============ API: 获取分支列表 ============
  const fetchBranches = useCallback(async () => {
    const params = new URLSearchParams({ owner, repo });
    const res = await fetch(`/api/collab/github/branches?${params.toString()}`, {
      headers: authHeaders(token),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || '获取分支列表失败');
    return (json?.data as string[]) || [];
  }, [owner, repo, token]);

  // ============ 获取目录列表 ============
  const fetchDir = useCallback(
    async (path: string) => {
      if (!currentBranch) return;
      setLoadingDirs((prev) => new Set(prev).add(path));
      try {
        const json = await fetchContents(path, currentBranch);
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
      setHasChanges(false);
      setFileLoading(true);
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
        // 静默处理
      }
    },
    [projectId, token],
  );

  // ============ 检测内容变化 ============
  const handleEditChange = useCallback((value: string) => {
    setEditContent(value);
    setHasChanges(value !== file?.content);
  }, [file]);

  // ============ 保存文件 ============
  const handleSave = useCallback(async () => {
    if (!file || !currentBranch) return;
    if (!commitMessage.trim()) {
      toast.error('请填写提交信息');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/collab/github/edit-file', {
        method: 'PUT',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          owner, repo,
          path: file.path,
          content: editContent,
          message: commitMessage,
          branch: currentBranch,
          sha: file.sha,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || '保存失败');
      setFile((prev) => prev ? { ...prev, sha: json?.sha || prev.sha, content: editContent } : prev);
      setHasChanges(false);
      await autoSubmitContribution({
        type: 'commit',
        title: commitMessage,
        description: `编辑文件：${file.path}`,
        commitSha: json?.commitSha,
        branch: currentBranch,
        url: `https://github.com/${owner}/${repo}/commit/${json?.commitSha || ''}`,
      });
      toast.success('已保存，贡献已记录');
      setCommitMessage('');
      setMode('view');
      onSaveSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [file, currentBranch, commitMessage, editContent, owner, repo, token, autoSubmitContribution, onSaveSuccess]);

  // ============ 新建文件 ============
  const openNewFile = useCallback((baseDir?: string) => {
    setNewFileBaseDir(baseDir || '');
    setNewFilePath('');
    setNewFileContent('');
    setNewFileCommitMsg('');
    setShowNewFile(true);
  }, []);

  const handleCreateFile = useCallback(async () => {
    if (!currentBranch) return;
    const trimmedPath = newFilePath.trim();
    if (!trimmedPath) { toast.error('请输入文件名'); return; }
    if (!newFileCommitMsg.trim()) { toast.error('请填写提交信息'); return; }
    let rawPath = newFileBaseDir ? `${newFileBaseDir.replace(/\/$/, '')}/${trimmedPath}` : trimmedPath;
    const isFolder = rawPath.endsWith('/');
    const fullPath = isFolder ? `${rawPath}.gitkeep` : rawPath;
    const finalContent = isFolder ? '' : newFileContent;
    setCreatingFile(true);
    try {
      const res = await fetch('/api/collab/github/edit-file', {
        method: 'PUT',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ owner, repo, path: fullPath, content: finalContent, message: newFileCommitMsg, branch: currentBranch }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || '创建文件失败');
      await autoSubmitContribution({
        type: 'commit', title: newFileCommitMsg,
        description: isFolder ? `新建文件夹：${rawPath}` : `新建文件：${fullPath}`,
        commitSha: json?.commitSha, branch: currentBranch,
        url: `https://github.com/${owner}/${repo}/commit/${json?.commitSha || ''}`,
      });
      toast.success('文件创建成功，贡献已记录');
      setShowNewFile(false);
      setDirCache((prev) => { const next = { ...prev }; delete next[newFileBaseDir]; return next; });
      fetchDir(newFileBaseDir);
      if (!isFolder) selectFile(fullPath);
      onSaveSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建文件失败');
    } finally {
      setCreatingFile(false);
    }
  }, [currentBranch, newFilePath, newFileContent, newFileCommitMsg, newFileBaseDir, owner, repo, token, autoSubmitContribution, fetchDir, selectFile, onSaveSuccess]);

  // ============ 创建分支 ============
  const handleCreateBranch = useCallback(async () => {
    if (!newBranchName.trim()) { toast.error('请输入分支名'); return; }
    setCreatingBranch(true);
    try {
      const res = await fetch('/api/collab/github/branches', {
        method: 'POST',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ owner, repo, branchName: newBranchName.trim(), fromBranch: newBranchFrom || currentBranch || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || '创建分支失败');
      toast.success(json?.message || '分支创建成功');
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
    if (!prForm.title.trim()) { toast.error('请填写 PR 标题'); return; }
    if (!prForm.head) { toast.error('请选择源分支'); return; }
    if (prForm.base && prForm.head === prForm.base) { toast.error('源分支和目标分支不能相同'); return; }
    if (branches.length < 2 && !prForm.base) { toast.error('请先创建功能分支后再发起 PR'); return; }
    setCreatingPR(true);
    setPrError(null);
    try {
      const res = await fetch('/api/collab/github/pull-request', {
        method: 'POST',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ owner, repo, title: prForm.title, body: prForm.body, head: prForm.head, base: prForm.base || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setPrError(json?.error || '创建 PR 失败'); throw new Error(json?.error); }
      setCreatedPR({ number: json.number, title: json.title, url: json.url, state: json.state });
      await autoSubmitContribution({
        type: 'pull_request', title: prForm.title,
        description: prForm.body || `PR #${json.number}: ${prForm.head} → ${prForm.base || '默认分支'}`,
        url: json.url, branch: prForm.head,
      });
      toast.success('PR 创建成功，贡献已记录');
      onPRSuccess?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '创建 PR 失败';
      setPrError(msg);
    } finally {
      setCreatingPR(false);
    }
  }, [prForm, owner, repo, token, branches, autoSubmitContribution, onPRSuccess]);

  // ============ 辅助函数 ============
  const openNewBranch = useCallback(() => {
    setNewBranchFrom(currentBranch || branches[0] || '');
    setNewBranchName('');
    setShowNewBranch(true);
  }, [currentBranch, branches]);

  const openPR = useCallback(() => {
    setCreatedPR(null);
    setPrError(null);
    const defaultHead = currentBranch || branches[0] || '';
    let defaultBase = '';
    if (branches.length >= 2) {
      defaultBase = branches.find((b) => b !== defaultHead) || branches[0];
    }
    setPrForm({ title: '', body: '', head: defaultHead, base: defaultBase });
    setShowPR(true);
  }, [currentBranch, branches]);

  const enterEdit = useCallback(() => {
    if (!isMember) { toast.error('仅项目成员可编辑'); return; }
    if (!file) return;
    setEditContent(file.content);
    setCommitMessage('');
    setHasChanges(false);
    setMode('edit');
  }, [isMember, file]);

  // ============ 初次加载 ============
  useEffect(() => {
    if (!owner || !repo) return;
    let active = true;
    setBranchesLoading(true);
    fetch(`/api/collab/github/repo-info?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`, { headers: authHeaders(token) })
      .then((r) => r.json().catch(() => null))
      .then((data) => { if (active && data?.data?.defaultBranch) setDefaultBranch(data.data.defaultBranch); })
      .catch(() => {});
    fetchBranches()
      .then((list) => {
        if (!active) return;
        if (list.length === 0) { toast.error('未获取到分支，请检查仓库权限'); setBranchesLoading(false); return; }
        setBranches(list);
        setCurrentBranch(list[0]);
        setBranchesLoading(false);
      })
      .catch((e) => { if (!active) return; toast.error(e instanceof Error ? e.message : '获取分支失败'); setBranchesLoading(false); });
    return () => { active = false; };
  }, [fetchBranches, owner, repo, token]);

  useEffect(() => {
    if (!currentBranch) return;
    setDirCache({});
    setExpandedPaths(new Set());
    setSelectedPath(null);
    setFile(null);
    setMode('view');
    fetchDir('');
  }, [currentBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  // 关闭更多菜单
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = () => setShowMoreMenu(false);
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [showMoreMenu]);

  // ============ 未登录 ============
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
        <div className="text-4xl mb-3 opacity-30">🔒</div>
        <p className="text-sm text-gray-400 dark:text-gray-500">请先登录后使用在线代码编辑</p>
      </div>
    );
  }

  const rootItems = dirCache[''] || [];
  const rootLoading = loadingDirs.has('') && !dirCache[''];
  const codespacesUrl = `https://github.com/codespaces/new/${owner}/${repo}`;
  const gitpodUrl = `https://gitpod.io/#https://github.com/${owner}/${repo}`;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 overflow-hidden">
      {/* ===== 顶部导航栏 ===== */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm flex-shrink-0">
        {/* 分支选择器 */}
        <div className="flex items-center gap-1.5 min-w-0">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3v12m0 0l-3-3m3 3l3-3m6-9v12m0 0l3-3m-3 3l-3-3" />
          </svg>
          {branchesLoading ? (
            <div className="h-7 w-28 rounded-md bg-gray-200 dark:bg-gray-800 animate-pulse" />
          ) : (
            <select
              value={currentBranch}
              onChange={(e) => setCurrentBranch(e.target.value)}
              className="h-7 max-w-[140px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-[16px] sm:text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 cursor-pointer"
            >
              {branches.map((b) => (<option key={b} value={b}>{b}</option>))}
            </select>
          )}
        </div>

        {/* 新建分支 - 仅成员 */}
        {isMember && (
          <button
            type="button"
            onClick={openNewBranch}
            disabled={branchesLoading}
            className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-40"
            title="新建分支"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        )}

        <div className="flex-1" />

        {/* 提交贡献 - 主操作 */}
        {isMember && (
          <button
            type="button"
            onClick={() => setShowSubmitWizard(true)}
            disabled={branchesLoading}
            className="h-7 px-3 rounded-md text-[13px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            提交贡献
          </button>
        )}

        {/* 发起 PR */}
        <button
          type="button"
          onClick={openPR}
          disabled={branchesLoading}
          className="h-7 px-3 rounded-md text-[13px] font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 shadow-sm"
        >
          发起 PR
        </button>

        {/* 更多操作 */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowMoreMenu(!showMoreMenu); }}
            className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="更多"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
          </button>
          {showMoreMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1 z-50">
              <a href={codespacesUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-[13px] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <span>🚀</span> Codespaces 打开
              </a>
              <a href={gitpodUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-[13px] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <span>🔗</span> Gitpod 打开
              </a>
              <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-[13px] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-t border-gray-100 dark:border-gray-800 mt-1 pt-1">
                <span>📦</span> GitHub 仓库
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ===== 主体区域 ===== */}
      <div className="flex flex-1 overflow-hidden">
        {/* 文件树侧栏 */}
        <div
          className={cn(
            'border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex flex-col overflow-hidden',
            // 移动端：默认隐藏，覆盖式显示
            showFileTree ? 'fixed inset-0 z-40 w-full max-w-[320px]' : 'hidden',
            // 桌面端：固定侧边栏
            'md:relative md:flex md:w-[260px] md:flex-shrink-0',
          )}
        >
          {/* 文件树头部 */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              文件浏览
            </span>
            <div className="flex items-center gap-1">
              {isMember && (
                <button
                  type="button"
                  onClick={() => openNewFile('')}
                  className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  title="新建文件"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFileTree(false)}
                className="md:hidden h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {/* 文件树内容 */}
          <div className="flex-1 overflow-y-auto p-1.5">
            {rootLoading ? (
              <div className="space-y-2 animate-pulse p-2">
                {[1,2,3,4].map((i) => (<div key={i} className="h-4 bg-gray-200 dark:bg-gray-800 rounded" style={{ width: `${60 + i * 10}%` }} />))}
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
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-3xl mb-2 opacity-20">📦</div>
                <p className="text-xs text-gray-400 dark:text-gray-600">仓库为空</p>
              </div>
            )}
          </div>
        </div>

        {/* 编辑器区域 */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-950 min-w-0">
          {/* 移动端文件树触发按钮 */}
          <div className="md:hidden flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowFileTree(true)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[13px] font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              文件
            </button>
            {selectedPath && (
              <span className="text-[12px] text-gray-400 dark:text-gray-500 truncate font-mono">
                {basename(selectedPath)}
              </span>
            )}
          </div>

          {/* 无选中文件 */}
          {!selectedPath ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="text-5xl mb-4 opacity-10">📄</div>
              <p className="text-sm text-gray-400 dark:text-gray-600 mb-1">选择文件查看内容</p>
              <p className="text-xs text-gray-300 dark:text-gray-700">从左侧文件树中选择一个文件</p>
            </div>
          ) : fileLoading ? (
            <div className="flex-1 p-4 space-y-3 animate-pulse">
              <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded w-1/3" />
              {[1,2,3,4,5,6].map((i) => (<div key={i} className="h-3 bg-gray-100 dark:bg-gray-800 rounded" style={{ width: `${50 + Math.random() * 50}%` }} />))}
            </div>
          ) : file ? (
            <>
              {/* 文件信息栏 */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex-shrink-0">
                <span className="text-sm">{fileIcon(basename(file.path))}</span>
                <span className="text-[13px] font-mono text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0">
                  {file.path}
                </span>
                {file.size != null && (
                  <span className="text-[11px] text-gray-400 dark:text-gray-600 flex-shrink-0">
                    {formatSize(file.size)}
                  </span>
                )}
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 flex-shrink-0">
                  {fileLanguage(file.path)}
                </span>
                {hasChanges && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="未保存的更改" />
                )}
                <span className="text-[11px] text-gray-400 dark:text-gray-600 flex-shrink-0 hidden sm:inline">
                  · {currentBranch}
                </span>
                {/* 操作按钮 */}
                {mode === 'view' ? (
                  isMember ? (
                    <button
                      type="button"
                      onClick={enterEdit}
                      className="h-7 px-3 rounded-md text-[12px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center gap-1 flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      编辑
                    </button>
                  ) : (
                    <span className="text-[11px] text-gray-300 dark:text-gray-700 flex-shrink-0">只读</span>
                  )
                ) : (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => { setMode('view'); setEditContent(file.content); setCommitMessage(''); setHasChanges(false); }}
                      className="h-7 px-3 rounded-md text-[12px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !hasChanges}
                      className="h-7 px-3 rounded-md text-[12px] font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {saving ? (
                        <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      )}
                      保存
                    </button>
                  </div>
                )}
              </div>

              {/* 编辑模式：Commit message */}
              {mode === 'edit' && (
                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-amber-50/50 dark:bg-amber-900/10 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    <input
                      type="text"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="提交信息，如：修复登录页样式问题"
                      className="flex-1 h-8 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 text-[16px] sm:text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* 文件内容 */}
              <div className="flex-1 overflow-auto">
                {mode === 'view' ? (
                  <pre className="p-4 text-[13px] leading-relaxed font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                    {file.content}
                  </pre>
                ) : (
                  <textarea
                    ref={editorRef}
                    value={editContent}
                    onChange={(e) => handleEditChange(e.target.value)}
                    className="w-full h-full min-h-[300px] p-4 text-[16px] sm:text-sm leading-relaxed font-mono text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-950 border-0 resize-none focus:outline-none"
                    spellCheck={false}
                    placeholder="在此输入代码..."
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="text-4xl mb-3 opacity-20">⚠️</div>
              <p className="text-sm text-gray-400 dark:text-gray-600">文件内容加载失败</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== 引导式提交向导 ===== */}
      {showSubmitWizard && (
        <SubmitWizard
          owner={owner}
          repo={repo}
          token={token}
          isMember={isMember}
          projectId={projectId}
          defaultBranch={defaultBranch || branches[0] || 'main'}
          branches={branches}
          currentBranch={currentBranch}
          onPRSuccess={onPRSuccess}
          onClose={() => setShowSubmitWizard(false)}
        />
      )}

      {/* ===== 新建文件弹窗 ===== */}
      {showNewFile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowNewFile(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">新建文件</h3>
              <button type="button" onClick={() => setShowNewFile(false)} className="text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  文件路径 <span className="text-red-400">*</span>
                </label>
                {newFileBaseDir && <div className="text-[11px] text-gray-400 dark:text-gray-500 mb-1 font-mono">📁 {newFileBaseDir}/</div>}
                <input
                  type="text"
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                  placeholder="src/components/Button.tsx"
                  autoFocus
                  className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 text-[16px] sm:text-sm font-mono text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                />
                <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">支持嵌套路径如 a/b/c.ts，以 / 结尾创建文件夹</p>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  提交信息 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newFileCommitMsg}
                  onChange={(e) => setNewFileCommitMsg(e.target.value)}
                  placeholder="feat: 新增 Button 组件"
                  className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 text-[16px] sm:text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">文件内容</label>
                <textarea
                  value={newFileContent}
                  onChange={(e) => setNewFileContent(e.target.value)}
                  placeholder="// 输入文件内容..."
                  rows={6}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 text-[16px] sm:text-sm font-mono text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-y"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-gray-800">
              <button type="button" onClick={() => setShowNewFile(false)} className="h-9 px-4 rounded-lg text-[13px] font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">取消</button>
              <button type="button" onClick={handleCreateFile} disabled={creatingFile} className="h-9 px-4 rounded-lg text-[13px] font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                {creatingFile && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                创建文件
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 新建分支弹窗 ===== */}
      {showNewBranch && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowNewBranch(false)}>
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">新建分支</h3>
              <button type="button" onClick={() => setShowNewBranch(false)} className="text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">分支名 <span className="text-red-400">*</span></label>
                <input type="text" value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)} placeholder="feature/new-ui" autoFocus className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 text-[16px] sm:text-sm font-mono text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">基于分支</label>
                <select value={newBranchFrom} onChange={(e) => setNewBranchFrom(e.target.value)} className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-2.5 text-[16px] sm:text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all">
                  {branches.map((b) => (<option key={b} value={b}>{b}</option>))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-gray-800">
              <button type="button" onClick={() => setShowNewBranch(false)} className="h-9 px-4 rounded-lg text-[13px] font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">取消</button>
              <button type="button" onClick={handleCreateBranch} disabled={creatingBranch} className="h-9 px-4 rounded-lg text-[13px] font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                {creatingBranch && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                创建分支
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 发起 PR 弹窗 ===== */}
      {showPR && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowPR(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">发起 Pull Request</h3>
              <button type="button" onClick={() => setShowPR(false)} className="text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {createdPR ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">PR #{createdPR.number} 创建成功</p>
                  <p className="text-[15px] font-medium text-gray-800 dark:text-gray-100 mt-1">{createdPR.title}</p>
                </div>
                <a href={createdPR.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-9 px-5 rounded-lg text-[13px] font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                  查看 PR #{createdPR.number} ↗
                </a>
                <div><button type="button" onClick={() => setShowPR(false)} className="h-9 px-4 rounded-lg text-[13px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">关闭</button></div>
              </div>
            ) : (
              <>
                <div className="p-5 space-y-4 overflow-y-auto">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">标题 <span className="text-red-400">*</span></label>
                    <input type="text" value={prForm.title} onChange={(e) => setPrForm((p) => ({ ...p, title: e.target.value }))} placeholder="新增用户登录页" className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 text-[16px] sm:text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">描述</label>
                    <textarea value={prForm.body} onChange={(e) => setPrForm((p) => ({ ...p, body: e.target.value }))} placeholder="描述本次变更内容..." rows={3} className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 text-[16px] sm:text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-y" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">源分支 <span className="text-red-400">*</span></label>
                      <select value={prForm.head} onChange={(e) => setPrForm((p) => ({ ...p, head: e.target.value }))} className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-2.5 text-[16px] sm:text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all">
                        <option value="">选择分支</option>
                        {branches.map((b) => (<option key={b} value={b}>{b}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">目标分支</label>
                      <select value={prForm.base} onChange={(e) => setPrForm((p) => ({ ...p, base: e.target.value }))} className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-2.5 text-[16px] sm:text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all">
                        <option value="">默认分支</option>
                        {branches.map((b) => (<option key={b} value={b}>{b}</option>))}
                      </select>
                    </div>
                  </div>
                  {branches.length < 2 && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-[12px] text-amber-700 dark:text-amber-400">
                      <span className="flex-shrink-0">⚠️</span>
                      <span>仓库只有一个分支，请先创建功能分支，修改代码后再发起 PR。</span>
                    </div>
                  )}
                  {prForm.head && prForm.base && prForm.head === prForm.base && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-[12px] text-red-600 dark:text-red-400">
                      <span className="flex-shrink-0">✗</span>
                      <span>源分支和目标分支不能相同</span>
                    </div>
                  )}
                  {prError && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-[12px] text-red-600 dark:text-red-400">
                      <span className="flex-shrink-0">✗</span>
                      <span className="leading-relaxed whitespace-pre-wrap">{prError}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-gray-800">
                  <button type="button" onClick={() => setShowPR(false)} className="h-9 px-4 rounded-lg text-[13px] font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">取消</button>
                  <button type="button" onClick={handleCreatePR} disabled={creatingPR} className="h-9 px-4 rounded-lg text-[13px] font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                    {creatingPR && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                    创建 PR
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