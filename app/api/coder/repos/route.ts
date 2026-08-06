import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/auth';
import { getUserReps } from '@/lib/github-file-api';

/**
 * GET /api/coder/repos
 *
 * 获取当前 GitHub Token 用户的仓库列表
 */
export async function GET(request: NextRequest) {
  const authResult = adminAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const repos = await getUserReps(100);
    return NextResponse.json({ repos });
  } catch (error) {
    console.error('[CODER REPOS ERROR]', error);
    return NextResponse.json(
      { error: '获取仓库列表失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
