import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/auth';
import {
  getWechatConfig,
  getAccessToken,
  resetAccessTokenCache,
} from '@/lib/wechat';

// ============ GET /api/wechat/config - 获取微信配置状态 + 测试连接 ============
// 支持 ?test=1 时实际请求微信 API 验证 Access Token 是否可用
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const shouldTest = searchParams.get('test') === '1';

    const config = await getWechatConfig();

    if (!config.configured) {
      return NextResponse.json({
        configured: false,
        appId: undefined,
        message: '微信公众号未配置 AppID/AppSecret',
      });
    }

    // 非测试模式：仅返回配置状态
    if (!shouldTest) {
      return NextResponse.json({
        configured: true,
        appId: config.appId,
      });
    }

    // 测试模式：实际请求 Access Token 验证配置是否有效
    try {
      resetAccessTokenCache();
      const token = await getAccessToken();
      if (token) {
        return NextResponse.json({
          configured: true,
          appId: config.appId,
          message: '连接成功，Access Token 获取正常',
        });
      } else {
        return NextResponse.json({
          configured: true,
          appId: config.appId,
          message: '获取 Access Token 返回为空，请检查配置',
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '获取 Access Token 失败';
      return NextResponse.json(
        {
          configured: true,
          appId: config.appId,
          error: message,
        },
        { status: 200 }, // 返回 200 但带 error 字段，便于前端区分
      );
    }
  } catch (error) {
    console.error('[WECHAT CONFIG ERROR]', error);
    return NextResponse.json(
      { error: '获取微信配置失败' },
      { status: 500 },
    );
  }
}
