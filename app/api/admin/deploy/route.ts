import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

/**
 * 一键部署 API
 *
 * GET  /api/admin/deploy  - 检查 Deploy Hook 是否已配置
 * POST /api/admin/deploy  - 触发 Cloudflare Workers 重新部署
 *
 * 支持 Cloudflare Pages Deploy Hook 和 Vercel Deploy Hook。
 * 优先使用 CLOUDFLARE_DEPLOY_HOOK_URL，其次 VERCEL_DEPLOY_HOOK_URL。
 */

// ============ GET - 检查配置状态 ============
export async function GET(request: NextRequest) {
  const admin = adminAuth(request);
  if (admin instanceof Response) return admin;

  const cfHookUrl = process.env.CLOUDFLARE_DEPLOY_HOOK_URL;
  const vercelHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  const hookUrl = cfHookUrl || vercelHookUrl;
  const platform = cfHookUrl ? 'Cloudflare' : vercelHookUrl ? 'Vercel' : null;

  return NextResponse.json({
    configured: Boolean(hookUrl),
    platform,
    message: hookUrl
      ? `${platform} Deploy Hook 已配置，可以一键部署`
      : '未配置 Deploy Hook URL，请在环境变量中设置 CLOUDFLARE_DEPLOY_HOOK_URL 或 VERCEL_DEPLOY_HOOK_URL',
  });
}

// ============ POST - 触发部署 ============
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const cfHookUrl = process.env.CLOUDFLARE_DEPLOY_HOOK_URL;
    const vercelHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
    const hookUrl = cfHookUrl || vercelHookUrl;
    const platform = cfHookUrl ? 'Cloudflare' : vercelHookUrl ? 'Vercel' : null;

    if (!hookUrl) {
      return NextResponse.json(
        {
          error:
            '未配置 Deploy Hook URL。\n' +
            'Cloudflare: Dashboard → Workers → your-worker → Settings → Builds → Deploy Hooks\n' +
            'Vercel: Dashboard → Settings → Git → Deploy Hooks',
        },
        { status: 400 },
      );
    }

    // 触发 Deploy Hook
    const deployRes = await fetch(hookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    let deployBody: unknown = null;
    try {
      deployBody = await deployRes.json();
    } catch {
      // hook 响应可能不是 JSON
    }

    // 记录操作日志
    try {
      await prisma.operationLog.create({
        data: {
          userId: admin.userId,
          username: admin.username,
          action: 'manual_deploy',
          target: platform?.toLowerCase() || 'unknown',
          detail: `一键部署触发（${platform}）：${deployRes.ok ? '成功' : '失败'}（HTTP ${deployRes.status}）`,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
        },
      });
    } catch {
      // 日志写入失败不影响部署结果
    }

    if (!deployRes.ok) {
      return NextResponse.json(
        {
          error: `Deploy Hook 调用失败（HTTP ${deployRes.status}）`,
          detail: deployBody,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `部署已触发（${platform}），正在重新构建，预计 2-5 分钟后完成`,
      detail: deployBody,
    });
  } catch (error) {
    console.error('[DEPLOY ERROR]', error);
    return NextResponse.json(
      { error: `部署触发失败：${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 },
    );
  }
}
