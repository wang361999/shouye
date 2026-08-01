/**
 * GitHub 协作项目（召集令）工具函数
 *
 * 提供 GitHub 仓库 URL 解析、Token 获取、GitHub API 数据拉取以及贡献类型格式化等能力，
 * 供 app/api/collab/* 路由复用。
 */
import prisma from '@/lib/prisma';

/** GitHub 仓库 URL 解析结果 */
export interface ParsedRepoUrl {
  owner: string;
  repo: string;
}

/** GitHub 仓库信息 */
export interface GithubRepoInfo {
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
}

/** GitHub 提交记录 */
export interface GithubCommit {
  sha: string;
  message: string;
  author: string | null;
  authorAvatar: string | null;
  date: string | null;
  htmlUrl: string | null;
}

/** GitHub 贡献者统计 */
export interface GithubContributor {
  login: string;
  avatarUrl: string | null;
  contributions: number;
  htmlUrl: string | null;
}

/**
 * 解析 GitHub 仓库 URL，提取 owner 和 repo name
 *
 * 支持以下格式：
 *  - https://github.com/owner/repo
 *  - https://github.com/owner/repo/
 *  - https://github.com/owner/repo.git
 *  - https://github.com/owner/repo/blob/main/README.md
 *  - https://github.com/owner/repo/tree/main/src
 *  - git@github.com:owner/repo.git
 *  - owner/repo
 *
 * @param url 原始 URL 或简写
 * @returns 解析结果，失败返回 null
 */
export function parseGithubRepoUrl(url: string): ParsedRepoUrl | null {
  if (!url) return null;
  const trimmed = url.trim();

  try {
    // 格式1: git@github.com:owner/repo.git (SSH)
    const sshMatch = trimmed.match(/^git@github\.com:([^\/\s]+)\/([^\/\s]+?)(?:\.git)?(?:\/.*)?$/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    // 格式2: https://github.com/owner/repo(/...)(.git)
    const httpsMatch = trimmed.match(
      /^https?:\/\/github\.com\/([^\/\s]+)\/([^\/\s]+?)(?:\.git)?(?:\/.*)?$/
    );
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }

    // 格式3: 简写 owner/repo
    const shortMatch = trimmed.match(/^([^\/\s]+)\/([^\/\s]+)$/);
    if (shortMatch && !trimmed.includes('://')) {
      return { owner: shortMatch[1], repo: shortMatch[2] };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 从数据库 SystemSetting 或环境变量获取 GitHub Token
 *
 * 优先级：环境变量 GITHUB_TOKEN > 数据库 SystemSetting.github_token
 *
 * @returns Token 字符串，未配置时返回 null
 */
export async function getGithubToken(): Promise<string | null> {
  // 优先使用环境变量
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  // 回退到数据库
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'github_token' },
    });
    return setting?.value || null;
  } catch {
    return null;
  }
}

/**
 * 构建带认证与必要 Header 的 GitHub API 请求头
 *
 * @param token GitHub Token（可选）
 */
export function buildGithubHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ET-Studio-Collab',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * 获取 GitHub 仓库信息（描述、默认分支、star 数等）
 *
 * 调用 GitHub REST API: GET /repos/{owner}/{repo}
 *
 * @param owner 仓库所有者
 * @param repo 仓库名
 * @returns 仓库信息，失败返回 null
 */
export async function fetchGithubRepoInfo(
  owner: string,
  repo: string,
): Promise<GithubRepoInfo | null> {
  try {
    const token = await getGithubToken();
    const headers = buildGithubHeaders(token);

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers },
    );

    if (!response.ok) {
      console.error(
        `[GITHUB REPO INFO ERROR] status=${response.status} owner=${owner} repo=${repo}`,
      );
      return null;
    }

    const data = await response.json();

    return {
      description: data.description ?? null,
      defaultBranch: data.default_branch ?? null,
      language: data.language ?? null,
      stars: data.stargazers_count ?? 0,
      forks: data.forks_count ?? 0,
      openIssues: data.open_issues_count ?? 0,
      watchers: data.subscribers_count ?? data.watchers_count ?? 0,
      htmlUrl: data.html_url ?? null,
      homepage: data.homepage ?? null,
      topics: Array.isArray(data.topics) ? data.topics : [],
      updatedAt: data.updated_at ?? null,
    };
  } catch (error) {
    console.error('[GITHUB REPO INFO ERROR]', error);
    return null;
  }
}

