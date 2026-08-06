import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/auth';
import { getFileTree, readFile, listDir, type FileChange } from '@/lib/github-file-api';

/**
 * POST /api/coder/chat
 *
 * AI 编程助手聊天接口
 * 使用 GLM-5.2 模型，通过 agentic loop 自动读取文件、分析代码、提出修改方案
 *
 * 请求体：
 *   { messages: [{role: 'user'|'assistant', content: string}] }
 *
 * 返回：
 *   { reply: string, changes: FileChange[] }
 */

const GLM_API_KEY = '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';
const GLM_API_BASE = 'https://integrate.api.nvidia.com/v1/chat/completions';
const GLM_MODEL = 'z-ai/glm-5.2';

const MAX_ITERATIONS = 8;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIAction {
  type: 'read' | 'list' | 'write' | 'create' | 'delete';
  path: string;
  content?: string;
}

interface AIResponse {
  message: string;
  actions?: AIAction[];
}

/**
 * 调用 GLM-5.2
 */
async function callGLM(messages: ChatMessage[], maxTokens = 16384): Promise<string> {
  const response = await fetch(GLM_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: GLM_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`GLM API ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('GLM 返回内容为空');
  }
  return content;
}

/**
 * 解析 AI 响应（支持 JSON 和非 JSON 格式）
 */
function parseAIResponse(raw: string): AIResponse {
  // 尝试直接解析 JSON
  try {
    const parsed = JSON.parse(raw);
    if (parsed.message) {
      return {
        message: String(parsed.message),
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      };
    }
  } catch {
    // 不是纯 JSON，继续尝试
  }

  // 尝试提取 JSON 块
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.message) {
        return {
          message: String(parsed.message),
          actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        };
      }
    } catch {
      // JSON 解析失败
    }
  }

  // 非 JSON 格式，直接作为消息返回
  return { message: raw.trim(), actions: [] };
}

/**
 * 构建系统提示词
 */
async function buildSystemPrompt(): Promise<string> {
  let fileTree = '';
  try {
    fileTree = await getFileTree();
  } catch {
    fileTree = '(无法获取文件树)';
  }

  return `你是一个专业的 AI 编程助手，正在帮助用户修改他们的 Next.js 网站。

你的能力：
1. 读取项目文件 — 使用 read 动作
2. 浏览目录 — 使用 list 动作
3. 创建新文件 — 使用 create 动作
4. 修改文件 — 使用 write 动作
5. 删除文件 — 使用 delete 动作

工作流程：
1. 先理解用户的需求
2. 如果需要，用 read/list 动作读取相关文件，了解现有代码结构
3. 分析代码后，提出修改方案
4. 用 write/create/delete 动作返回具体的文件修改
5. write 动作必须包含完整的文件内容（不是 diff）

响应格式 — 必须返回严格 JSON：
\`\`\`json
{
  "message": "你的回复（支持 Markdown 格式，可以包含代码说明）",
  "actions": [
    { "type": "read", "path": "app/page.tsx" },
    { "type": "list", "path": "app/components" },
    { "type": "write", "path": "app/page.tsx", "content": "完整文件内容" },
    { "type": "create", "path": "app/new-file.tsx", "content": "文件内容" },
    { "type": "delete", "path": "app/old-file.tsx" }
  ]
\`\`\`

规则：
- 一次可以返回多个动作
- 如果需要先看文件内容，返回 read/list 动作，系统会执行后把结果反馈给你
- 当你准备好修改代码时，返回 write/create/delete 动作
- write 动作的 content 必须是完整的文件内容，不是 patch 或 diff
- 路径使用相对路径，相对于项目根目录（如 app/page.tsx）
- 不要读取不必要的大文件（如 package-lock.json）
- 修改文件前一定要先读取确认现有内容
- 代码注释用中文

项目文件结构：
${fileTree}`;
}

export async function POST(request: NextRequest) {
  // 管理员鉴权
  const authResult = adminAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const body = await request.json();
    const { messages }: { messages: ChatMessage[] } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '缺少消息内容' }, { status: 400 });
    }

    // 构建系统提示词
    const systemPrompt = await buildSystemPrompt();

    // 初始化对话
    const conversation: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const proposedChanges: FileChange[] = [];
    const readLogs: string[] = [];

    // Agentic loop
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      console.log(`[CODER] Agentic loop iteration ${i + 1}/${MAX_ITERATIONS}`);

      const rawResponse = await callGLM(conversation);
      const parsed = parseAIResponse(rawResponse);

      // 将 AI 响应加入对话
      conversation.push({ role: 'assistant', content: rawResponse });

      const actions = parsed.actions || [];
      const readActions = actions.filter((a) => a.type === 'read' || a.type === 'list');
      const writeActions = actions.filter((a) => a.type === 'write' || a.type === 'create' || a.type === 'delete');

      // 收集文件变更
      for (const action of writeActions) {
        proposedChanges.push({
          type: action.type as 'create' | 'write' | 'delete',
          path: action.path,
          content: action.content,
        });
      }

      // 如果没有读取动作，说明 AI 已完成分析，返回结果
      if (readActions.length === 0) {
        return NextResponse.json({
          reply: parsed.message,
          changes: proposedChanges,
          readLogs,
        });
      }

      // 执行读取动作，将结果反馈给 AI
      const readResults: string[] = [];
      for (const action of readActions) {
        try {
          if (action.type === 'read') {
            const result = await readFile(action.path);
            if (result.content.startsWith('__DIRECTORY__')) {
              readLogs.push(`📁 ${action.path} 是目录，不是文件`);
              readResults.push(`[读取目录 ${action.path}]\n这是一个目录，请用 list 动作来查看内容。`);
            } else {
              const preview = result.content.length > 8000
                ? result.content.slice(0, 8000) + '\n... (内容过长，已截断)'
                : result.content;
              readLogs.push(`📄 读取 ${action.path} (${result.content.length} 字符)`);
              readResults.push(`[文件内容 ${action.path}]\n\`\`\`\n${preview}\n\`\`\``);
            }
          } else if (action.type === 'list') {
            const items = await listDir(action.path);
            const listing = items
              .map((item) => `${item.type === 'dir' ? '📁' : '📄'} ${item.name}`)
              .join('\n');
            readLogs.push(`📁 列出目录 ${action.path} (${items.length} 项)`);
            readResults.push(`[目录列表 ${action.path}]\n${listing}`);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          readLogs.push(`❌ 读取 ${action.path} 失败: ${errMsg}`);
          readResults.push(`[错误] 读取 ${action.path} 失败: ${errMsg}`);
        }
      }

      // 将读取结果作为用户消息反馈给 AI
      conversation.push({
        role: 'user',
        content: `以下是文件读取结果：\n\n${readResults.join('\n\n')}\n\n请基于以上信息继续分析，如果需要读取更多文件请继续返回 read/list 动作，如果已经准备好修改代码请返回 write/create/delete 动作。`,
      });
    }

    // 达到最大迭代次数
    return NextResponse.json({
      reply: proposedChanges.length > 0
        ? `${parsed_Message(conversation)}\n\n(已达到最大分析次数，共提出 ${proposedChanges.length} 个文件变更)`
        : '分析超时，请尝试缩小问题范围或提供更具体的需求。',
      changes: proposedChanges,
      readLogs,
    });
  } catch (error) {
    console.error('[CODER CHAT ERROR]', error);
    return NextResponse.json(
      {
        error: 'AI 助手出错',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// 辅助函数：从对话中提取最后的 AI 消息
function parsed_Message(conversation: ChatMessage[]): string {
  for (let i = conversation.length - 1; i >= 0; i--) {
    if (conversation[i].role === 'assistant') {
      const parsed = parseAIResponse(conversation[i].content);
      return parsed.message;
    }
  }
  return '分析完成';
}
