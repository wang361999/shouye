import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

/**
 * 一键部署 API
 *
 * GET  /api/admin/deploy  - 检查 Deploy Hook 是否已配置
 * POST /api/admin/deploy  - 触发当前账号的 Vercel 重新部署
 *
 * 用途：双 Vercel 账号轮替场景下，切换到新账号后，
 *       在后台点一下按钮即可触发重新部署，拉取最新代码。
 */

// ============ GET - 检查配置状态 ============
export async function GET(request: NextRequest) {
  const admin = adminAuth(request);
  if (admin instanceof Response) return admin;

  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  return NextResponse.json({
    configured: Boolean(hookUrl),
    message: hookUrl
      ? 'Deploy Hook 已配置，可以一键部署'
      : '未配置 VERCEL_DEPLOY_HOOK_URL 环境变量，请在 Vercel 项目设置中创建 Deploy Hook 并填入环境变量',
  });
}

// ============ POST - 触发部署 ============
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;

    if (!hookUrl) {
      return NextResponse.json(
        {
          error:
            '未配置 VERCEL_DEPLOY_HOOK_URL，请在 Vercel → Settings → Git → Deploy Hooks 创建并填入环境变量',
        },
        { status: 400 },
      );
    }

    // 触发 Vercel Deploy Hook
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
          target: 'vercel',
          detail: `一键部署触发：${deployRes.ok ? '成功' : '失败'}（HTTP ${deployRes.status}）`,
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
      message: '部署已触发，Vercel 正在重新构建，预计 2-5 分钟后完成',
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
