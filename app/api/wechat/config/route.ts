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
        accountType: config.accountType,
        message: '微信公众号未配置 AppID/AppSecret',
      });
    }

    // 非测试模式：仅返回配置状态
    if (!shouldTest) {
      return NextResponse.json({
        configured: true,
        appId: config.appId,
        accountType: config.accountType,
      });
    }

    // 个人号模式不需要测试 Access Token（不调用微信 API）
    if (config.accountType === 'personal') {
      return NextResponse.json({
        configured: true,
        appId: config.appId,
        accountType: 'personal',
        message: '个人号模式，无需测试 API 连接。内容生成后请手动复制到公众号后台发布。',
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
          accountType: config.accountType,
          message: '连接成功，Access Token 获取正常',
        });
      } else {
        return NextResponse.json({
          configured: true,
          appId: config.appId,
          accountType: config.accountType,
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
          accountType: config.accountType,
          error: message,
        },
        { status: 200 },
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
