import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

// ============ OAuth 配置键 ============
const OAUTH_KEYS = [
  'github_client_id',
  'github_client_secret',
  'github_oauth_enabled',
  'google_client_id',
  'google_client_secret',
  'google_oauth_enabled',
];

// ============ 默认值 ============
const DEFAULTS: Record<string, string> = {
  github_client_id: '',
  github_client_secret: '',
  github_oauth_enabled: 'false',
  google_client_id: '',
  google_client_secret: '',
  google_oauth_enabled: 'false',
};

/** GET /api/admin/oauth-config - 获取第三方登录配置 */
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: OAUTH_KEYS } },
    });

    const config: Record<string, string> = { ...DEFAULTS };
    for (const item of settings) {
      config[item.key] = item.value;
    }

    // 出于安全考虑，client_secret 返回是否已设置而非明文
    return NextResponse.json({
      github_client_id: config.github_client_id,
      github_client_secret_set: config.github_client_secret ? true : false,
      github_oauth_enabled: config.github_oauth_enabled === 'true',
      google_client_id: config.google_client_id,
      google_client_secret_set: config.google_client_secret ? true : false,
      google_oauth_enabled: config.google_oauth_enabled === 'true',
    });
  } catch (error) {
    console.error('[OAUTH CONFIG GET ERROR]', error);
    return NextResponse.json({ error: '获取 OAuth 配置失败' }, { status: 500 });
  }
}

/** POST /api/admin/oauth-config - 保存第三方登录配置 */
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const {
      github_client_id,
      github_client_secret,
      github_oauth_enabled,
    } = body;

    // 组织要保存的键值对
    const entries: { key: string; value: string }[] = [];

    if (github_client_id !== undefined) {
      entries.push({ key: 'github_client_id', value: String(github_client_id) });
    }
    // client_secret 为空字符串时表示用户想清除，为 undefined 时表示不修改
    if (github_client_secret !== undefined && github_client_secret !== '') {
      entries.push({ key: 'github_client_secret', value: String(github_client_secret) });
    }
    if (github_oauth_enabled !== undefined) {
      entries.push({ key: 'github_oauth_enabled', value: String(github_oauth_enabled) });
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: '没有需要更新的配置' }, { status: 400 });
    }

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
    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'update_oauth_config',
        target: 'SystemSetting',
        detail: `更新第三方登录配置: ${changedKeys}`,
      },
    });

    return NextResponse.json({ message: 'OAuth 配置已保存' });
  } catch (error) {
    console.error('[OAUTH CONFIG POST ERROR]', error);
    return NextResponse.json({ error: '保存 OAuth 配置失败' }, { status: 500 });
  }
}

/** DELETE /api/admin/oauth-config - 清除 OAuth 凭据 */
export async function DELETE(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider'); // github | google

    if (!provider) {
      return NextResponse.json({ error: '需要指定 provider 参数' }, { status: 400 });
    }

    const secretKey = `${provider}_client_secret`;
    const idKey = `${provider}_client_id`;
    const enabledKey = `${provider}_oauth_enabled`;

    await prisma.systemSetting.deleteMany({
      where: { key: { in: [secretKey, idKey, enabledKey] } },
    });

    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'delete_oauth_config',
        target: 'SystemSetting',
        detail: `清除 ${provider} OAuth 配置`,
      },
    });

    return NextResponse.json({ message: `${provider} OAuth 配置已清除` });
  } catch (error) {
    console.error('[OAUTH CONFIG DELETE ERROR]', error);
    return NextResponse.json({ error: '清除 OAuth 配置失败' }, { status: 500 });
  }
}
