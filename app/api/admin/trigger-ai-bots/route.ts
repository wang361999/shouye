import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * POST /api/admin/trigger-ai-bots
 *
 * 触发 AI 机器人发帖（在 Vercel 服务端运行，直接使用环境变量中的 AI 配置）
 * 需要管理员权限。
 *
 * 参数：
 *   - bots: 可选，指定要运行的机器人 key 数组，如 ["ai-tools", "llm"]
 *   - dryRun: 可选，是否只预览不发布
 */

const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_API_BASE = process.env.AI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const AI_MODEL = process.env.AI_MODEL || 'gemini-3.6-flash';

// ===== 四个 AI 分类机器人配置 =====
const BOTS = [
  {
    key: 'ai-tools',
    authorName: 'AI工具探索者',
    categorySlug: 'ai-tools',
    tagline: 'AI 工具推荐、评测与使用技巧',
    promptHint: 'AI 工具实战：推荐一款实用的 AI 工具，或分享 AI 工具的使用技巧、效率提升方法，包含工具介绍、核心功能、使用场景、使用教程和选型建议',
    discussionQuestion: '你用过哪些好用的 AI 工具？欢迎在评论区分享你的使用体验和效率提升技巧。',
    defaultTags: ['AI工具', '效率工具'],
    topics: [
      '2026 年值得收藏的 10 个 AI 编程助手对比',
      'Cursor vs Windsurf：AI IDE 深度评测与选型建议',
      '用 AI 做 PPT：Gamma、Motions、Beautiful.ai 横评',
      'AI 笔记工具横评：NotebookLM、Mem、Reflect 该选谁',
      '免费 AI 图像生成工具大盘点：Midjourney 平替推荐',
      'AI 视频生成工具实测：可灵、即梦、Runway 对比',
      '用 AI 提升写作效率：从构思到成稿的完整工作流',
      'AI 翻译工具深度对比：DeepL、GPT-4o、Gemini 谁更准',
      'AI 思维导图工具推荐：让想法结构化的 5 款神器',
      'AI 代码审查工具实战：如何让 AI 帮你发现 Bug',
      '零基础也能用的 AI 音频处理工具推荐',
      'AI 表格工具对比：ChatExcel、TableGPT、Dify 怎么选',
      '用 AI 做 SEO：关键词研究到内容优化的全流程',
      'AI 浏览器扩展推荐：10 款提升浏览效率的神器',
      'AI 会议纪要工具横评：让每一场会议都有高质量产出',
    ],
  },
  {
    key: 'llm',
    authorName: '大模型研究员',
    categorySlug: 'llm',
    tagline: '大语言模型技术、应用与微调实践',
    promptHint: '大模型技术分享：深入讲解大语言模型的技术原理、应用方法、微调实践、性能优化或行业落地案例，包含原理讲解、实践步骤、效果评估和注意事项',
    discussionQuestion: '你最近在研究哪些大模型技术？欢迎在评论区交流你的学习心得和实践经验。',
    defaultTags: ['大模型', 'LLM'],
    topics: [
      '大模型推理优化：从 KV Cache 到 Speculative Decoding',
      'RAG 实战指南：如何搭建一个高质量的企业知识库问答系统',
      '向量数据库选型：Pinecone、Milvus、Chroma 对比',
      '大模型微调入门：LoRA、QLoRA、全参数微调该怎么选',
      'Prompt Engineering 进阶：Chain of Thought 与 Tree of Thought',
      '大模型 Agent 原理与实现：从 ReAct 到 Plan-and-Execute',
      '多模态大模型技术解析：图文理解的原理与应用',
      '大模型量化技术：4-bit、8-bit 量化原理与工具推荐',
      'RAG 优化技巧：如何提升检索增强生成的准确率',
      '开源大模型对比：Llama、Qwen、DeepSeek 各有什么特点',
      '函数调用（Function Calling）原理与最佳实践',
      '大模型上下文窗口扩展技术：从 RoPE 到 YaRN',
      '嵌入模型（Embedding）选型指南：如何选择最合适的向量模型',
      '大模型安全与对齐：RLHF、DPO、PPO 原理对比',
      '端侧大模型部署：手机和 PC 本地运行大模型指南',
    ],
  },
  {
    key: 'ai-agent',
    authorName: 'Agent架构师',
    categorySlug: 'ai-agent',
    tagline: 'AI Agent 架构、框架与开发实践',
    promptHint: 'AI Agent 开发实战：分享 AI Agent 的架构设计、框架使用、开发教程、调试技巧或生产落地经验，包含架构图、代码示例、部署方法和踩坑记录',
    discussionQuestion: '你在做 AI Agent 开发吗？欢迎在评论区分享你的项目经验和技术疑问。',
    defaultTags: ['AIAgent', '智能体'],
    topics: [
      'AI Agent 框架对比：LangChain、AutoGen、CrewAI 怎么选',
      '从零搭建一个 AI Agent：核心组件与实现步骤',
      'AI Agent 记忆系统设计：短期记忆与长期记忆',
      '多 Agent 协作模式：让多个 AI 智能体协同工作',
      'AI Agent 工具调用原理与实现：从 Tool Use 到 MCP',
      'AI Agent 评测方法：如何评估智能体的能力',
      '生产级 AI Agent 架构设计：稳定性、可观测性与容错',
      '用 Dify 搭建 AI Agent：低代码智能体开发实战',
      'AI Agent 规划能力：从 Task Decomposition 到 Hierarchical Planning',
      'AI Agent 中的人类反馈（HITL）：何时需要人工介入',
      'MCP 协议详解：让 AI Agent 连接世界的标准',
      'AI Agent 调试技巧：如何快速定位智能体的问题',
      'AI Agent 成本优化：如何降低智能体运行成本',
      'AI Agent 安全机制：防止智能体执行危险操作',
      '工作流型 Agent 实战：把复杂业务流程交给 AI',
    ],
  },
  {
    key: 'prompt',
    authorName: 'Prompt工程师',
    categorySlug: 'prompt',
    tagline: 'Prompt 设计技巧、模板与最佳实践',
    promptHint: 'Prompt 工程技巧：分享实用的 Prompt 设计方法、模板、技巧、案例或避坑指南，包含模板示例、使用场景、效果对比和调优方法',
    discussionQuestion: '你有什么好用的 Prompt 技巧？欢迎在评论区分享你的独家模板和使用心得。',
    defaultTags: ['Prompt', '提示词'],
    topics: [
      '万能 Prompt 框架：CRISPE 公式详解与实战案例',
      'Few-shot vs Zero-shot：什么时候给示例效果更好',
      '角色设定技巧：如何让 AI 更专业地扮演某个角色',
      '结构化输出 Prompt：让 AI 稳定返回 JSON/Markdown 格式',
      '长文本处理 Prompt：摘要、提取与分类技巧',
      '翻译 Prompt 优化：如何让 AI 翻译更地道、更准确',
      '代码生成 Prompt 技巧：写出高质量代码的提示词方法',
      '思维链（CoT）Prompt：让 AI 推理能力翻倍的秘密',
      'Prompt 调试技巧：效果不好时从这 5 个方面优化',
      'AI 写作 Prompt 模板：从公众号到技术博客全覆盖',
      '反向 Prompt 工程：从好的输出反推优秀提示词',
      '多轮对话 Prompt 设计：如何保持对话的一致性和质量',
      '图像生成 Prompt 技巧：Midjourney/SD 高级提示词方法',
      'Prompt 版本管理：如何迭代和管理你的提示词库',
      '避坑指南：常见的 Prompt 错误写法与修正方法',
    ],
  },
];

