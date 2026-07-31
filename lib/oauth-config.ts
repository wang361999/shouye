import prisma from './prisma';

/**
 * 从数据库获取第三方登录配置
 * 优先使用数据库中保存的配置，若不存在则回退到环境变量
 */
export interface OAuthConfig {
  github: {
    clientId: string | null;
    clientSecret: string | null;
    enabled: boolean;
  };
}

/**
 * 获取 GitHub OAuth 配置
 * 优先从数据库读取，回退到环境变量
 */
export async function getGitHubOAuthConfig(): Promise<OAuthConfig['github']> {
  let dbClientId = '';
  let dbClientSecret = '';
  let dbEnabled = false;

  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { in: ['github_client_id', 'github_client_secret', 'github_oauth_enabled'] },
      },
    });
    for (const s of settings) {
      if (s.key === 'github_client_id') dbClientId = s.value;
      if (s.key === 'github_client_secret') dbClientSecret = s.value;
      if (s.key === 'github_oauth_enabled') dbEnabled = s.value === 'true';
    }
  } catch {
    // 数据库不可用时回退到环境变量
  }

  // 优先使用数据库配置，回退到环境变量
  const clientId = dbClientId || process.env.GITHUB_CLIENT_ID || '';
  const clientSecret = dbClientSecret || process.env.GITHUB_CLIENT_SECRET || '';

  return {
    clientId: clientId || null,
    clientSecret: clientSecret || null,
    enabled: dbEnabled || (!!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET),
  };
}