/**
 * 获取仓库最近提交记录
 *
 * 调用 GitHub REST API: GET /repos/{owner}/{repo}/commits
 *
 * @param owner 仓库所有者
 * @param repo 仓库名
 * @param branch 分支名（可选，默认仓库默认分支）
 * @param perPage 每页数量，默认 5，最大 100
 * @returns 提交列表，失败返回空数组
 */
export async function fetchGithubCommits(
  owner: string,
  repo: string,
  branch?: string,
  perPage: number = 5,
): Promise<GithubCommit[]> {
  try {
    const token = await getGithubToken();
    const headers = buildGithubHeaders(token);

    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
    if (branch) {
      url.searchParams.set('sha', branch);
    }
    url.searchParams.set('per_page', String(Math.min(Math.max(perPage, 1), 100)));

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      console.error(
        `[GITHUB COMMITS ERROR] status=${response.status} owner=${owner} repo=${repo}`,
      );
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
      sha: item.sha ?? '',
      message: item.commit?.message ?? '',
      author: item.author?.login ?? item.commit?.author?.name ?? null,
      authorAvatar: item.author?.avatar_url ?? null,
      date: item.commit?.author?.date ?? item.commit?.committer?.date ?? null,
      htmlUrl: item.html_url ?? null,
    }));
  } catch (error) {
    console.error('[GITHUB COMMITS ERROR]', error);
    return [];
  }
}

/**
 * 获取仓库贡献者统计
 *
 * 调用 GitHub REST API: GET /repos/{owner}/{repo}/contributors
 *
 * @param owner 仓库所有者
 * @param repo 仓库名
 * @param perPage 每页数量，默认 10
 * @returns 贡献者列表，失败返回空数组
 */
