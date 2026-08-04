import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  parseGithubRepoUrl,
  fetchGithubRepoInfo,
  fetchGithubCommits,
  fetchGithubContributors,
} from '@/lib/collab';

/**
 * GET /api/products/[slug]/github
 *
 * 根据产品 slug 查询关联的 GitHub 仓库，返回实时数据：
 *   - 仓库基本信息（Star、Fork、语言、描述、最后更新等）
 *   - 最近 5 条提交记录
 *   - Top 5 贡献者
 *
 * 数据源为 GitHub REST API，使用服务端缓存 10 分钟（revalidate=600），
 * 避免高频请求触发 GitHub 速率限制。
 *
 * 若产品不存在、未配置 GitHub 仓库 URL 或 API 请求失败，
 * 返回 { available: false } 由前端静默降级。
 */
// 缓存 10 分钟，平衡实时性与 GitHub API 速率限制
export const revalidate = 600;

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const { slug } = params;

  try {
    // ---- 1. 查询产品 ----
    const product = await prisma.product.findUnique({
      where: { slug },
      select: {
        name: true,
        downloadUrl: true,
        status: true,
      },
    });

    if (!product || product.status !== 'active') {
      return NextResponse.json(
        { available: false, error: '产品不存在或已下架' },
        { status: 404 },
      );
    }

    // ---- 2. 解析 GitHub 仓库 URL ----
    if (!product.downloadUrl) {
      return NextResponse.json({
        available: false,
        error: '该产品未关联 GitHub 仓库',
      });
    }

    const parsed = parseGithubRepoUrl(product.downloadUrl);
    if (!parsed) {
      return NextResponse.json({
        available: false,
        error: '无法解析 GitHub 仓库地址',
      });
    }

    const { owner, repo } = parsed;

    // ---- 3. 并发拉取 GitHub 数据 ----
    // 三个请求相互独立，使用 Promise.all 并发执行
    const [repoInfo, commits, contributors] = await Promise.all([
      fetchGithubRepoInfo(owner, repo),
      fetchGithubCommits(owner, repo, undefined, 5),
      fetchGithubContributors(owner, repo, 5),
    ]);

    // 仓库信息获取失败（可能是私有仓库或 404）
    if (!repoInfo) {
      return NextResponse.json({
        available: false,
        error: 'GitHub 仓库不可访问（可能是私有仓库或地址错误）',
        owner,
        repo,
      });
    }

    // ---- 4. 返回聚合数据 ----
    return NextResponse.json({
      available: true,
      owner,
      repo,
      repoInfo: {
        description: repoInfo.description,
        defaultBranch: repoInfo.defaultBranch,
        language: repoInfo.language,
        stars: repoInfo.stars,
        forks: repoInfo.forks,
        openIssues: repoInfo.openIssues,
        watchers: repoInfo.watchers,
        htmlUrl: repoInfo.htmlUrl,
        homepage: repoInfo.homepage,
        topics: repoInfo.topics,
        updatedAt: repoInfo.updatedAt,
      },
      commits: commits.map((c) => ({
        sha: c.sha,
        message: c.message,
        author: c.author,
        authorAvatar: c.authorAvatar,
        date: c.date,
        htmlUrl: c.htmlUrl,
      })),
      contributors: contributors.map((c) => ({
        login: c.login,
        avatarUrl: c.avatarUrl,
        contributions: c.contributions,
        htmlUrl: c.htmlUrl,
      })),
    });
  } catch (error) {
    console.error('[PRODUCT GITHUB DATA ERROR]', error);
    return NextResponse.json(
      { available: false, error: '获取 GitHub 数据失败' },
      { status: 500 },
    );
  }
}
