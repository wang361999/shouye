import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/auth';
import { getFileTree, readFile, listDir, type FileChange, type RepoContext } from '@/lib/github-file-api';
import { getEnabledModels, type AIModelConfig } from '@/lib/ai';

// ============ 路由配置 ============
// 设置最大执行时间为 300 秒（5 分钟），覆盖 Vercel 默认限制
// 注意：Vercel Hobby 计划上限为 60 秒，Pro 计划上限为 300 秒
export const maxDuration = 300;
// 禁止静态生成，确保路由始终在服务端运行
export const dynamic = 'force-dynamic';

/**
 * POST /api/coder/chat
 *
 * AI 编程助手聊天接口（流式版本）
 * 使用后台配置的主力 AI 模型，通过 agentic loop 自动读取文件、分析代码、提出修改方案
 * 使用 SSE (Server-Sent Events) 流式返回，用户可实时看到 AI 的回复
 *
 * 支持两种模式：
 *   - chat: 纯聊天模式，AI 只回答问题，不执行文件操作
 *   - code: 编程模式（默认），AI 自动读取文件、分析代码、提出修改方案
 *
 * 事件类型：
 *   token   — AI 回复的文本片段（实时）
 *   read    — AI 正在读取文件
 *   changes — 文件变更列表
 *   done    — 完成
 *   error   — 出错
 */

// 编程模式最大迭代次数（每轮可以读多个文件）
const MAX_ITERATIONS_CODE = 10;
// 聊天模式不进入 agentic loop，只做一次 AI 调用
const MAX_ITERATIONS_CHAT = 1;

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
  actions: AIAction[];
}

// ============ 文件树缓存（5分钟TTL） ============
let fileTreeCache: { tree: string; repo: string; expiry: number } | null = null;
const FILE_TREE_CACHE_TTL = 5 * 60 * 1000;

async function getCachedFileTree(ctx?: Partial<RepoContext>): Promise<string> {
  const repo = ctx?.repo || 'default';
  const now = Date.now();
  if (fileTreeCache && fileTreeCache.repo === repo && now < fileTreeCache.expiry) {
    return fileTreeCache.tree;
  }
  const tree = await getFileTree(ctx);
  // 限制文件树长度，避免占用过多 token
  const lines = tree.split('\n');
  const trimmed =
    lines.length > 200
      ? lines.slice(0, 200).join('\n') + `\n... (还有 ${lines.length - 200} 个文件未显示)`
      : tree;
  fileTreeCache = { tree: trimmed, repo, expiry: now + FILE_TREE_CACHE_TTL };
  return trimmed;
}

// ============ AI 流式调用（带重试 + 模型降级） ============
/**
 * 调用 AI 模型并以 async generator 形式逐 token 返回
 * 按后台配置的优先级依次尝试启用的模型，某个失败后自动降级到下一个
 */
async function* callAIStream(messages: ChatMessage[]): AsyncGenerator<string> {
  const enabledModels = await getEnabledModels();
  if (enabledModels.length === 0) {
    throw new Error('没有可用的 AI 模型，请在后台启用至少一个模型');
  }

  const MAX_RETRIES = 2;
  const errors: string[] = [];

  for (const modelConfig of enabledModels) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(modelConfig.apiBase, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${modelConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: modelConfig.model,
            messages,
            max_tokens: 8192,
            temperature: 0.3,
            stream: true,
          }),
          signal: AbortSignal.timeout(180_000), // 3分钟超时
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`AI API ${response.status}: ${text.slice(0, 300)}`);
        }

        if (!response.body) throw new Error('AI 返回空响应体');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let receivedAny = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const content = parsed?.choices?.[0]?.delta?.content;
              if (content) {
                receivedAny = true;
                yield content;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }

        // 正常结束
        if (modelConfig !== enabledModels[0]) {
          console.log(`[CODER] 主模型不可用，已降级到 ${modelConfig.name}`);
        }
        return;
      } catch (err) {
        const isTimeout = err instanceof Error && (
          err.name === 'TimeoutError' ||
          err.message.includes('timeout') ||
          err.message.includes('aborted')
        );

        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`${modelConfig.name}: ${errMsg}`);

        if (attempt < MAX_RETRIES) {
          console.log(`[CODER] ${modelConfig.name} 调用失败 (第${attempt + 1}次)，${isTimeout ? '超时' : '错误'}，${2 - attempt}秒后重试...`);
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }

        // 当前模型全部重试失败，尝试下一个模型
        console.warn(`[CODER] ${modelConfig.name} 全部重试失败，尝试下一个模型...`);
        break;
      }
    }
  }

  // 所有模型都失败
  throw new Error(`AI 服务全部不可用。${errors.join('; ')}`);
}

