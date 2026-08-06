'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ============ 类型定义 ============
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  changes?: FileChange[];
  changesApplied?: boolean;
  readLogs?: string[];
}

interface FileChange {
  type: 'create' | 'write' | 'delete';
  path: string;
  content?: string;
}

interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

// ============ 工具函数 ============
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return d.toLocaleDateString('zh-CN');
}

// ============ 代码块组件 ============
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative group my-2">
      <div className="flex items-center justify-between bg-gray-800 text-gray-300 text-xs px-4 py-1.5 rounded-t-lg">
        <span className="font-mono">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 hover:text-blue-300"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-b-lg overflow-x-auto text-sm max-h-96 overflow-y-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ============ Markdown 渲染组件 ============
function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children }) {
            const match = /language-(\w+)/.exec(className || '');
            const code = String(children).replace(/\n$/, '');
            if (match) {
              return <CodeBlock code={code} language={match[1]} />;
            }
            return (
              <code className="bg-gray-800 text-green-400 px-1.5 py-0.5 rounded text-sm">
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-2 leading-relaxed">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
          },
          h1({ children }) {
            return <h1 className="text-lg font-bold mt-3 mb-2">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>;
          },
          a({ href, children }) {
            return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{children}</a>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ============ 文件变更卡片组件 ============
function FileChangeCard({
  change,
  applied,
  onApply,
}: {
  change: FileChange;
  applied: boolean;
  onApply: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const typeConfig = {
    create: { label: '新建', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
    write: { label: '修改', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
    delete: { label: '删除', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  };

  const config = typeConfig[change.type];

  return (
    <div className={`rounded-lg border ${config.border} ${config.bg} overflow-hidden mb-2`}>
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`text-xs font-bold ${config.color} shrink-0`}>{config.label}</span>
          <span className="text-sm text-gray-300 font-mono truncate">{change.path}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {change.content && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              {expanded ? '收起' : '展开'}
            </button>
          )}
          {!applied ? (
            <button
              onClick={onApply}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded transition-colors"
            >
              应用
            </button>
          ) : (
            <span className="text-xs text-green-400">已应用</span>
          )}
        </div>
      </div>
      {expanded && change.content && (
        <div className="border-t border-gray-700/50">
          <pre className="bg-gray-900/80 text-gray-100 p-3 text-xs overflow-x-auto max-h-80 overflow-y-auto">
            <code>{change.content}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

// ============ 主页面组件 ============
export default function CoderPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [showCommits, setShowCommits] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 检查登录状态
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login?redirect=/coder');
    }
  }, [router]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // 自动调整输入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // 获取提交记录
  const fetchCommits = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/coder/commits?count=10', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCommits(data.commits || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCommits();
  }, [fetchCommits]);

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const token = getToken();
      const res = await fetch('/api/coder/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.detail || '请求失败');
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.reply || '(无回复)',
        changes: data.changes || [],
        readLogs: data.readLogs || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // 应用单个文件变更
  const handleApplyChange = async (msgIndex: number, changeIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg || !msg.changes) return;

    const change = msg.changes[changeIndex];
    try {
      const token = getToken();
      const res = await fetch('/api/coder/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          changes: [change],
          commitMessage: `AI 编程助手: ${change.type === 'create' ? '新建' : change.type === 'write' ? '修改' : '删除'} ${change.path}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '应用失败');
      }

      // 标记为已应用
      setMessages((prev) =>
        prev.map((m, i) => {
          if (i === msgIndex && m.changes) {
            const newChanges = [...m.changes];
            return { ...m, changes: newChanges, changesApplied: true };
          }
          return m;
        }),
      );

      // 刷新提交记录
      fetchCommits();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // 应用所有变更
  const handleApplyAll = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg || !msg.changes || msg.changes.length === 0) return;

    try {
      const token = getToken();
      const res = await fetch('/api/coder/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          changes: msg.changes,
          commitMessage: `AI 编程助手批量修改 (${msg.changes.length} 个文件)`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '应用失败');
      }

      setMessages((prev) =>
        prev.map((m, i) => (i === msgIndex ? { ...m, changesApplied: true } : m)),
      );

      fetchCommits();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // 清空对话
  const handleClear = () => {
    setMessages([]);
    setError('');
  };

  // 键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-950 text-gray-100 flex flex-col h-screen overflow-hidden">
      {/* 顶部栏 */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            AI
          </div>
          <div>
            <h1 className="text-base font-bold">AI 编程助手</h1>
            <p className="text-xs text-gray-500">GLM-5.2 · 通过聊天修改代码并部署</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchCommits(); setShowCommits(!showCommits); }}
            className="text-xs text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {showCommits ? '隐藏记录' : '提交记录'}
          </button>
          <button
            onClick={handleClear}
            className="text-xs text-gray-400 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            清空
          </button>
          <a
            href="/"
            className="text-xs text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            返回首页
          </a>
        </div>
      </header>

      {/* 提交记录面板 */}
      {showCommits && (
        <div className="border-b border-gray-800 bg-gray-900/50 max-h-64 overflow-y-auto shrink-0">
          <div className="p-3 space-y-2">
            {commits.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">暂无提交记录</p>
            ) : (
              commits.map((commit) => (
                <div key={commit.sha} className="flex items-start gap-3 text-sm">
                  <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded shrink-0">
                    {commit.sha}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 truncate">{commit.message}</p>
                    <p className="text-xs text-gray-500">
                      {commit.author} · {formatDate(commit.date)}
                    </p>
                  </div>
                  <a
                    href={commit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 hover:text-blue-400 shrink-0"
                  >
                    查看
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
                AI
              </div>
              <h2 className="text-xl font-bold mb-2">AI 编程助手</h2>
              <p className="text-gray-500 mb-6">告诉我你想修改什么，我来帮你写代码并推送到仓库</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {[
                  '帮我在首页添加一个搜索框',
                  '给论坛帖子加一个点赞功能',
                  '优化移动端的导航栏样式',
                  '修复用户登录后的跳转问题',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="text-left text-sm text-gray-400 hover:text-gray-200 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-4 py-3 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, msgIndex) => (
            <div key={msgIndex} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-6`}>
              <div className={`max-w-3xl ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                {/* 消息内容 */}
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-900 border border-gray-800 text-gray-100'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <MarkdownContent content={msg.content} />
                  )}
                </div>

                {/* 读取日志 */}
                {msg.readLogs && msg.readLogs.length > 0 && (
                  <div className="text-xs text-gray-500 bg-gray-900/50 rounded-lg px-3 py-2 border border-gray-800/50">
                    <div className="flex items-center gap-1 mb-1 text-gray-400">
                      <span>AI 读取了以下文件：</span>
                    </div>
                    {msg.readLogs.map((log, i) => (
                      <div key={i} className="ml-2">{log}</div>
                    ))}
                  </div>
                )}

                {/* 文件变更卡片 */}
                {msg.changes && msg.changes.length > 0 && (
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">
                        {msg.changes.length} 个文件变更
                      </span>
                      {!msg.changesApplied && msg.changes.length > 1 && (
                        <button
                          onClick={() => handleApplyAll(msgIndex)}
                          className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded transition-colors"
                        >
                          全部应用并推送
                        </button>
                      )}
                    </div>
                    {msg.changes.map((change, changeIndex) => (
                      <FileChangeCard
                        key={changeIndex}
                        change={change}
                        applied={msg.changesApplied || false}
                        onApply={() => handleApplyChange(msgIndex, changeIndex)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 加载中 */}
          {loading && (
            <div className="flex justify-start mb-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-gray-400">AI 正在分析代码...</span>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区域 */}
      <div className="border-t border-gray-800 bg-gray-900/80 backdrop-blur-sm shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="描述你想修改的功能... (Enter 发送, Shift+Enter 换行)"
                rows={1}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-blue-500 placeholder-gray-500"
                style={{ maxHeight: '200px' }}
                disabled={loading}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl px-5 py-3 text-sm font-medium transition-colors shrink-0"
            >
              发送
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2 text-center">
            AI 会自动读取项目文件、分析代码并提出修改方案，确认后一键推送到 GitHub
          </p>
        </div>
      </div>
    </div>
  );
}