// 调用 AI API
async function callAI(prompt: string, systemPrompt?: string, maxTokens = 4000): Promise<string | null> {
  if (!AI_API_KEY) return null;

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  try {
    const res = await fetch(AI_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.8,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[AI API ERROR]', res.status, text);
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[AI API ERROR]', err);
    return null;
  }
}

// 生成帖子
async function generatePost(bot: typeof BOTS[0]): Promise<{ title: string; content: string; tags: string[]; rawResult?: string } | null> {
  // 随机选一个主题
  const topic = bot.topics[Math.floor(Math.random() * bot.topics.length)];

  const systemPrompt = `你是一位资深的${bot.tagline}作者，正在为开发者技术社区写作。
你的文风：专业但不枯燥，有实战干货，结构清晰，有案例有代码，适合中文开发者阅读。`;

  const prompt = `请围绕以下主题写一篇高质量的技术社区帖子：

【主题】${topic}

【要求】
1. 标题要有吸引力，能引发开发者兴趣，不超过 30 字
2. 正文 1000-1500 字，结构清晰，使用 Markdown 格式
3. 包含：引言、核心内容（分 3-4 个小节）、实践建议、总结
4. 要有实战干货，避免空泛的理论
5. 适当使用代码示例或列表来增强可读性
6. 结尾加上互动引导：${bot.discussionQuestion}
7. 全程中文

【输出格式】
严格使用以下 JSON 格式返回，不要包裹在代码块中，直接输出纯 JSON：
{"title":"帖子标题","content":"帖子正文（完整 Markdown）","tags":["标签1","标签2","标签3","标签4","标签5"]}`;

  const result = await callAI(prompt, systemPrompt, 6000);
  if (!result) return null;

  console.log(`[AI BOTS] AI 返回原始内容长度：${result.length} 字符`);

  // 尝试解析 JSON
  try {
    // 先清理可能的 markdown 代码块标记
    let cleaned = result.trim();
    const jsonBlockMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      cleaned = jsonBlockMatch[1].trim();
    } else {
      // 尝试找第一个 { 和最后一个 } 之间的内容
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
    }
    const parsed = JSON.parse(cleaned);
    if (parsed.title && parsed.content) {
      return {
        title: String(parsed.title),
        content: String(parsed.content),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : bot.defaultTags,
      };
    }
  } catch (e) {
    console.log(`[AI BOTS] JSON 解析失败，尝试从文本提取: ${e instanceof Error ? e.message : String(e)}`);
  }

  // JSON 解析失败，尝试从文本中提取
  const titleMatch = result.match(/标题[：:]\s*([^\n]+)/) || result.match(/"title"\s*:\s*"([^"]+)"/);
  const tagsMatch = result.match(/标签[：:]\s*([^\n]+)/) || result.match(/"tags"\s*:\s*\[([^\]]+)\]/);

  if (titleMatch) {
    const title = titleMatch[1].trim();
    let tags = bot.defaultTags;
    if (tagsMatch) {
      tags = tagsMatch[1]
        .split(/[,，、]/)
        .map(t => t.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
        .slice(0, 5);
      if (tags.length === 0) tags = bot.defaultTags;
    }

    // 正文从标题后开始
    const contentStart = result.indexOf(title) + title.length;
    let content = result.substring(contentStart).trim();
    // 去掉可能的前缀（如 "正文：" 之类）
    content = content.replace(/^[\s\S]{0,50}?(正文|内容)[：:]\s*/, '');
    // 去掉标签后面的内容
    if (tagsMatch && tagsMatch.index !== undefined) {
      const tagEnd = tagsMatch.index + tagsMatch[0].length;
      if (tagEnd < result.length) {
        content = result.substring(contentStart, tagsMatch.index).trim();
      }
    }

    if (content.length > 100) {
      return { title, content, tags, rawResult: result };
    }
  }

  // 完全提取失败，返回原始内容供调试
  return null;
}

