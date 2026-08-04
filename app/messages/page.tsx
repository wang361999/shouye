'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import UserAvatar from '@/components/common/UserAvatar';
import { useAppStore } from '@/lib/store';
import { formatTimeAgo, cn, truncateText } from '@/lib/utils';
import toast from 'react-hot-toast';

// ============ 类型定义 ============
interface ConversationUser {
  id: string;
  username: string;
  avatar?: string | null;
}

interface Conversation {
  id: string;
  otherUser: ConversationUser;
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: string;
  } | null;
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender: ConversationUser;
  _pending?: boolean; // 乐观更新临时消息标记
}

// ============ 常量 ============
const POLL_INTERVAL = 3000; // 3秒轮询
const MAX_MESSAGE_LENGTH = 1000;
const MESSAGE_PAGE_SIZE = 50;

export default function MessagesPage() {
  const { user, token, hydrate, _hydrated } = useAppStore();

  // ---- 状态 ----
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);

  // ---- Refs（避免轮询闭包过期） ----
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const urlHandledRef = useRef(false);

  // 同步 ref
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // ============ 客户端水合 ============
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // ============ 获取会话列表 ============
  const fetchConversations = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;
    try {
      const res = await fetch('/api/messages/conversations', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.data || []);
    } catch {
      // 轮询时静默失败
    }
  }, []);

  // 首次加载会话列表
  useEffect(() => {
    if (!user || !token || !_hydrated) return;
    setLoadingConversations(true);
    fetchConversations().finally(() => setLoadingConversations(false));
  }, [user, token, _hydrated, fetchConversations]);

  // ============ 处理 URL 参数 (?target=userId 或 ?conv=conversationId) ============
  useEffect(() => {
    if (!user || !token || !_hydrated || urlHandledRef.current) return;
    urlHandledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const target = params.get('target');
    const conv = params.get('conv');

    if (target) {
      // 发起新会话
      handleStartConversation(target);
      // 清理 URL 参数
      window.history.replaceState({}, '', '/messages');
    } else if (conv) {
      // 选择已有会话
      setSelectedId(conv);
      setShowMobileChat(true);
      window.history.replaceState({}, '', '/messages');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, _hydrated]);

  // ============ 获取会话消息 ============
  const fetchMessages = useCallback(
    async (convId: string, showLoading: boolean) => {
      const t = tokenRef.current;
      if (!t) return;
      if (showLoading) setLoadingMessages(true);
      try {
        const params = new URLSearchParams({
          page: '1',
          limit: String(MESSAGE_PAGE_SIZE),
        });
        const res = await fetch(
          `/api/messages/conversations/${convId}?${params}`,
          { headers: { Authorization: `Bearer ${t}` } },
        );
        if (!res.ok) {
          if (showLoading) {
            const err = await res.json().catch(() => ({}));
            toast.error(err.error || '获取消息失败');
          }
          return;
        }
        const data = await res.json();
        setMessages(data.data || []);
      } catch {
        // 轮询时静默失败
      } finally {
        if (showLoading) setLoadingMessages(false);
      }
    },
    [],
  );

  // 选择会话时获取消息
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    fetchMessages(selectedId, true);
    setShowMobileChat(true);
  }, [selectedId, fetchMessages]);

  // ============ 轮询刷新（3秒） ============
  useEffect(() => {
    if (!user || !token) return;

    const poll = async () => {
      await fetchConversations();
      const currentId = selectedIdRef.current;
      if (currentId) {
        await fetchMessages(currentId, false);
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [user, token, fetchConversations, fetchMessages]);

  // ============ 自动滚动到底部 ============
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ============ 发起新会话 ============
  const handleStartConversation = async (targetUserId: string) => {
    const t = tokenRef.current;
    if (!t) return;
    try {
      const res = await fetch('/api/messages/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || '创建会话失败');
        return;
      }
      const data: Conversation = await res.json();
      // 添加到会话列表（如不存在）
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === data.id);
        if (exists) return prev;
        return [data, ...prev];
      });
      setSelectedId(data.id);
      setShowMobileChat(true);
    } catch {
      toast.error('创建会话失败');
    }
  };

  // ============ 选择会话 ============
  const handleSelectConversation = (convId: string) => {
    setSelectedId(convId);
    // 本地标记已读
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c)),
    );
  };

  // ============ 发送消息 ============
  const handleSendMessage = async () => {
    const content = input.trim();
    if (!content || !selectedId || !token || sending) return;

    if (content.length > MAX_MESSAGE_LENGTH) {
      toast.error(`消息内容不能超过 ${MAX_MESSAGE_LENGTH} 字符`);
      return;
    }

    // 乐观更新：添加临时消息
    const tempId = `temp-${Date.now()}`;
    const tempMessage: ChatMessage = {
      id: tempId,
      conversationId: selectedId,
      senderId: user!.id,
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
      sender: {
        id: user!.id,
        username: user!.username,
        avatar: user!.avatar || null,
      },
      _pending: true,
    };

    setMessages((prev) => [...prev, tempMessage]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`/api/messages/conversations/${selectedId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || '发送失败');
        // 移除临时消息，恢复输入
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInput(content);
        return;
      }

      const data = await res.json();
      const realMessage: ChatMessage = data.data;

      // 用真实消息替换临时消息（如轮询已同步则直接移除临时消息）
      setMessages((prev) => {
        const exists = prev.find((m) => m.id === realMessage.id);
        if (exists) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) => (m.id === tempId ? realMessage : m));
      });

      // 更新会话列表的最后消息
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                lastMessage: {
                  content,
                  createdAt: realMessage.createdAt,
                  senderId: user!.id,
                },
                lastMessageAt: realMessage.createdAt,
              }
            : c,
        ),
      );
    } catch {
      toast.error('发送失败，请检查网络');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  // ============ 输入框按键处理（Enter 发送，Shift+Enter 换行） ============
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ============ 输入框自适应高度 ============
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  // ============ 当前选中会话 ============
  const selectedConversation = conversations.find((c) => c.id === selectedId);

  // ============ 渲染：水合中 ============
  if (!_hydrated) {
    return (
      <Container className="py-16 text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
        <p className="text-[13px] sm:text-sm text-gray-500">加载中...</p>
      </Container>
    );
  }

  // ============ 渲染：未登录 ============
  if (!user || !token) {
    return (
      <Container className="py-16 text-center">
        <div className="max-w-sm mx-auto bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-5xl mb-4">💬</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">请先登录</h2>
          <p className="text-[13px] sm:text-sm text-gray-500 mb-6">
            登录后即可使用私信功能与其他用户交流
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-2.5 bg-blue-600 text-white text-[13px] sm:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            前往登录
          </Link>
        </div>
      </Container>
    );
  }

  // ============ 渲染：主内容 ============
  return (
    <Container className="py-8">
      {/* 返回链接 */}
      <Link
        href="/"
        className="inline-block text-[11px] sm:text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
      >
        &larr; 返回首页
      </Link>

      {/* 页面标题 */}
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">💬 私信</h1>
      </div>

      {/* 主内容区：左右分栏 */}
      <div className="flex h-[calc(100vh-240px)] min-h-[500px] bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* ============ 左侧：会话列表 ============ */}
        <div
          className={cn(
            'w-full md:w-80 md:border-r border-gray-200 flex flex-col',
            showMobileChat && 'hidden md:flex',
          )}
        >
          {/* 列表头部 */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-[13px] sm:text-sm font-semibold text-gray-700">
              会话列表
              {conversations.length > 0 && (
                <span className="ml-2 text-xs text-gray-400">
                  ({conversations.length})
                </span>
              )}
            </h2>
          </div>

          {/* 会话列表 */}
          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              // 加载骨架屏
              <div className="p-3 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 animate-pulse"
                  >
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              // 空状态
              <div className="flex flex-col items-center justify-center h-full px-6 text-center py-12">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-[13px] sm:text-sm text-gray-500 mb-1">暂无私信会话</p>
                <p className="text-xs text-gray-400">
                  访问其他用户的资料页，点击「发私信」即可开始对话
                </p>
              </div>
            ) : (
              // 会话列表项
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left border-l-2 transition-colors',
                    selectedId === conv.id
                      ? 'bg-blue-50 border-blue-500'
                      : 'border-transparent hover:bg-gray-50',
                  )}
                >
                  {/* 头像 */}
                  <div className="relative flex-shrink-0">
                    <UserAvatar
                      username={conv.otherUser.username}
                      avatar={conv.otherUser.avatar}
                      size="md"
                    />
                    {/* 未读 badge */}
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                        {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* 会话信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'text-[13px] sm:text-sm font-medium truncate',
                          conv.unreadCount > 0
                            ? 'text-gray-900 font-semibold'
                            : 'text-gray-700',
                        )}
                      >
                        {conv.otherUser.username}
                      </span>
                      {conv.lastMessage && (
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {formatTimeAgo(conv.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage ? (
                      <p
                        className={cn(
                          'text-xs truncate mt-0.5',
                          conv.unreadCount > 0
                            ? 'text-gray-600 font-medium'
                            : 'text-gray-400',
                        )}
                      >
                        {conv.lastMessage.senderId === user.id && '你: '}
                        {truncateText(conv.lastMessage.content, 30)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">
                        点击开始对话
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ============ 右侧：消息区域 ============ */}
        <div
          className={cn(
            'flex-1 flex flex-col',
            !showMobileChat && 'hidden md:flex',
          )}
        >
          {selectedConversation ? (
            <>
              {/* 消息区域头部 */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
                {/* 移动端返回按钮 */}
                <button
                  onClick={() => setShowMobileChat(false)}
                  className="md:hidden p-1 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label="返回会话列表"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <UserAvatar
                  username={selectedConversation.otherUser.username}
                  avatar={selectedConversation.otherUser.avatar}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 truncate">
                    {selectedConversation.otherUser.username}
                  </h3>
                  <p className="text-xs text-gray-400">私信对话</p>
                </div>
              </div>

              {/* 消息气泡区域 */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/50">
                {loadingMessages ? (
                  // 加载骨架屏
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex items-end gap-2',
                          i % 2 === 0 ? 'justify-start' : 'justify-end',
                        )}
                      >
                        {i % 2 === 0 && (
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
                        )}
                        <div className="max-w-[60%] space-y-1">
                          <div className="h-10 bg-gray-200 rounded-2xl animate-pulse w-48" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  // 空状态
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <p className="text-4xl mb-3">👋</p>
                    <p className="text-[11px] sm:text-sm text-gray-500">
                      还没有消息，发送第一条消息开始对话吧
                    </p>
                  </div>
                ) : (
                  // 消息列表
                  messages.map((msg) => {
                    const isOwn = msg.senderId === user.id;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex items-end gap-2',
                          isOwn ? 'justify-end' : 'justify-start',
                        )}
                      >
                        {/* 对方头像 */}
                        {!isOwn && (
                          <UserAvatar
                            username={msg.sender.username}
                            avatar={msg.sender.avatar}
                            size="sm"
                          />
                        )}

                        {/* 消息气泡 */}
                        <div
                          className={cn(
                            'max-w-[70%] flex flex-col',
                            isOwn ? 'items-end' : 'items-start',
                          )}
                        >
                          <div
                            className={cn(
                              'px-4 py-2 rounded-2xl text-[13px] sm:text-sm break-words whitespace-pre-wrap',
                              isOwn
                                ? 'bg-purple-600 text-white rounded-br-md'
                                : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md',
                              msg._pending && 'opacity-60',
                            )}
                          >
                            {msg.content}
                          </div>
                          <span className="text-[10px] text-gray-400 mt-1 px-1">
                            {formatTimeAgo(msg.createdAt)}
                            {msg._pending && ' · 发送中...'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                {/* 滚动锚点 */}
                <div ref={messagesEndRef} />
              </div>

              {/* 底部输入区域 */}
              <div className="border-t border-gray-200 p-3 bg-white">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
                    rows={1}
                    className="flex-1 resize-none px-3 py-2 text-[16px] sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent max-h-[120px] min-h-[40px] dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    style={{ height: '40px' }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!input.trim() || sending}
                    className="px-4 py-2 text-[13px] sm:text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {sending ? '...' : '发送'}
                  </button>
                </div>
                {/* 字符计数 */}
                {input.length > 800 && (
                  <div className="text-right mt-1">
                    <span
                      className={cn(
                        'text-[11px]',
                        input.length > MAX_MESSAGE_LENGTH
                          ? 'text-red-500'
                          : 'text-gray-400',
                      )}
                    >
                      {input.length} / {MAX_MESSAGE_LENGTH}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            // 未选择会话时的占位
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <p className="text-5xl mb-4">💬</p>
              <p className="text-[13px] sm:text-sm text-gray-500 mb-1">选择一个会话开始聊天</p>
              <p className="text-xs text-gray-400">
                从左侧列表选择一个会话，或从其他用户资料页发起私信
              </p>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
