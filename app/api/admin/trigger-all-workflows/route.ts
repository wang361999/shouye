import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/auth';

/**
 * POST /api/admin/trigger-all-workflows
 * 一键触发所有自动化 GitHub Actions 工作流
 *
 * 通过 GitHub Actions API 的 workflow_dispatch 端点触发指定工作流，
 * 需要配置 GITHUB_TOKEN 环境变量（需要 repo 权限）。
 */
const WORKFLOWS = [
  { id: 'auto-patrol.yml', name: '自动巡检' },
  { id: 'auto-forum-poster.yml', name: '自动发帖' },
  { id: 'auto-forum-reply.yml', name: '自动回复' },
  { id: 'auto-categorizer.yml', name: '自动分类' },
  { id: 'auto-announcer.yml', name: '自动公告' },
  { id: 'auto-link-checker.yml', name: '链接检查' },
  { id: 'auto-stale-cleanup.yml', name: '过期清理' },
  { id: 'auto-seo-optimizer.yml', name: 'SEO优化' },
  { id: 'auto-content-creator.yml', name: '内容创作' },
];

// 仓库名称，从环境变量读取或使用默认值
const REPO = process.env.GITHUB_REPO || 'wang361999/shouye';

export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: '未配置 GITHUB_TOKEN，无法触发工作流。请在环境变量中设置 GitHub Token。' },
        { status: 500 },
      );
    }

    const results: Array<{
      workflow: string;
      name: string;
      status: 'success' | 'failed';
      message?: string;
    }> = [];

    for (const wf of WORKFLOWS) {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${REPO}/actions/workflows/${wf.id}/dispatches`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({ ref: 'main' }),
          },
        );

        if (response.ok) {
          results.push({
            workflow: wf.id,
            name: wf.name,
            status: 'success',
          });
        } else {
          const errorText = await response.text().catch(() => '');
          let errorMsg = `HTTP ${response.status}`;
          // 422 通常表示工作流文件不存在或没有 workflow_dispatch 触发器
          if (response.status === 422) {
            errorMsg = '工作流不存在或不支持手动触发';
          } else if (response.status === 404) {
            errorMsg = '仓库或工作流未找到';
          } else if (response.status === 403) {
            errorMsg = 'Token 权限不足';
          }
          results.push({
            workflow: wf.id,
            name: wf.name,
            status: 'failed',
            message: errorMsg,
          });
        }
      } catch (error) {
        results.push({
          workflow: wf.id,
          name: wf.name,
          status: 'failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    return NextResponse.json({
      message: `已触发 ${successCount} 个工作流${failedCount > 0 ? `，${failedCount} 个失败` : ''}`,
      results,
      successCount,
      failedCount,
    });
  } catch (error) {
    console.error('[TRIGGER ALL WORKFLOWS ERROR]', error);
    return NextResponse.json(
      { error: '触发工作流失败' },
      { status: 500 },
    );
  }
}