export async function POST(request: NextRequest) {
  const authResult = adminAuth(request);
  if ('error' in authResult) {
    return NextResponse.json({ error: (authResult as { error: string }).error }, { status: 401 });
  }

  if (!AI_API_KEY) {
    return NextResponse.json({ error: 'AI_API_KEY 未配置，请先在环境变量中设置 AI API 密钥' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { bots: selectedBots, dryRun = false } = body;

    const botsToRun = selectedBots && Array.isArray(selectedBots)
      ? BOTS.filter(b => selectedBots.includes(b.key))
      : BOTS;

    if (botsToRun.length === 0) {
      return NextResponse.json({ error: '没有找到匹配的机器人' }, { status: 400 });
    }

    const results = [];

    for (const bot of botsToRun) {
      console.log(`[AI BOTS] 正在运行机器人：${bot.authorName}`);

      try {
        const generated = await generatePost(bot);
        if (!generated) {
          results.push({ bot: bot.key, name: bot.authorName, status: 'error', error: 'AI 生成失败或内容格式无法解析' });
          continue;
        }

        if (dryRun) {
          results.push({
            bot: bot.key,
            name: bot.authorName,
            status: 'preview',
            title: generated.title,
            tags: generated.tags,
            contentPreview: generated.content.slice(0, 200) + '...',
          });
          continue;
        }

        // 查找分类
        const category = await prisma.category.findUnique({
          where: { slug: bot.categorySlug },
        });

        if (!category) {
          results.push({ bot: bot.key, name: bot.authorName, status: 'error', error: `分类 ${bot.categorySlug} 不存在` });
          continue;
        }

        // 查找或创建 AI Agent 用户
        const agentEmail = `ai-agent-${bot.key}@gitd.ai`;
        let author = await prisma.user.findUnique({
          where: { email: agentEmail },
        });

        if (!author) {
          // 为每个机器人生成对应的用户名（基于 authorName 的拼音/英文简化版）
          const usernameMap: Record<string, string> = {
            'ai-tools': 'ai_tools_explorer',
            'llm': 'llm_researcher',
            'ai-agent': 'agent_architect',
            'prompt': 'prompt_engineer',
          };
          const avatarMap: Record<string, string> = {
            'ai-tools': '🤖',
            'llm': '🧠',
            'ai-agent': '⚡',
            'prompt': '✍️',
          };

          const username = usernameMap[bot.key] || `ai_${bot.key.replace(/-/g, '_')}`;
          const avatar = avatarMap[bot.key] || '🤖';
          const bio = `🤖 AI Agent | Owner: Gitd Community | ${bot.tagline}`;

          try {
            author = await prisma.user.create({
              data: {
                username,
                email: agentEmail,
                password: 'ai-agent-no-login-' + Math.random().toString(36).slice(2),
                avatar,
                bio,
                role: 'USER',
                status: 'active',
              },
            });
            console.log(`[AI BOTS] 创建 AI Agent 用户: ${username} (${bot.authorName})`);
          } catch (createErr) {
            console.error(`[AI BOTS] 创建 AI Agent 用户失败:`, createErr);
            // 创建失败则 fallback 到管理员账号
            author = await prisma.user.findFirst({
              where: { role: 'ADMIN' },
            });
          }
        }

        if (!author) {
          results.push({ bot: bot.key, name: bot.authorName, status: 'error', error: '找不到发布用户' });
          continue;
        }

        // 创建帖子
        const post = await prisma.post.create({
          data: {
            title: generated.title,
            content: generated.content,
            categoryId: category.id,
            authorId: author.id,
            authorName: bot.authorName,
            status: 'PUBLISHED',
          },
        });

        // 处理标签
        const tagNames = generated.tags.slice(0, 5);
        for (const tagName of tagNames) {
          try {
            const tag = await prisma.tag.upsert({
              where: { name: tagName },
              create: { name: tagName, slug: tagName.toLowerCase().replace(/\s+/g, '-') },
              update: {},
            });
            await prisma.postTag.create({
              data: { postId: post.id, tagId: tag.id },
            });
            // 增加标签计数
            await prisma.tag.update({
              where: { id: tag.id },
              data: { postCount: { increment: 1 } },
            });
          } catch {
            // 忽略标签错误
          }
        }

        results.push({
          bot: bot.key,
          name: bot.authorName,
          status: 'published',
          postId: post.id,
          title: generated.title,
          tags: generated.tags,
        });

        console.log(`[AI BOTS] 发布成功：${generated.title}`);
      } catch (err) {
        console.error(`[AI BOTS] 机器人 ${bot.key} 失败：`, err);
        results.push({
          bot: bot.key,
          name: bot.authorName,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const success = results.filter(r => r.status === 'published').length;
    const failed = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      summary: `发布成功 ${success} 篇，失败 ${failed} 篇`,
      results,
    });
  } catch (err) {
    console.error('[TRIGGER AI BOTS ERROR]', err);
    return NextResponse.json(
      { error: '触发失败：' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
