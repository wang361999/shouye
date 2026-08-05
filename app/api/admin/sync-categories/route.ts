import { NextResponse } from 'next/server';
import { getDb, queryWithTimeout } from '@/lib/db';
import { checkDbOr503 } from '@/lib/db-check';
import { getUserFromRequest } from '@/lib/auth';
import { NextRequest } from 'next/server';

/**
 * POST /api/admin/sync-categories
 *
 * 同步默认分类（upsert 模式）
 * 部署后手动调用一次，确保 AI 等新分类被创建。
 * 需要管理员权限（支持 JWT Bearer token 或 X-Admin-Token header）。
 */
export async function POST(request: NextRequest) {
  const dbError = checkDbOr503();
  if (dbError) return dbError;

  // 鉴权方式一：JWT Bearer token（管理员登录后可用）
  const user = getUserFromRequest(request);
  const isAdmin = user?.role === 'ADMIN';

  // 鉴权方式二：X-Admin-Token header（用环境变量中的 ADMIN_TOKEN 或 ADMIN_PASSWORD）
  const adminToken = request.headers.get('X-Admin-Token');
  const expectedToken = process.env.ADMIN_TOKEN || process.env.ADMIN_PASSWORD;
  const isTokenValid = adminToken && expectedToken && adminToken === expectedToken;

  if (!isAdmin && !isTokenValid) {
    return NextResponse.json({ error: '未授权，需要管理员权限' }, { status: 401 });
  }

  let db;
  try {
    db = getDb();
  } catch {
    return NextResponse.json({ error: '数据库连接失败' }, { status: 503 });
  }

  const categories = [
    { name: '公告', slug: 'announcement', icon: '📢', desc: '官方公告与重要通知', sortOrder: 1 },
    { name: '反馈建议', slug: 'feedback', icon: '💬', desc: '产品反馈与功能建议', sortOrder: 2 },
    { name: '使用教程', slug: 'tutorial', icon: '📖', desc: '工具使用教程与经验分享', sortOrder: 3 },
    { name: '闲聊', slug: 'chat', icon: '🗣️', desc: '开发者日常闲聊', sortOrder: 4 },
    { name: '开源项目', slug: 'open-source', icon: '📦', desc: '开源项目推荐、协议分析与社区趋势', sortOrder: 5 },
    { name: 'AI 工具', slug: 'ai-tools', icon: '🤖', desc: 'AI 工具推荐、评测与使用技巧', sortOrder: 6 },
    { name: '大模型', slug: 'llm', icon: '🧠', desc: '大语言模型技术、应用与微调实践', sortOrder: 7 },
    { name: 'Agent 开发', slug: 'ai-agent', icon: '⚡', desc: 'AI Agent 架构、框架与开发实践', sortOrder: 8 },
    { name: 'Prompt 工程', slug: 'prompt', icon: '✍️', desc: 'Prompt 设计技巧、模板与最佳实践', sortOrder: 9 },
    { name: '前端开发', slug: 'frontend', icon: '🎨', desc: '前端框架、CSS与性能优化', sortOrder: 10 },
    { name: '后端开发', slug: 'backend', icon: '⚙️', desc: '后端架构、数据库与API设计', sortOrder: 11 },
  ];

  const results = [];

  for (const cat of categories) {
    try {
      // 先查找是否存在
      const existing = (await queryWithTimeout(
        db,
        `SELECT id FROM Category WHERE slug = ?`,
        [cat.slug],
        5000,
      )) as Record<string, unknown>[];

      if (existing && existing.length > 0) {
        // 更新
        await queryWithTimeout(
          db,
          `UPDATE Category SET name = ?, icon = ?, "desc" = ?, sort_order = ? WHERE slug = ?`,
          [cat.name, cat.icon, cat.desc, cat.sortOrder, cat.slug],
          5000,
        );
        results.push({ slug: cat.slug, name: cat.name, action: 'updated' });
      } else {
        // 插入（使用 cuid 风格的随机 ID）
        const newId = 'c' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        await queryWithTimeout(
          db,
          `INSERT INTO Category (id, name, slug, icon, "desc", sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newId, cat.name, cat.slug, cat.icon, cat.desc, cat.sortOrder],
          5000,
        );
        results.push({ slug: cat.slug, name: cat.name, action: 'created' });
      }
    } catch (err) {
      results.push({ slug: cat.slug, name: cat.name, action: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }

  const created = results.filter(r => r.action === 'created').length;
  const updated = results.filter(r => r.action === 'updated').length;
  const errors = results.filter(r => r.action === 'error').length;

  return NextResponse.json({
    success: true,
    summary: `创建 ${created} 个，更新 ${updated} 个，失败 ${errors} 个`,
    results,
  });
}
