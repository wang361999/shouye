'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import { useAppStore } from '@/lib/store';
import { formatTimeAgo, formatDate, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ============ 类型定义 ============
interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
  avatar: string | null;
  bio: string | null;
  postCount: number;
  commentCount: number;
  createdAt: string;
  level: {
    level: number;
    title: string;
    icon: string;
    currentExp: number;
    nextLevelExp: number;
  };
}

interface MyPost {
  id: string;
  title: string;
  summary: string;
  category: { id: string; name: string; slug: string } | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isEssence: boolean;
  createdAt: string;
}

interface MyComment {
  id: string;
  content: string;
  postId: string;
  postTitle: string;
  createdAt: string;
}

type TabKey = 'profile' | 'posts' | 'comments';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'profile', label: '个人资料', icon: '👤' },
  { key: 'posts', label: '我的帖子', icon: '📝' },
  { key: 'comments', label: '我的评论', icon: '💬' },
];

export default function ProfilePage() {
  const { user, token, hydrate, _hydrated, setAuth } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  // ---- 个人资料状态 ----
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // ---- 修改密码状态 ----
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // ---- 我的帖子状态 ----
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [postsTotalPages, setPostsTotalPages] = useState(1);

  // ---- 我的评论状态 ----
  const [comments, setComments] = useState<MyComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // ============ 客户端水合 ============
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // ============ 获取个人资料 ============
  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setProfileLoading(true);
    try {
      const res = await fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '获取资料失败');
      }
      const data: UserProfile = await res.json();
      setProfile(data);
      setEditUsername(data.username);
      setEditBio(data.bio || '');
    } catch (err: any) {
      toast.error(err.message || '获取个人资料失败');
    } finally {
      setProfileLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user && token && _hydrated && activeTab === 'profile' && !profile) {
      fetchProfile();
    }
  }, [user, token, _hydrated, activeTab, profile, fetchProfile]);

  // ============ 获取我的帖子 ============
  const fetchPosts = useCallback(
    async (page: number) => {
      if (!user) return;
      setPostsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '10',
          authorId: String(user.id),
        });
        const res = await fetch(`/api/forum/posts?${params}`);
        if (!res.ok) throw new Error('获取帖子失败');
        const data = await res.json();
        const formatted: MyPost[] = (data.posts || []).map((p: any) => ({
          id: String(p.id),
          title: p.title,
          summary: p.summary || p.content || '',
          category: p.category
            ? {
                id: String(p.category.id),
                name: p.category.name,
                slug: p.category.slug,
              }
            : null,
          viewCount: p.viewCount || 0,
          likeCount: p.likeCount || 0,
          commentCount: p.commentCount || 0,
          isPinned: p.isPinned || false,
          isEssence: p.isEssence || false,
          createdAt: p.createdAt,
        }));
        setPosts(formatted);
        setPostsTotalPages(data.totalPages || 1);
      } catch (err: any) {
        toast.error(err.message || '获取我的帖子失败');
      } finally {
        setPostsLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (user && activeTab === 'posts') {
      fetchPosts(postsPage);
    }
  }, [user, activeTab, postsPage, fetchPosts]);

  // ============ 获取我的评论 ============
  // 复用现有评论 API：先获取用户帖子，再获取各帖评论并筛选当前用户的
  const fetchComments = useCallback(async () => {
    if (!user) return;
    setCommentsLoading(true);
    try {
      // 获取用户参与过的帖子（先取自己的帖子）
      const postsRes = await fetch(
        `/api/forum/posts?authorId=${user.id}&limit=100`,
      );
      if (!postsRes.ok) throw new Error('获取帖子失败');
      const postsData = await postsRes.json();

      const allComments: MyComment[] = [];
      for (const p of postsData.posts || []) {
        const commentsRes = await fetch(`/api/forum/comments?postId=${p.id}`);
        if (!commentsRes.ok) continue;
        const postComments = await commentsRes.json();

        // 递归收集当前用户的评论（含回复）
        const collectUserComments = (list: any[]) => {
          for (const c of list) {
            if (c.author && String(c.author.id) === String(user.id)) {
              allComments.push({
                id: String(c.id),
                content: c.content,
                postId: String(p.id),
                postTitle: p.title,
                createdAt: c.createdAt,
              });
            }
            if (c.replies && c.replies.length > 0) {
              collectUserComments(c.replies);
            }
          }
        };
        collectUserComments(postComments);
      }

      // 按时间降序
      allComments.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setComments(allComments);
    } catch (err: any) {
      console.error('获取我的评论失败:', err);
      toast.error(err.message || '获取我的评论失败');
    } finally {
      setCommentsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab === 'comments' && comments.length === 0) {
      fetchComments();
    }
  }, [user, activeTab, comments.length, fetchComments]);

  // ============ 保存个人资料 ============
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (!editUsername.trim()) {
      toast.error('用户名不能为空');
      return;
    }
    if (editUsername.trim().length > 20) {
      toast.error('用户名不能超过 20 个字符');
      return;
    }
    if (editBio.length > 200) {
      toast.error('个人简介不能超过 200 个字符');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: editUsername.trim(),
          bio: editBio.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '保存失败');
      }
      toast.success(data.message || '资料更新成功');
      setProfile(data);

      // 同步更新 store 中的用户名
      if (user && data.username !== user.username) {
        setAuth(
          { id: user.id, username: data.username, role: user.role },
          token,
        );
      }
    } catch (err: any) {
      toast.error(err.message || '保存失败，请稍后重试');
    } finally {
      setSavingProfile(false);
    }
  }

  // ============ 修改密码 ============
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('请填写所有密码字段');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('新密码长度不能少于 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '修改失败');
      }
      toast.success(data.message || '密码修改成功');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || '修改失败，请稍后重试');
    } finally {
      setSavingPassword(false);
    }
  }

  // ============ 渲染：水合中 ============
  if (!_hydrated) {
    return (
      <Container className="py-16 text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-500">加载中...</p>
      </Container>
    );
  }

  // ============ 渲染：未登录 ============
  if (!user || !token) {
    return (
      <Container className="py-16 text-center">
        <div className="max-w-sm mx-auto bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">请先登录</h2>
          <p className="text-sm text-gray-500 mb-6">
            登录后即可查看个人中心、管理帖子和评论
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
        className="inline-block text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
      >
        &larr; 返回首页
      </Link>

      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">👤 个人中心</h1>

      {/* Tab 切换 */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
        <Link
          href="/profile/licenses"
          className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-blue-600 transition-colors whitespace-nowrap"
        >
          <span className="mr-1">🔑</span>
          我的授权
        </Link>
        <Link
          href="/profile/orders"
          className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-blue-600 transition-colors whitespace-nowrap"
        >
          <span className="mr-1">🛒</span>
          我的订单
        </Link>
      </div>

      {/* ============ Tab: 个人资料 ============ */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {profileLoading && !profile ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 bg-gray-200 rounded-full" />
                <div className="space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-32" />
                  <div className="h-4 bg-gray-100 rounded w-48" />
                </div>
              </div>
            </div>
          ) : profile ? (
            <>
              {/* 用户信息卡片 */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* 头像 */}
                  <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-3xl font-bold flex-shrink-0 overflow-hidden">
                    {profile.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatar}
                        alt={profile.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      profile.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  {/* 基本信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-gray-900">
                        {profile.username}
                      </h2>
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full',
                          profile.role === 'ADMIN'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-gray-50 text-gray-600 border border-gray-200',
                        )}
                      >
                        {profile.role === 'ADMIN' ? '管理员' : '普通用户'}
                      </span>
                      {/* 等级标签 */}
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700 border border-green-200">
                        {profile.level.icon} Lv.{profile.level.level}{' '}
                        {profile.level.title}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      📧 {profile.email}
                    </p>
                    <p className="text-sm text-gray-500">
                      📅 注册于 {formatDate(profile.createdAt)}
                    </p>
                  </div>
                </div>

                {/* 统计数据 */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {profile.postCount}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">帖子</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {profile.commentCount}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">评论</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {profile.level.currentExp}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">互动数</div>
                  </div>
                </div>

                {/* 等级进度条 */}
                {profile.level.level < 6 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>
                        {profile.level.icon} {profile.level.title}
                      </span>
                      <span>
                        {profile.level.currentExp} / {profile.level.nextLevelExp}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (profile.level.currentExp /
                              profile.level.nextLevelExp) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 个人简介展示 */}
                {profile.bio && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h3 className="text-sm font-medium text-gray-700 mb-1">
                      个人简介
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {profile.bio}
                    </p>
                  </div>
                )}
              </div>

              {/* 快捷入口 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                  href="/profile/licenses"
                  className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-2xl group-hover:bg-blue-100 transition-colors">
                      🔑
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-gray-900">我的授权码</h3>
                      <p className="text-xs text-gray-500 mt-0.5">查看授权状态、绑定域名</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
                <Link
                  href="/profile/orders"
                  className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center text-2xl group-hover:bg-orange-100 transition-colors">
                      🛒
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-gray-900">我的订单</h3>
                      <p className="text-xs text-gray-500 mt-0.5">查看订单、支付购买</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
                <Link
                  href="/products"
                  className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-green-50 text-green-600 flex items-center justify-center text-2xl group-hover:bg-green-100 transition-colors">
                      📦
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-gray-900">产品中心</h3>
                      <p className="text-xs text-gray-500 mt-0.5">浏览所有产品</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              </div>

              {/* 编辑资料表单 */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  编辑资料
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  修改你的用户名和个人简介
                </p>

                <form
                  onSubmit={handleSaveProfile}
                  className="max-w-md space-y-5"
                >
                  {/* 用户名 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      用户名
                    </label>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder="请输入用户名"
                      maxLength={20}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* 个人简介 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      个人简介
                    </label>
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="介绍一下自己吧..."
                      maxLength={200}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                    <p className="mt-1 text-xs text-gray-400 text-right">
                      {editBio.length}/200
                    </p>
                  </div>

                  {/* 保存按钮 */}
                  <div>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingProfile ? '保存中...' : '保存资料'}
                    </button>
                  </div>
                </form>
              </div>

              {/* 修改密码 */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  修改密码
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  定期更换密码有助于保护账户安全
                </p>

                <form
                  onSubmit={handleChangePassword}
                  className="max-w-md space-y-5"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      当前密码
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="请输入当前密码"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      新密码
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="请输入新密码（至少 6 位）"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {newPassword.length > 0 && newPassword.length < 6 && (
                      <p className="mt-1 text-xs text-red-500">
                        密码长度不能少于 6 位
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      确认新密码
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="请再次输入新密码"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {confirmPassword.length > 0 &&
                      newPassword !== confirmPassword && (
                        <p className="mt-1 text-xs text-red-500">
                          两次输入的密码不一致
                        </p>
                      )}
                  </div>
                  <div>
                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingPassword ? '提交中...' : '确认修改'}
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ============ Tab: 我的帖子 ============ */}
      {activeTab === 'posts' && (
        <div>
          {postsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse"
                >
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                  <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <p className="text-4xl mb-3">📝</p>
              <p className="text-gray-400 mb-4">还没有发布过帖子</p>
              <Link
                href="/forum/new"
                className="inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                发布第一篇帖子
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 hover:shadow-sm transition-shadow"
                  >
                    {/* 标签行 */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {post.category && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {post.category.name}
                        </span>
                      )}
                      {post.isPinned && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600 border border-red-200">
                          📌 置顶
                        </span>
                      )}
                      {post.isEssence && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                          ⭐ 精华
                        </span>
                      )}
                    </div>

                    {/* 标题 */}
                    <h3 className="text-base sm:text-lg font-semibold mb-1.5">
                      <Link
                        href={`/forum/post/${post.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      >
                        {post.title}
                      </Link>
                    </h3>

                    {/* 摘要 */}
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2 leading-relaxed">
                      {post.summary}
                    </p>

                    {/* 底部统计 + 操作 */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center text-xs text-gray-400 space-x-3">
                        <span>{formatTimeAgo(post.createdAt)}</span>
                        <span>·</span>
                        <span>👁 {post.viewCount}</span>
                        <span>·</span>
                        <span>❤️ {post.likeCount}</span>
                        <span>·</span>
                        <span>💬 {post.commentCount}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/forum/post/${post.id}/edit`}
                          className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          编辑
                        </Link>
                        <Link
                          href={`/forum/post/${post.id}`}
                          className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
                        >
                          查看
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 分页 */}
              {postsTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-6">
                  <button
                    onClick={() => setPostsPage((p) => Math.max(1, p - 1))}
                    disabled={postsPage <= 1}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-md border transition-colors',
                      postsPage <= 1
                        ? 'text-gray-300 border-gray-200 cursor-not-allowed'
                        : 'text-gray-600 border-gray-300 hover:bg-gray-50',
                    )}
                  >
                    上一页
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-600">
                    {postsPage} / {postsTotalPages}
                  </span>
                  <button
                    onClick={() =>
                      setPostsPage((p) => Math.min(postsTotalPages, p + 1))
                    }
                    disabled={postsPage >= postsTotalPages}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-md border transition-colors',
                      postsPage >= postsTotalPages
                        ? 'text-gray-300 border-gray-200 cursor-not-allowed'
                        : 'text-gray-600 border-gray-300 hover:bg-gray-50',
                    )}
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============ Tab: 我的评论 ============ */}
      {activeTab === 'comments' && (
        <div>
          {commentsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse"
                >
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <p className="text-4xl mb-3">💬</p>
              <p className="text-gray-400 mb-4">还没有发表过评论</p>
              <Link
                href="/forum"
                className="inline-block px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
              >
                去论坛看看
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-sm transition-shadow"
                >
                  {/* 评论内容 */}
                  <p className="text-sm text-gray-800 leading-relaxed mb-3 line-clamp-3">
                    {comment.content}
                  </p>

                  {/* 所属帖子 + 时间 */}
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/forum/post/${comment.postId}`}
                      className="text-xs text-blue-600 hover:text-blue-700 hover:underline truncate max-w-[70%]"
                    >
                      📄 {comment.postTitle}
                    </Link>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatTimeAgo(comment.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Container>
  );
}
