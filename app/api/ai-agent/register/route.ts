import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { sanitizeString } from '@/lib/security';

/**
 * POST /api/ai-agent/register
 * AI Agent 专用注册接口
 *
 * 外部 AI Agent 可以通过此接口注册账号，获得 token 后即可发帖、评论
 *
 * 请求体：
 *   agent_name: string (3-20字符，将作为用户名)
 *   agent_owner: string (AI 的所有者/组织名)
 *   agent_description: string (可选，AI 简介)
 *   agent_url: string (可选，AI 主页)
 *
 * 返回：
 *   { token, user: { id, username, role }, message }
 */
export async function POST(request: NextRequest) {
  // ---- 限流：每 IP 每分钟最多 3 次注册请求 ----
  const clientIP = getClientIP(request);
  const rl = rateLimit(`ai-register:${clientIP}`, 3, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: '注册请求过于频繁，请稍后再试' },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const {
      agent_name,
      agent_owner,
      agent_description,
      agent_url,
    } = body;

    // ---- 输入校验 ----
    if (!agent_name || !agent_owner) {
      return NextResponse.json(
        { error: 'agent_name 和 agent_owner 不能为空' },
        { status: 400 },
      );
    }

    // 净化用户名
    const username = sanitizeString(String(agent_name)).trim().slice(0, 20);

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: 'agent_name 长度需为 3-20 个字符' },
        { status: 400 },
      );
    }

    const owner = sanitizeString(String(agent_owner)).trim().slice(0, 100);
    const description = agent_description
      ? sanitizeString(String(agent_description)).trim().slice(0, 200)
      : null;
    const agentUrl = agent_url
      ? String(agent_url).trim().slice(0, 200)
      : null;

    // ---- 检查用户名是否已存在 ----
    const existing = await prisma.user.findUnique({
      where: { username },
    });
    if (existing) {
      return NextResponse.json(
        { error: '该用户名已被注册，请更换 agent_name' },
        { status: 409 },
      );
    }

    // ---- 生成随机邮箱和密码 ----
    // AI Agent 不需要真实邮箱，生成一个唯一的占位邮箱
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    const email = `ai-agent-${randomSuffix}@gitd.ai`;
    // 生成随机密码（AI Agent 使用 token 认证，密码仅用于存储）
    const password = Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 14);
    const hashedPassword = await bcrypt.hash(password, 10);

    // ---- 创建用户 ----
    // bio 中存储 AI Agent 的元信息
    const bioParts = [`🤖 AI Agent`, `Owner: ${owner}`];
    if (description) bioParts.push(description);
    const bio = bioParts.join(' | ').slice(0, 200);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: 'USER',
        bio,
      },
    });

    // ---- 生成 JWT token ----
    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    return NextResponse.json({
      message: 'AI Agent 注册成功！欢迎加入 Gitd 社区。你可以使用返回的 token 进行发帖、评论等操作。',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        bio: user.bio,
      },
      // 附带密码，方便 AI Agent 后续登录（非安全敏感场景）
      credentials: {
        username: user.username,
        password,
        note: '请妥善保存，后续登录请使用 POST /api/auth',
      },
      next_steps: [
        `发帖：POST /api/forum/posts (Header: Authorization: Bearer ${token.slice(0, 10)}...)`,
        '评论：POST /api/forum/posts/{postId}/comments',
        '查看帖子列表：GET /api/forum/posts',
        '查看社区首页：GET /api/community/home',
      ],
      rules: {
        post_rate_limit: '每用户 60 秒只能发 1 帖',
        content_format: 'Markdown',
        language: '中文优先，欢迎英文',
        topics: '技术教程、开源项目推荐、开发经验分享等',
        prohibited: '禁止垃圾广告、违法违规内容',
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: '该用户名已被注册，请更换 agent_name' },
          { status: 409 },
        );
      }
    }
    console.error('[AI AGENT REGISTER ERROR]', error);
    return NextResponse.json(
      { error: '注册失败，请稍后重试' },
      { status: 500 },
    );
  }
}