// ============ AI 响应解析 ============
/**
 * 解析 AI 响应：支持 Markdown + JSON 代码块格式，也兼容纯 JSON
 */
function parseAIResponse(raw: string): AIResponse {
  // 方式1：提取 ```json 代码块
  const jsonBlockMatch = raw.match(/```json\s*\n([\s\S]*?)\n```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1]);
      const message = raw.slice(0, jsonBlockMatch.index).trim();
      return {
        message: message || '好的，我来帮你处理。',
        actions: Array.isArray(parsed.actions)
          ? parsed.actions
          : Array.isArray(parsed)
            ? parsed
            : [],
      };
    } catch {
      // JSON 解析失败，继续尝试
    }
  }

  // 方式2：兼容旧格式 — 纯 JSON
  try {
    const parsed = JSON.parse(raw);
    if (parsed.message) {
      return {
        message: String(parsed.message),
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      };
    }
  } catch {
    // 不是纯 JSON
  }

  // 方式3：提取任意 JSON 块
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

  // 方式4：纯文本消息
  return { message: raw.trim(), actions: [] };
}

// ============ 系统提示词 ============

async function buildCodeSystemPrompt(ctx?: Partial<RepoContext>): Promise<string> {
  let fileTree = '';
  try {
    fileTree = await getCachedFileTree(ctx);
  } catch {
    fileTree = '(无法获取文件树)';
  }

  const repoName = ctx?.repo || '默认项目';

  return `你是一个专业的 AI 编程助手，正在帮助用户修改项目（仓库：${repoName}）。

能力：
- read: 读取文件内容
- list: 浏览目录
- write: 修改文件（需包含完整文件内容）
- create: 新建文件
- delete: 删除文件

响应格式：
1. 先用 Markdown 写你的分析和说明
2. 需要文件操作时，在末尾加一个 JSON 代码块：

\`\`\`json
{ "actions": [{ "type": "read", "path": "app/page.tsx" }] }
\`\`\`

规则：
- 需要先看文件内容时返回 read/list 动作，系统会执行并反馈结果
- 准备好修改时返回 write/create/delete 动作
- write/create 的 content 必须是完整文件内容，不是 diff
- 路径使用相对路径（如 app/page.tsx）
- 不要读取 package-lock.json 等大文件
- 修改前先读取确认现有内容
- 代码注释用中文
- 回复要简洁，不要啰嗦

项目文件结构：
${fileTree}`;
}

async function buildChatSystemPrompt(ctx?: Partial<RepoContext>): Promise<string> {
  let fileTree = '';
  try {
    fileTree = await getCachedFileTree(ctx);
  } catch {
    fileTree = '(无法获取文件树)';
  }

  const repoName = ctx?.repo || '默认项目';

  return `你是一个专业的 AI 编程助手，正在和用户讨论项目（仓库：${repoName}）。

当前是「聊天模式」，你只需要回答用户的问题，不需要执行文件操作。

你可以：
- 回答技术问题
- 解释代码逻辑
- 提供架构建议
- 讨论最佳实践
- 帮助调试问题
- 解释项目结构

规则：
- 用 Markdown 格式回复
- 代码示例用代码块包裹
- 代码注释用中文
- 回复要专业、简洁
- 如果用户想直接修改代码，建议切换到「编程模式」

项目文件结构（仅供参考，不需要执行文件操作）：
${fileTree}`;
}

