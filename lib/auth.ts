import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET;

// 生产环境必须配置 JWT_SECRET，否则启动时报错
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: JWT_SECRET 环境变量未配置。请在 Vercel 项目设置中添加 JWT_SECRET。' +
      '可使用命令生成: openssl rand -base64 32'
    );
  }
  // 开发环境使用回退值并警告
  console.warn(
    'WARNING: JWT_SECRET 未配置，正在使用不安全的开发回退值。' +
    '生产环境部署前必须配置 JWT_SECRET 环境变量。'
  );
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-insecure-secret-do-not-use-in-production';

/** Token 载荷类型 */
interface TokenPayload {
  userId: string;
  username: string;
  role: string;
}

/**
 * 密码哈希 - 使用 bcrypt 加密密码
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * 密码比对 - 验证密码是否匹配哈希
 */
export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 生成 JWT 令牌 - 包含用户 id、用户名、角色信息
 */
export function generateToken(user: {
  id: string;
  username: string;
  role: string;
}): string {
  const payload: TokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };
  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, { expiresIn: '7d' });
}

/**
 * 验证 JWT 令牌 - 返回解密后的载荷
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, EFFECTIVE_JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * 从请求中提取用户信息
 * 优先从 Authorization header 中解析 Bearer token，
 * 若 header 中不存在则回退到 httpOnly cookie 中的 token（用于 GitHub OAuth 登录后首次请求）
 */
export function getUserFromRequest(
  request: NextRequest,
): TokenPayload | null {
  // 1. 优先从 Authorization header 读取
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) return payload;
  }

  // 2. 回退：从 cookie 读取（GitHub OAuth 设置的 httpOnly cookie）
  const cookieToken = request.cookies.get('token')?.value;
  if (cookieToken) {
    return verifyToken(cookieToken);
  }

  return null;
}

/**
 * 从请求中提取原始 token 字符串
 * 用于需要将 token 返回给客户端的场景（如 OAuth 桥接）
 */
export function getTokenFromRequest(
  request: NextRequest,
): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return request.cookies.get('token')?.value || null;
}

/**
 * 管理员鉴权中间件
 * 验证请求中的用户是否为管理员，若不是则返回未授权响应
 */
export function adminAuth(request: NextRequest): TokenPayload | Response {
  const user = getUserFromRequest(request);

  if (!user) {
    return Response.json({ error: '未登录，请先登录' }, { status: 401 });
  }

  if (user.role !== 'ADMIN') {
    return Response.json({ error: '权限不足，需要管理员权限' }, { status: 403 });
  }

  return user;
}
