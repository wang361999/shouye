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