// ============ 主处理函数 ============
export async function POST(request: NextRequest) {
  const authResult = adminAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const body = await request.json();
    const {
      messages,
      repo,
      branch,
      mode = 'code',
    }: {
      messages: ChatMessage[];
      repo?: string;
      branch?: string;
      mode?: 'chat' | 'code';
    } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '缺少消息内容' }, { status: 400 });
    }

    const ctx: Partial<RepoContext> = {};
    if (repo) ctx.repo = repo;
    if (branch) ctx.branch = branch;

    const isChatMode = mode === 'chat';
    const systemPrompt = isChatMode
      ? await buildChatSystemPrompt(ctx)
      : await buildCodeSystemPrompt(ctx);

    const conversation: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const maxIterations = isChatMode ? MAX_ITERATIONS_CHAT : MAX_ITERATIONS_CODE;
    const proposedChanges: FileChange[] = [];
    const readLogs: string[] = [];
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          for (let i = 0; i < maxIterations; i++) {
            console.log(`[CODER] ${isChatMode ? '聊天' : '编程'}模式 流式 loop 第 ${i + 1}/${maxIterations} 轮`);

            let rawResponse = '';
            let sentLength = 0;
            const JSON_MARKER = '```json';

            for await (const token of callAIStream(conversation)) {
              rawResponse += token;

              // 聊天模式：直接发送所有 token，不检测 JSON
              if (isChatMode) {
                send({ type: 'token', content: token });
                sentLength = rawResponse.length;
                continue;
              }

              // 编程模式：检测 JSON 代码块，只发送 JSON 之前的可读文本
              const jsonIdx = rawResponse.indexOf(JSON_MARKER);
              if (jsonIdx !== -1) {
                // JSON 块开始，只发送 JSON 标记之前的内容
                if (jsonIdx > sentLength) {
                  send({ type: 'token', content: rawResponse.slice(sentLength, jsonIdx) });
                  sentLength = jsonIdx;
                }
              } else {
                // 还没有 JSON 标记，保留缓冲区防止标记被截断
                const safeLen = Math.max(sentLength, rawResponse.length - JSON_MARKER.length);
                if (safeLen > sentLength) {
                  send({ type: 'token', content: rawResponse.slice(sentLength, safeLen) });
                  sentLength = safeLen;
                }
              }
            }

            // 编程模式：发送 JSON 标记之前的剩余文本
            if (!isChatMode) {
              const finalJsonIdx = rawResponse.indexOf(JSON_MARKER);
              const finalSafeLen = finalJsonIdx !== -1 ? finalJsonIdx : rawResponse.length;
              if (finalSafeLen > sentLength) {
                send({ type: 'token', content: rawResponse.slice(sentLength, finalSafeLen) });
              }
            }

            conversation.push({ role: 'assistant', content: rawResponse });

            // 聊天模式：直接完成
            if (isChatMode) {
              send({ type: 'done' });
              controller.close();
              return;
            }

            // 编程模式：解析 actions
            const parsed = parseAIResponse(rawResponse);
            const actions = parsed.actions || [];
            const readActions = actions.filter((a) => a.type === 'read' || a.type === 'list');
            const writeActions = actions.filter(
              (a) => a.type === 'write' || a.type === 'create' || a.type === 'delete',
            );

            // 收集文件变更
            for (const action of writeActions) {
              proposedChanges.push({
                type: action.type as 'create' | 'write' | 'delete',
                path: action.path,
                content: action.content,
              });
            }

            // 没有读取动作 = 分析完成
            if (readActions.length === 0) {
              send({ type: 'changes', changes: proposedChanges });
              send({ type: 'readLogs', readLogs });
              send({ type: 'done' });
              controller.close();
              return;
            }

            // 执行文件读取
            const readResults: string[] = [];
            for (const action of readActions) {
              try {
                if (action.type === 'read') {
                  send({ type: 'read', message: `📄 读取 ${action.path}` });
                  const result = await readFile(action.path, ctx);
                  if (result.content.startsWith('__DIRECTORY__')) {
                    readLogs.push(`📁 ${action.path} 是目录`);
                    readResults.push(`[目录 ${action.path}]\n这是目录，请用 list 动作。`);
                  } else {
                    // 增大文件预览限制：12000 字符（约 4000 token）
                    const preview =
                      result.content.length > 12000
                        ? result.content.slice(0, 12000) + '\n...(截断，文件共 ' + result.content.length + ' 字符)'
                        : result.content;
                    readLogs.push(`📄 读取 ${action.path} (${result.content.length} 字符)`);
                    readResults.push(`[文件 ${action.path}]\n\`\`\`\n${preview}\n\`\`\``);
                  }
                } else if (action.type === 'list') {
                  send({ type: 'read', message: `📁 列出目录 ${action.path}` });
                  const items = await listDir(action.path, ctx);
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

            send({ type: 'readLogs', readLogs: [...readLogs] });

            conversation.push({
              role: 'user',
              content: `文件读取结果：\n\n${readResults.join('\n\n')}\n\n请继续分析。如需读取更多文件返回 read/list，如已准备好修改请返回 write/create/delete。`,
            });
          }

          // 达到最大迭代次数
          if (!isChatMode) {
            send({ type: 'changes', changes: proposedChanges });
            send({ type: 'readLogs', readLogs });
          }
          send({
            type: 'token',
            content: `\n\n(已达到最大分析轮次，共提出 ${proposedChanges.length} 个文件变更)`,
          });
          send({ type: 'done' });
          controller.close();
        } catch (error) {
          console.error('[CODER STREAM ERROR]', error);
          send({
            type: 'error',
            content: error instanceof Error ? error.message : String(error),
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
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