export async function fetchGithubContributors(
  owner: string,
  repo: string,
  perPage: number = 10,
): Promise<GithubContributor[]> {
  try {
    const token = await getGithubToken();
    const headers = buildGithubHeaders(token);

    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/contributors`,
    );
    url.searchParams.set('per_page', String(Math.min(Math.max(perPage, 1), 100)));

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      console.error(
        `[GITHUB CONTRIBUTORS ERROR] status=${response.status} owner=${owner} repo=${repo}`,
      );
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
      login: item.login ?? '',
      avatarUrl: item.avatar_url ?? null,
      contributions: item.contributions ?? 0,
      htmlUrl: item.html_url ?? null,
    }));
  } catch (error) {
    console.error('[GITHUB CONTRIBUTORS ERROR]', error);
    return [];
  }
}

/** 贡献类型与显示文本的映射 */
const CONTRIBUTION_TYPE_LABELS: Record<string, string> = {
  commit: '提交',
  pull_request: 'Pull Request',
  issue: 'Issue',
  docs: '文档',
  other: '其他',
};

/**
 * 格式化贡献类型为中文显示文本
 *
 * @param type 贡献类型（commit/pull_request/issue/docs/other）
 * @returns 显示文本
 */
export function formatContributionType(type: string): string {
  return CONTRIBUTION_TYPE_LABELS[type] || type || '其他';
}

/**
 * 判断用户是否为项目的核心成员（owner / maintainer）
 *
 * @param projectId 项目 ID
 * @param userId 用户 ID
 * @returns 若为活跃的 owner 或 maintainer 返回 true
 */
export async function isProjectManager(
  projectId: string,
  userId: string,
): Promise<boolean> {
  const member = await prisma.collabMember.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
    select: { role: true, status: true },
  });
  if (!member || member.status !== 'active') return false;
  return member.role === 'owner' || member.role === 'maintainer';
}

/**
 * 判断用户是否为项目的活跃成员（含 owner/maintainer/member）
 *
 * @param projectId 项目 ID
 * @param userId 用户 ID
 */
export async function isProjectMember(
  projectId: string,
  userId: string,
): Promise<boolean> {
  const member = await prisma.collabMember.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
    select: { status: true },
  });
  return !!member && member.status === 'active';
}

/**
 * 安全解析 JSON 字符串为数组
 *
 * 协作项目的 techStack / tags / labels 等字段以 JSON 字符串形式存储，
 * 统一在此解析，解析失败时返回空数组。
 *
 * @param raw 原始字符串
 */
export function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 将字符串数组序列化为 JSON 字符串，用于写入数据库
 *
 * @param arr 字符串数组
 */
export function stringifyJsonArray(arr: string[] | null | undefined): string {
  return JSON.stringify(arr ?? []);
}

// ============ 在线代码编辑相关 GitHub API ============

/** GitHub 仓库内容项（文件或目录） */
export interface GithubTreeItem {
  path: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  size?: number;
  sha?: string;
  url?: string;
}

/**
 * 获取仓库指定路径下的文件/目录列表
 * 调用 GitHub REST API: GET /repos/{owner}/{repo}/contents/{path}
 *
 * @param owner 仓库所有者
 * @param repo 仓库名
 * @param path 目录路径，默认根目录
 * @param ref 分支/commit/tag，默认仓库默认分支
 * @returns 内容项列表，失败返回空数组
 */
export async function fetchGithubContents(
  owner: string,
  repo: string,
  path: string = '',
  ref?: string,
): Promise<GithubTreeItem[]> {
  try {
    const token = await getGithubToken();
    const headers = buildGithubHeaders(token);

    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    );
    if (ref) url.searchParams.set('ref', ref);

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      console.error(
        `[GITHUB CONTENTS ERROR] status=${response.status} owner=${owner} repo=${repo} path=${path}`,
      );
      return [];
    }

    const data = await response.json();

    // 单文件返回对象，目录返回数组
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
      path: item.path ?? '',
      type: (item.type as GithubTreeItem['type']) ?? 'file',
      size: item.size,
      sha: item.sha,
      url: item.html_url,
    }));
  } catch (error) {
    console.error('[GITHUB CONTENTS ERROR]', error);
    return [];
  }
}

/** GitHub 文件内容（含 SHA 用于后续更新） */
export interface GithubFileContent {
  content: string;
  sha: string;
  path: string;
  size: number;
  encoding: string;
}

/**
 * 获取仓库中单个文件的内容（含 SHA，用于后续更新）
 * 调用 GitHub REST API: GET /repos/{owner}/{repo}/contents/{path}
 *
 * @param owner 仓库所有者
 * @param repo 仓库名
 * @param path 文件路径
 * @param ref 分支/commit/tag
 * @returns 文件内容，失败返回 null
 */
export async function fetchGithubFile(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<GithubFileContent | null> {
  try {
    const token = await getGithubToken();
    const headers = buildGithubHeaders(token);

    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    );
    if (ref) url.searchParams.set('ref', ref);

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      console.error(
        `[GITHUB FILE FETCH ERROR] status=${response.status} owner=${owner} repo=${repo} path=${path}`,
      );
      return null;
    }

    const data = await response.json();

    // 确保是文件而非目录
    if (data.type !== 'file' || !data.content) return null;

    // GitHub 返回 base64 编码内容，可能含换行符
    const content = Buffer.from(data.content, 'base64').toString('utf-8');

    return {
      content,
      sha: data.sha ?? '',
      path: data.path ?? path,
      size: data.size ?? content.length,
      encoding: data.encoding ?? 'base64',
    };
  } catch (error) {
    console.error('[GITHUB FILE FETCH ERROR]', error);
    return null;
  }
}

/**
 * 创建或更新仓库中的文件
 * 调用 GitHub REST API: PUT /repos/{owner}/{repo}/contents/{path}
 *
 * @param owner 仓库所有者
 * @param repo 仓库名
 * @param path 文件路径
 * @param content 文件内容（UTF-8）
 * @param message commit 消息
 * @param branch 目标分支
 * @param sha 已有文件的 SHA（更新时必传，新建时不传）
 * @returns commit 信息，失败返回 null
 */
export async function updateGithubFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
  sha?: string,
): Promise<{ sha: string; commitSha: string } | null> {
  try {
    const token = await getGithubToken();
    const headers = buildGithubHeaders(token);
    headers['Content-Type'] = 'application/json';

    const body: Record<string, unknown> = {
      message,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      branch,
    };
    if (sha) body.sha = sha;

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      console.error(
        `[GITHUB FILE UPDATE ERROR] status=${response.status}`,
        errData?.message,
      );
      return null;
    }

    const data = await response.json();

    return {
      sha: data.content?.sha ?? '',
      commitSha: data.commit?.sha ?? '',
    };
  } catch (error) {
    console.error('[GITHUB FILE UPDATE ERROR]', error);
    return null;
  }
}

/**
 * 创建新分支
 * 调用 GitHub REST API: POST /repos/{owner}/{repo}/git/refs
 *
 * @param owner 仓库所有者
 * @param repo 仓库名
 * @param branchName 新分支名
 * @param fromBranch 基于的分支（默认仓库默认分支）
 * @returns 是否创建成功
 */
export async function createGithubBranch(
  owner: string,
  repo: string,
  branchName: string,
  fromBranch?: string,
): Promise<boolean> {
  try {
    const token = await getGithubToken();
    const headers = buildGithubHeaders(token);
    headers['Content-Type'] = 'application/json';

    // 1. 获取基准分支的 SHA
    let baseSha: string | null = null;

    if (fromBranch) {
      const refResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${fromBranch}`,
        { headers },
      );
      if (refResponse.ok) {
        const refData = await refResponse.json();
        baseSha = refData.object?.sha ?? null;
      }
    }

    // 未指定分支或获取失败时，获取默认分支
    if (!baseSha) {
      const repoResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers },
      );
      if (!repoResponse.ok) return false;
      const repoData = await repoResponse.json();
      const defaultBranch = fromBranch || repoData.default_branch || 'main';

      const refResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`,
        { headers },
      );
      if (!refResponse.ok) return false;
      const refData = await refResponse.json();
      baseSha = refData.object?.sha ?? null;
    }

    if (!baseSha) return false;

    // 2. 创建新分支
    const createResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      },
    );

    return createResponse.ok;
  } catch (error) {
    console.error('[GITHUB CREATE BRANCH ERROR]', error);
    return false;
  }
}

/**
 * 列出仓库的所有分支
 * 调用 GitHub REST API: GET /repos/{owner}/{repo}/branches
 *
 * @param owner 仓库所有者
 * @param repo 仓库名
 * @returns 分支名列表，失败返回空数组
 */
export async function fetchGithubBranches(
  owner: string,
  repo: string,
): Promise<string[]> {
  try {
    const token = await getGithubToken();
    const headers = buildGithubHeaders(token);

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
      { headers },
    );

    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((b: any) => b.name).filter(Boolean);
  } catch (error) {
    console.error('[GITHUB BRANCHES ERROR]', error);
    return [];
  }
}

/** 创建 PR 的结果 */
export interface GithubPullRequest {
  number: number;
  title: string;
  url: string;
  state: string;
}

/**
 * 创建 Pull Request
 * 调用 GitHub REST API: POST /repos/{owner}/{repo}/pulls
 *
 * @param owner 仓库所有者
 * @param repo 仓库名
 * @param title PR 标题
 * @param body PR 描述
 * @param head 源分支
 * @param base 目标分支（默认仓库默认分支）
 * @returns PR 信息，失败返回 null
 */
export async function createGithubPullRequest(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base?: string,
): Promise<GithubPullRequest | null> {
  try {
    const token = await getGithubToken();
    const headers = buildGithubHeaders(token);
    headers['Content-Type'] = 'application/json';

    // 未指定 base 时获取默认分支
    let baseBranch = base;
    if (!baseBranch) {
      const repoResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers },
      );
      if (repoResponse.ok) {
        const repoData = await repoResponse.json();
        baseBranch = repoData.default_branch || 'main';
      } else {
        baseBranch = 'main';
      }
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          body,
          head,
          base: baseBranch,
        }),
      },
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      console.error(
        `[GITHUB CREATE PR ERROR] status=${response.status}`,
        errData?.message,
      );
      return null;
    }

    const data = await response.json();

    return {
      number: data.number ?? 0,
      title: data.title ?? title,
      url: data.html_url ?? '',
      state: data.state ?? 'open',
    };
  } catch (error) {
    console.error('[GITHUB CREATE PR ERROR]', error);
    return null;
  }
}
