import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { logOperation } from '@/lib/admin-log';

// ============ 默认系统设置 ============
const DEFAULT_SETTINGS: Record<string, string> = {
  site_name: 'Gitd',
  site_description: '开发者工具与社区',
  site_logo: '',
  site_favicon: '',
  theme_color: '#3B82F6',
  dark_mode: 'false',
  hero_title: '让工具回归工具',
  hero_subtitle: '汇聚实用开发者工具',
  home_layout: 'grid',
  admin_path: 'admin',
  login_fail_limit: '5',
  login_lock_minutes: '10',
  email_verify: 'false',
  captcha: 'false',
  resend_api_key: '',
  resend_from_email: '',
  seo_title: 'Gitd - 开发者工具集',
  seo_keywords: '开发者,工具,GitHub,AI',
  seo_description: '汇聚实用开发者工具',
  sponsor_wechat_qr: '',
  sponsor_alipay_qr: '',
  sponsor_text: '如果我们的项目对您有帮助，欢迎赞助支持 ❤️',
  ai_agent_daily_limit: '10',
  ai_agent_inactive_days: '7',
  wechat_app_id: '',
  wechat_app_secret: '',
  wechat_account_type: 'enterprise',
};

// ============ GET /api/admin/settings - 获取所有系统设置 ============
export async function GET(request: NextRequest) {
  try {
    // admin鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    // 从数据库读取所有设置
    const settings = await prisma.systemSetting.findMany();

    // 按 key 组织成对象
    const settingsObj: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const item of settings) {
      settingsObj[item.key] = item.value;
    }

    const resendConfigured = Boolean(settingsObj.resend_api_key || process.env.RESEND_API_KEY);
    const resendFromEmail = settingsObj.resend_from_email || process.env.RESEND_FROM_EMAIL || '';

    // 微信配置状态（不暴露完整 Secret）
    const wechatConfigured = Boolean(
      settingsObj.wechat_app_id && settingsObj.wechat_app_secret,
    );
    const wechatAppId = settingsObj.wechat_app_id || '';
    // 返回掩码后的 Secret，仅用于前端显示"已配置"状态
    const wechatAppSecretMasked = settingsObj.wechat_app_secret
      ? '••••••••'
      : '';

    return NextResponse.json({
      ...settingsObj,
      resend_configured: resendConfigured ? 'true' : 'false',
      resend_from_email: resendFromEmail,
      active_email_provider: resendConfigured ? 'resend' : 'none',
      wechat_app_id: wechatAppId,
      wechat_app_secret: wechatAppSecretMasked,
      wechat_configured: wechatConfigured ? 'true' : 'false',
    });
  } catch (error) {
    console.error('[ADMIN SETTINGS GET ERROR]', error);
    return NextResponse.json(
      { error: '获取系统设置失败' },
      { status: 500 }
    );
  }
}

// ============ POST /api/admin/settings - 保存系统设置 ============
export async function POST(request: NextRequest) {
  try {
    // admin鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();

    // 判断是单个设置还是批量设置
    let settingsToSave: Record<string, string> = {};

    if (body.settings && typeof body.settings === 'object') {
      // 批量保存: {settings: {key1: value1, key2: value2}}
      settingsToSave = body.settings;
    } else if (body.key && body.value !== undefined) {
      // 单个保存: {key, value}
      settingsToSave = { [body.key]: String(body.value) };
    } else {
      return NextResponse.json(
        { error: '请求格式错误，需要 {key, value} 或 {settings: {key1: value1}}' },
        { status: 400 }
      );
    }

    // 将所有值转为字符串存储
    // 敏感字段：掩码值 '••••••••' 表示前端未修改，跳过保存
    const SENSITIVE_MASKED_KEYS = ['wechat_app_secret'];
    const entries = Object.entries(settingsToSave)
      .filter(([key, value]) => {
        // 跳过掩码值（前端未修改密钥）
        if (SENSITIVE_MASKED_KEYS.includes(key) && value === '••••••••') {
          return false;
        }
        return true;
      })
      .map(([key, value]) => ({
        key,
        value: String(value),
      }));

    // 批量 upsert
    await prisma.$transaction(
      entries.map(({ key, value }) =>
        prisma.systemSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );

    // 记录操作日志
    const changedKeys = entries.map((e) => e.key).join(', ');
    await logOperation(
      admin.userId,
      admin.username,
      'update_settings',
      'SystemSetting',
      `更新系统设置: ${changedKeys}`
    );

    return NextResponse.json({ message: '系统设置已保存' });
  } catch (error) {
    console.error('[ADMIN SETTINGS POST ERROR]', error);
    return NextResponse.json(
      { error: '保存系统设置失败' },
      { status: 500 }
    );
  }
}
