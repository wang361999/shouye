/**
 * GitHub 文件操作工具库
 *
 * 通过 GitHub REST API 直接读取/修改仓库文件，
 * 适用于 Vercel 等只读文件系统环境。
 *
 * 每次写入/删除自动创建一个 commit 并推送到远程。
 */

import { getGithubToken } from '@/lib/collab';

const REPO = process.env.GITHUB_REPO || 'wang361999/shouye';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const API_BASE = 'https://api.github.com';

/** 文件信息 */
export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

/** 文件内容读取结果 */
export interface FileContentResult {
  content: string;
  sha: string;
  path: string;
}

/** 文件变更操作 */
export interface FileChange {
  type: 'create' | 'write' | 'delete';
  path: string;
  content?: string;
}

/** 文件变更应用结果 */
export interface ApplyResult {
  path: string;
  success: boolean;
  error?: string;
  commitUrl?: string;
}

/**
 * 获取 GitHub API 请求头
 */
async function getHeaders(): Promise<Record<string, string>> {
  const token = await getGithubToken();
  if (!token) throw new Error('GITHUB_TOKEN 未配置');
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/**
 * 获取项目文件树（递归）
 * 返回格式化的文件列表字符串
 */
export async function getFileTree(): Promise<string> {
  const headers = await getHeaders();
  const res = await fetch(
    `${API_BASE}/repos/${REPO}/git/trees/${BRANCH}?recursive=1`,
    { headers },
  );

  if (!res.ok) {
    throw new Error(`获取文件树失败: ${res.status}`);
  }

  const data = await res.json();
  const tree: Array<{ path: string; type: string }> = data.tree || [];

  // 过滤掉不需要的目录和文件
  const excludePatterns = [
    /^node_modules\//,
    /^\.next\//,
    /^\.git\//,
    /^dist\//,
    /^build\//,
    /^coverage\//,
    /\.log$/,
    /^\.env/,
    /^package-lock\.json$/,
    /^yarn\.lock$/,
    /^pnpm-lock\.yaml$/,
    /^\.sentryrc/,
    /^sentry\.client\.config/,
    /^sentry\.server\.config/,
    /^sentry\.edge\.config/,
    /^next-env\.d\.ts$/,
  ];

  const files = tree
    .filter((item) => item.type === 'blob')
    .map((item) => item.path)
    .filter((path) => !excludePatterns.some((p) => p.test(path)))
    .sort();

  // 构建树形结构字符串
  const lines: string[] = [];
  let currentDir = '';

  for (const file of files) {
    const dir = file.substring(0, file.lastIndexOf('/'));
    if (dir !== currentDir) {
      const parts = dir.split('/');
      for (let i = 0; i < parts.length; i++) {
        const prefix = parts.slice(0, i + 1).join('/');
        if (!lines.find((l) => l === `${'  '.repeat(i)}📁 ${parts[i]}/`)) {
          lines.push(`${'  '.repeat(i)}📁 ${parts[i]}/`);
        }
      }
      currentDir = dir;
    }
    const fileName = file.substring(file.lastIndexOf('/') + 1);
    const depth = file.split('/').length - 1;
    lines.push(`${'  '.repeat(depth)}📄 ${fileName}`);
  }

  return lines.join('\n');
}

/**
 * 读取文件内容
 */
export async function readFile(filePath: string): Promise<FileContentResult> {
  const headers = await getHeaders();
  const cleanPath = filePath.replace(/^\//, '');
  const res = await fetch(
    `${API_BASE}/repos/${REPO}/contents/${cleanPath}?ref=${BRANCH}`,
    { headers },
  );

  if (!res.ok) {
    if (res.status === 404) throw new Error(`文件不存在: ${cleanPath}`);
    throw new Error(`读取文件失败: ${res.status}`);
  }

  const data = await res.json();

  // 如果是目录，返回目录列表
  if (Array.isArray(data)) {
    const items: FileInfo[] = data.map((item: { name: string; path: string; type: string; size?: number }) => ({
      name: item.name,
      path: item.path,
      type: item.type as 'file' | 'dir',
      size: item.size,
    }));
    return {
      content: `__DIRECTORY__\n${JSON.stringify(items, null, 2)}`,
      sha: '',
      path: cleanPath,
    };
  }

  // 文件内容是 base64 编码的
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return {
    content,
    sha: data.sha,
    path: data.path,
  };
}

/**
 * 列出目录内容
 */
export async function listDir(dirPath: string): Promise<FileInfo[]> {
  const headers = await getHeaders();
  const cleanPath = dirPath.replace(/^\//, '');
  const res = await fetch(
    `${API_BASE}/repos/${REPO}/contents/${cleanPath}?ref=${BRANCH}`,
    { headers },
  );

  if (!res.ok) {
    if (res.status === 404) throw new Error(`目录不存在: ${cleanPath}`);
    throw new Error(`列目录失败: ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    // 是文件不是目录
    return [];
  }

  return data.map((item: { name: string; path: string; type: string; size?: number }) => ({
    name: item.name,
    path: item.path,
    type: item.type as 'file' | 'dir',
    size: item.size,
  }));
}

/**
 * 获取文件的 SHA（用于更新/删除）
 */
async function getFileSha(filePath: string): Promise<string | null> {
  const headers = await getHeaders();
  const cleanPath = filePath.replace(/^\//, '');
  const res = await fetch(
    `${API_BASE}/repos/${REPO}/contents/${cleanPath}?ref=${BRANCH}`,
    { headers },
  );

  if (!res.ok) return null;

  const data = await res.json();
  if (Array.isArray(data)) return null;
  return data.sha || null;
}

/**
 * 创建或更新文件
 */
export async function writeFile(
  filePath: string,
  content: string,
  commitMessage: string,
): Promise<{ commitUrl: string }> {
  const headers = await getHeaders();
  const cleanPath = filePath.replace(/^\//, '');

  // 获取现有文件的 SHA（如果存在）
  const sha = await getFileSha(cleanPath);

  const body: Record<string, unknown> = {
    message: commitMessage,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch: BRANCH,
  };

  if (sha) {
    body.sha = sha;
  }

  const res = await fetch(
    `${API_BASE}/repos/${REPO}/contents/${cleanPath}`,
    {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`写入文件失败: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return { commitUrl: data?.commit?.html_url || '' };
}

/**
 * 删除文件
 */
export async function deleteFile(
  filePath: string,
  commitMessage: string,
): Promise<{ commitUrl: string }> {
  const headers = await getHeaders();
  const cleanPath = filePath.replace(/^\//, '');

  const sha = await getFileSha(cleanPath);
  if (!sha) {
    throw new Error(`文件不存在，无法删除: ${cleanPath}`);
  }

  const res = await fetch(
    `${API_BASE}/repos/${REPO}/contents/${cleanPath}`,
    {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: commitMessage,
        sha,
        branch: BRANCH,
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`删除文件失败: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return { commitUrl: data?.commit?.html_url || '' };
}

/**
 * 批量应用文件变更
 */
export async function applyChanges(
  changes: FileChange[],
  commitMessage: string,
): Promise<ApplyResult[]> {
  const results: ApplyResult[] = [];

  for (const change of changes) {
    try {
      if (change.type === 'delete') {
        const { commitUrl } = await deleteFile(change.path, `${commitMessage} (删除 ${change.path})`);
        results.push({ path: change.path, success: true, commitUrl });
      } else {
        // create 和 write 都用 writeFile
        const { commitUrl } = await writeFile(
          change.path,
          change.content || '',
          `${commitMessage} (${change.type === 'create' ? '新建' : '修改'} ${change.path})`,
        );
        results.push({ path: change.path, success: true, commitUrl });
      }
    } catch (err) {
      results.push({
        path: change.path,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

/**
 * 获取最近的提交记录
 */
export async function getRecentCommits(count = 5): Promise<
  Array<{ sha: string; message: string; author: string; date: string; url: string }>
> {
  const headers = await getHeaders();
  const res = await fetch(
    `${API_BASE}/repos/${REPO}/commits?per_page=${count}&sha=${BRANCH}`,
    { headers },
  );

  if (!res.ok) {
    throw new Error(`获取提交记录失败: ${res.status}`);
  }

  const data = await res.json();
  return data.map((item: {
    sha: string;
    commit: { message: string; author: { name: string; date: string } };
    html_url: string;
  }) => ({
    sha: item.sha.substring(0, 7),
    message: item.commit.message.split('\n')[0],
    author: item.commit.author?.name || 'unknown',
    date: item.commit.author?.date || '',
    url: item.html_url,
  }));
}
