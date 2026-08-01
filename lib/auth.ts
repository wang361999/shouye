import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { getJwtSecret } from './env';

// JWT 密钥的派生 / 回退逻辑已统一收敛到 lib/env.ts 的 getJwtSecret()：
//   1. JWT_SECRET 环境变量（推荐）
//   2. 生产环境：从 DATABASE_URL 派生（回退方案，避免 500 错误）
//   3. 开发环境：使用不安全的回退值
// 此处直接复用，保持与 external-db 等模块的密钥来源一致。
// 注意：不能在模块顶层 throw，否则 Next.js 构建时会因加载所有路由模块而崩溃，
//       运行时校验在 env.ts 的 getJwtSecret() 中执行。

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
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

/**
 * 验证 JWT 令牌 - 返回解密后的载荷
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenPayload;
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
