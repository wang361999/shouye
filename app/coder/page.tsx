'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import {
  Brain,
  Terminal,
  GitBranch,
  Code,
  Bot,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  MessageSquare,
  Users,
  Plus,
  Send,
  Paperclip,
  Trash2,
  RefreshCw,
  Play,
  StopCircle,
  Download,
  Upload,
  FolderOpen,
  FileCode,
  Settings,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Minimize2,
} from 'lucide-react';

// 定义Coder状态类型
type CoderStatus = 'idle' | 'running' | 'paused' | 'error' | 'completed';

// 定义任务类型
interface Task {
  id: string;
  title: string;
  description: string;
  status: CoderStatus;
  progress: number;
  logs: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 定义会话消息类型
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function CoderPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [statusText, setStatusText] = useState('准备就绪');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tasks]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // 检查登录状态
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  // 模拟任务执行
  const simulateTaskExecution = useCallback(async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === 'completed' || task.status === 'error') return;

    setIsRunning(true);
    setStatusText('任务运行中...');

    // 模拟任务执行过程
    const steps = [
      '初始化开发环境...',
      '安装依赖包...',
      '运行代码分析...',
      '生成测试用例...',
      '执行单元测试...',
      '构建项目...',
      '部署到测试环境...',
      '任务完成！',
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'running',
                progress: Math.round(((i + 1) / steps.length) * 100),
                logs: [...t.logs, `[${new Date().toLocaleTimeString()}] ${steps[i]}`],
              }
            : t,
        ),
      );
    }

    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === taskId ? { ...t, status: 'completed', progress: 100 } : t,
      ),
    );
    setIsRunning(false);
    setStatusText('所有任务已完成');
  }, [tasks]);

  // 创建新任务
  const createTask = useCallback(async () => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: `新任务 ${tasks.length + 1}`,
      description: '这是一个AI辅助开发任务',
      status: 'idle',
      progress: 0,
      logs: [`[${new Date().toLocaleTimeString()}] 任务已创建`],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setTasks((prevTasks) => [...prevTasks, newTask]);
    setActiveTask(newTask.id);
    
    // 添加系统消息
    setChatMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `新任务"${newTask.title}"已创建，可以开始执行了。`,
        timestamp: new Date(),
      },
    ]);
  }, [tasks.length]);

  // 发送消息
  const sendMessage = useCallback(async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setStatusText('AI 正在思考...');

    // 模拟AI响应
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const aiResponse: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: `收到您的消息："${chatInput}"。我正在分析并为您提供建议...`,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, aiResponse]);
    setStatusText('准备就绪');
  }, [chatInput]);

  // 执行选中的任务
  const runActiveTask = useCallback(async () => {
    if (activeTask) {
      await simulateTaskExecution(activeTask);
    }
  }, [activeTask, simulateTaskExecution]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            AI 代码助手
          </h1>
          <p className="text-muted-foreground mt-1">
            让AI帮你更高效地编写、测试和部署代码
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：任务列表 */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>开发任务</CardTitle>
              <Button onClick={createTask} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                新建任务
              </Button>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Terminal className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>还没有任务</p>
                  <p className="text-sm">点击"新建任务"开始</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        activeTask === task.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setActiveTask(task.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{task.title}</span>
                        <Badge
                          variant={
                            task.status === 'completed'
                              ? 'default'
                              : task.status === 'error'
                              ? 'destructive'
                              : task.status === 'running'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {task.status === 'completed'
                            ? '完成'
                            : task.status === 'error'
                            ? '错误'
                            : task.status === 'running'
                            ? '运行中'
                            : '待执行'
                          }
                        </Badge>
                      </div>
                      <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 任务详情 */}
          {activeTask && (
            <Card>
              <CardHeader>
                <CardTitle>任务详情</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const task = tasks.find((t) => t.id === activeTask);
                  if (!task) return null;
                  
                  return (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">状态</p>
                        <p className="font-medium">
                          {task.status === 'completed'
                            ? '✅ 已完成'
                            : task.status === 'running'
                            ? '🔄 运行中'
                            : task.status === 'error'
                            ? '❌ 出错'
                            : '⏳ 待执行'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">进度</p>
                        <p className="font-medium">{task.progress}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">日志</p>
                        <div className="mt-1 p-2 bg-muted rounded text-xs font-mono max-h-32 overflow-y-auto">
                          {task.logs.length > 0 ? (
                            task.logs.map((log, idx) => (
                              <div key={idx} className="mb-1">{log}</div>
                            ))
                          ) : (
                            <span className="text-muted-foreground">暂无日志</span>
                          )}
                          <div ref={logsEndRef} />
                        </div>
                      </div>
                      <Button
                        onClick={runActiveTask}
                        disabled={isRunning || task.status === 'completed'}
                        className="w-full"
                      >
                        {isRunning ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            执行中...
                          </>
                        ) : task.status === 'completed' ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            已完成
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            执行任务
                          </>
                        )}
                      </Button>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧：聊天界面 */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI 对话
              </CardTitle>
              <CardDescription>
                与AI代码助手对话，获取编程建议和帮助
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              {/* 消息列表 */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pb-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-lg font-medium">开始对话</p>
                    <p className="text-sm">
                      可以向AI询问编程问题、请求代码审查或让AI帮你完成任务
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {msg.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* 输入区域 */}
              <div className="border-t pt-4">
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="输入消息..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button onClick={sendMessage} disabled={!chatInput.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>状态: {statusText}</span>
                  {isRunning && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 功能快捷入口 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {[
              { icon: Code, label: '代码生成', desc: 'AI生成代码片段' },
              { icon: GitBranch, label: '代码审查', desc: '分析代码质量' },
              { icon: Terminal, label: '命令行助手', desc: '生成Shell命令' },
              { icon: Brain, label: '架构设计', desc: '系统设计建议' },
            ].map((item, idx) => (
              <Card key={idx} className="cursor-pointer hover:border-primary transition-colors">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <item.icon className="h-8 w-8 text-primary mb-2" />
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
