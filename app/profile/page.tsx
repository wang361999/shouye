'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import AvatarPicker from '@/components/common/AvatarPicker';
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

type TabKey = 'profile' | 'posts' | 'comments' | 'likes' | 'favorites' | 'badges';

const NAV_ITEMS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'profile', label: '个人资料', icon: '👤' },
  { key: 'posts', label: '我的帖子', icon: '📝' },
  { key: 'comments', label: '我的评论', icon: '💬' },
  { key: 'likes', label: '我的点赞', icon: '❤️' },
  { key: 'favorites', label: '我的收藏', icon: '⭐' },
  { key: 'badges', label: '我的徽章', icon: '🏅' },
];

const PROFILE_SECTIONS = [
  { id: 'edit-profile', label: '编辑资料', icon: '✏️' },
  { id: 'change-password', label: '修改密码', icon: '🔑' },
  { id: 'quick-links', label: '快捷入口', icon: '🔗' },
];

export default function ProfilePage() {
  const { user, token, hydrate, _hydrated, setAuth, updateAvatar } =
    useAppStore();
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [activeProfileSection, setActiveProfileSection] = useState('edit-profile');

  // ---- 个人资料状态 ----
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
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

  // ---- 我的点赞状态 ----
  const [likedPosts, setLikedPosts] = useState<MyPost[]>([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likesPage, setLikesPage] = useState(1);
  const [likesTotalPages, setLikesTotalPages] = useState(1);

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
      setEditAvatar(data.avatar || '');
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
  const fetchComments = useCallback(async () => {
    if (!user) return;
    setCommentsLoading(true);
    try {
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

  // ============ 获取我的点赞 ============
  const fetchLikes = useCallback(
    async (page: number) => {
      if (!token) return;
      setLikesLoading(true);
      try {
        const res = await fetch(`/api/user/likes?page=${page}&limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('获取点赞列表失败');
        const data = await res.json();
        const formatted: MyPost[] = (data.posts || []).map((p: any) => ({
          id: String(p.id),
          title: p.title,
          summary: p.summary || '',
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
        setLikedPosts(formatted);
        setLikesTotalPages(data.totalPages || 1);
      } catch (err: any) {
        toast.error(err.message || '获取点赞列表失败');
      } finally {
        setLikesLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (user && token && activeTab === 'likes') {
      fetchLikes(likesPage);
    }
  }, [user, token, activeTab, likesPage, fetchLikes]);

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
          avatar: editAvatar.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '保存失败');
      }
      toast.success(data.message || '资料更新成功');
      setProfile(data);
      setEditAvatar(data.avatar || '');

      if (user) {
        if (data.username !== user.username) {
          setAuth(
            {
              id: user.id,
              username: data.username,
              role: user.role,
              avatar: data.avatar,
            },
            token,
          );
        } else {
          updateAvatar(data.avatar);
        }
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
        <p className="text-[11px] sm:text-sm text-gray-500">加载中...</p>
      </Container>
    );
  }

  // ============ 渲染：未登录 ============
  if (!user || !token) {
    return (
      <Container className="py-16 text-center">
        <div className="max-w-sm mx-auto bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div className="w-16 h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center text-3xl mb-4">
            🔒
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">请先登录</h2>
          <p className="text-[11px] sm:text-sm text-gray-500 mb-6">
            登录后即可查看个人中心、管理帖子和评论
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
    <Container className="py-6">
      {/* 返回链接 */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[11px] sm:text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        返回首页
      </Link>

      {/* ========== 用户横幅卡片 ========== */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-white mb-6">
        {/* 渐变背景 */}
        <div className="h-28 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        {/* 用户信息 */}
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-12">
            {/* 头像 */}
            <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-lg flex-shrink-0">
              <div className="w-full h-full rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-3xl font-bold overflow-hidden">
                {profile?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar}
                    alt={profile.username}
                    className="w-full h-full object-cover"
                  />
                ) : profile ? (
                  profile.username.charAt(0).toUpperCase()
                ) : user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  user.username.charAt(0).toUpperCase()
                )}
              </div>
            </div>

            {/* 名字 + 标签 */}
            <div className="flex-1 min-w-0 pt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">
                  {profile?.username || user.username}
                </h1>
                {profile && (
                  <>
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
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700 border border-green-200">
                      {profile.level.icon} Lv.{profile.level.level} {profile.level.title}
                    </span>
                  </>
                )}
              </div>
              <p className="text-[11px] sm:text-sm text-gray-500 mt-1">
                {profile?.email || '—'} · 注册于 {profile ? formatDate(profile.createdAt) : '—'}
              </p>
            </div>
          </div>

          {/* 统计 + 等级进度 */}
          {profile && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{profile.postCount}</div>
                  <div className="text-xs text-gray-500 mt-0.5">帖子</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{profile.commentCount}</div>
                  <div className="text-xs text-gray-500 mt-0.5">评论</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{profile.level.currentExp}</div>
                  <div className="text-xs text-gray-500 mt-0.5">互动数</div>
                </div>
              </div>

              {profile.level.level < 6 && (
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{profile.level.icon} {profile.level.title}</span>
                    <span>{profile.level.currentExp} / {profile.level.nextLevelExp}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (profile.level.currentExp / profile.level.nextLevelExp) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {profile.bio && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-[11px] sm:text-sm text-gray-600 leading-relaxed">{profile.bio}</p>
                </div>
              )}
            </div>
          )}

          {profileLoading && !profile && (
            <div className="mt-5 pt-5 border-t border-gray-100 animate-pulse">
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="text-center">
                    <div className="h-7 bg-gray-200 rounded w-12 mx-auto" />
                    <div className="h-3 bg-gray-100 rounded w-10 mx-auto mt-2" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========== 双栏布局 ========== */}
      <div className="flex gap-6">
        {/* ===== 左侧导航 ===== */}
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <nav className="sticky top-6 space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] sm:text-sm font-medium transition-colors text-left',
                  activeTab === item.key
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 border border-transparent',
                )}
              >
                <span className="text-[15px]">{item.icon}</span>
                {item.label}
              </button>
            ))}

            <div className="pt-2 mt-2 border-t border-gray-200 space-y-1">
              <Link
                href="/profile/licenses"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] sm:text-sm font-medium text-gray-600 hover:bg-gray-50 border border-transparent transition-colors"
              >
                <span className="text-[15px]">🔑</span>
                我的授权
              </Link>
              <Link
                href="/profile/orders"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] sm:text-sm font-medium text-gray-600 hover:bg-gray-50 border border-transparent transition-colors"
              >
                <span className="text-[15px]">🛒</span>
                我的订单
              </Link>
              <Link
                href="/products"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] sm:text-sm font-medium text-gray-600 hover:bg-gray-50 border border-transparent transition-colors"
              >
                <span className="text-[15px]">📦</span>
                产品中心
              </Link>
            </div>
          </nav>
        </aside>

        {/* ===== 右侧内容 ===== */}
        <div className="flex-1 min-w-0">
          {/* 移动端 Tab 切换 */}
          <div className="lg:hidden flex gap-1 border-b border-gray-200 mb-5 overflow-x-auto pb-px">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={cn(
                  'px-3 py-2 text-[13px] sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  activeTab === item.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                )}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* ============ Tab: 个人资料 ============ */}
          {activeTab === 'profile' && (
            <div className="flex gap-6">
              {/* 个人资料子导航 */}
              <aside className="hidden xl:block w-40 flex-shrink-0">
                <nav className="sticky top-6 space-y-1">
                  {PROFILE_SECTIONS.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      onClick={() => setActiveProfileSection(section.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] sm:text-sm font-medium transition-colors',
                        activeProfileSection === section.id
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'text-gray-600 hover:bg-gray-50 border border-transparent',
                      )}
                    >
                      <span>{section.icon}</span>
                      {section.label}
                    </a>
                  ))}
                </nav>
              </aside>

              {/* 个人资料内容 */}
              <div className="flex-1 min-w-0 space-y-6">
                {/* 编辑资料 */}
                <div id="edit-profile" className="scroll-mt-6 bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">✏️</span>
                    <h2 className="text-lg font-semibold text-gray-900">编辑资料</h2>
                  </div>
                  <p className="text-[11px] sm:text-sm text-gray-500 mb-6">
                    修改你的头像、用户名和个人简介
                  </p>

                  <form onSubmit={handleSaveProfile} className="space-y-5">
                    {/* 头像 */}
                    <div>
                      <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                        头像
                      </label>
                      <AvatarPicker
                        currentAvatar={editAvatar}
                        username={editUsername || profile?.username || user.username}
                        onAvatarChange={setEditAvatar}
                      />
                    </div>

                    {/* 用户名 */}
                    <div>
                      <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                        用户名
                      </label>
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        placeholder="请输入用户名"
                        maxLength={20}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* 个人简介 */}
                    <div>
                      <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                        个人简介
                      </label>
                      <textarea
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        placeholder="介绍一下自己吧..."
                        maxLength={200}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
                        className="px-6 py-2.5 bg-blue-600 text-white text-[13px] sm:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingProfile ? '保存中...' : '保存资料'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* 修改密码 */}
                <div id="change-password" className="scroll-mt-6 bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🔑</span>
                    <h2 className="text-lg font-semibold text-gray-900">修改密码</h2>
                  </div>
                  <p className="text-[11px] sm:text-sm text-gray-500 mb-6">
                    定期更换密码有助于保护账户安全
                  </p>

                  <form onSubmit={handleChangePassword} className="space-y-5">
                    <div>
                      <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                        当前密码
                      </label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="请输入当前密码"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                        新密码
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="请输入新密码（至少 6 位）"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {newPassword.length > 0 && newPassword.length < 6 && (
                        <p className="mt-1 text-xs text-red-500">密码长度不能少于 6 位</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                        确认新密码
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="请再次输入新密码"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                        <p className="mt-1 text-xs text-red-500">两次输入的密码不一致</p>
                      )}
                    </div>
                    <div>
                      <button
                        type="submit"
                        disabled={savingPassword}
                        className="px-6 py-2.5 bg-blue-600 text-white text-[13px] sm:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingPassword ? '提交中...' : '确认修改'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* 快捷入口 */}
                <div id="quick-links" className="scroll-mt-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">🔗 快捷入口</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Link
                      href="/profile/licenses"
                      className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all"
                    >
                      <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xl mb-3 group-hover:bg-blue-100 transition-colors">
                        🔑
                      </div>
                      <h3 className="text-[13px] sm:text-sm font-bold text-gray-900">我的授权码</h3>
                      <p className="text-xs text-gray-500 mt-0.5">查看授权状态、绑定域名</p>
                    </Link>
                    <Link
                      href="/profile/orders"
                      className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all"
                    >
                      <div className="w-11 h-11 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center text-xl mb-3 group-hover:bg-orange-100 transition-colors">
                        🛒
                      </div>
                      <h3 className="text-[13px] sm:text-sm font-bold text-gray-900">我的订单</h3>
                      <p className="text-xs text-gray-500 mt-0.5">查看订单、支付购买</p>
                    </Link>
                    <Link
                      href="/products"
                      className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all"
                    >
                      <div className="w-11 h-11 rounded-lg bg-green-50 text-green-600 flex items-center justify-center text-xl mb-3 group-hover:bg-green-100 transition-colors">
                        📦
                      </div>
                      <h3 className="text-[13px] sm:text-sm font-bold text-gray-900">产品中心</h3>
                      <p className="text-xs text-gray-500 mt-0.5">浏览所有产品</p>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============ Tab: 我的帖子 ============ */}
          {activeTab === 'posts' && (
            <div>
              {postsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                      <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                      <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                  <div className="w-16 h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center text-3xl mb-4">
                    📝
                  </div>
                  <p className="text-gray-500 mb-4">还没有发布过帖子</p>
                  <Link
                    href="/forum/new"
                    className="inline-block px-5 py-2.5 text-[13px] sm:text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
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
                        className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:shadow-sm transition-shadow"
                      >
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

                        <h3 className="text-[15px] sm:text-lg font-semibold mb-1.5">
                          <Link
                            href={`/forum/post/${post.id}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                          >
                            {post.title}
                          </Link>
                        </h3>

                        <p className="text-[11px] sm:text-sm text-gray-500 mb-3 line-clamp-2 leading-relaxed">
                          {post.summary}
                        </p>

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

                  {postsTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-6">
                      <button
                        onClick={() => setPostsPage((p) => Math.max(1, p - 1))}
                        disabled={postsPage <= 1}
                        className={cn(
                          'px-3 py-1.5 text-[11px] sm:text-sm rounded-md border transition-colors',
                          postsPage <= 1
                            ? 'text-gray-300 border-gray-200 cursor-not-allowed'
                            : 'text-gray-600 border-gray-300 hover:bg-gray-50',
                        )}
                      >
                        上一页
                      </button>
                      <span className="px-3 py-1.5 text-[11px] sm:text-sm text-gray-600">
                        {postsPage} / {postsTotalPages}
                      </span>
                      <button
                        onClick={() => setPostsPage((p) => Math.min(postsTotalPages, p + 1))}
                        disabled={postsPage >= postsTotalPages}
                        className={cn(
                          'px-3 py-1.5 text-[11px] sm:text-sm rounded-md border transition-colors',
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
                    <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                  <div className="w-16 h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center text-3xl mb-4">
                    💬
                  </div>
                  <p className="text-gray-500 mb-4">还没有发表过评论</p>
                  <Link
                    href="/forum"
                    className="inline-block px-5 py-2.5 text-[13px] sm:text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    去论坛看看
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
                    >
                      <p className="text-[11px] sm:text-sm text-gray-800 leading-relaxed mb-3 line-clamp-3">
                        {comment.content}
                      </p>
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

          {/* ============ Tab: 我的点赞 ============ */}
          {activeTab === 'likes' && (
            <div>
              {likesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                      <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                      <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                    </div>
                  ))}
                </div>
              ) : likedPosts.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                  <div className="w-16 h-16 mx-auto bg-red-50 rounded-full flex items-center justify-center text-3xl mb-4">
                    ❤️
                  </div>
                  <p className="text-gray-500 mb-4">还没有点赞过帖子</p>
                  <Link
                    href="/forum"
                    className="inline-block px-5 py-2.5 text-[13px] sm:text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    去论坛看看
                  </Link>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {likedPosts.map((post) => (
                      <div
                        key={post.id}
                        className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:shadow-sm transition-shadow"
                      >
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

                        <h3 className="text-[15px] sm:text-lg font-semibold mb-1.5">
                          <Link
                            href={`/forum/post/${post.id}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                          >
                            {post.title}
                          </Link>
                        </h3>

                        <p className="text-[11px] sm:text-sm text-gray-500 mb-3 line-clamp-2 leading-relaxed">
                          {post.summary}
                        </p>

                        <div className="flex items-center text-xs text-gray-400 space-x-3">
                          <span>{formatTimeAgo(post.createdAt)}</span>
                          <span>·</span>
                          <span>👁 {post.viewCount}</span>
                          <span>·</span>
                          <span>❤️ {post.likeCount}</span>
                          <span>·</span>
                          <span>💬 {post.commentCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {likesTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-6">
                      <button
                        onClick={() => setLikesPage((p) => Math.max(1, p - 1))}
                        disabled={likesPage <= 1}
                        className={cn(
                          'px-3 py-1.5 text-[11px] sm:text-sm rounded-md border transition-colors',
                          likesPage <= 1
                            ? 'text-gray-300 border-gray-200 cursor-not-allowed'
                            : 'text-gray-600 border-gray-300 hover:bg-gray-50',
                        )}
                      >
                        上一页
                      </button>
                      <span className="px-3 py-1.5 text-[11px] sm:text-sm text-gray-600">
                        {likesPage} / {likesTotalPages}
                      </span>
                      <button
                        onClick={() => setLikesPage((p) => Math.min(likesTotalPages, p + 1))}
                        disabled={likesPage >= likesTotalPages}
                        className={cn(
                          'px-3 py-1.5 text-[11px] sm:text-sm rounded-md border transition-colors',
                          likesPage >= likesTotalPages
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

          {activeTab === 'favorites' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">我的收藏夹</h2>
                <Link
                  href="/forum/my/favorites"
                  className="text-[11px] sm:text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  管理收藏夹 →
                </Link>
              </div>
              <FavoritesTab token={token} user={user} />
            </div>
          )}

          {activeTab === 'badges' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">我的徽章</h2>
              <BadgesTab token={token} user={user} />
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}

// ============ 收藏夹 Tab 组件 ============
function FavoritesTab({ token, user }: { token: string | null; user: any }) {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCollections = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/user/collections', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCollections(data);
      }
    } catch {
      // 静默降级
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user) fetchCollections();
  }, [user, fetchCollections]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/2 mb-3" />
            <div className="h-3 bg-gray-100 rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <div className="w-16 h-16 mx-auto bg-yellow-50 rounded-full flex items-center justify-center text-3xl mb-4">
          ⭐
        </div>
        <p className="text-gray-500 mb-4">还没有创建收藏夹</p>
        <Link
          href="/forum/my/favorites"
          className="inline-block px-5 py-2.5 text-[13px] sm:text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
        >
          创建收藏夹
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {collections.map((col: any) => (
        <Link
          key={col.id}
          href={`/forum/my/favorites?col=${col.id}`}
          className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">{col.name}</h3>
            <span className="text-xs text-gray-400">
              {col.isPublic ? '🌐 公开' : '🔒 私有'}
            </span>
          </div>
          {col.description && (
            <p className="text-[11px] sm:text-sm text-gray-500 mb-2">{col.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>📄 {col.itemCount || 0} 篇帖子</span>
            {col.recentPosts && col.recentPosts.length > 0 && (
              <span className="truncate">
                最近: {col.recentPosts[0].post?.title || '未知'}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ============ 徽章 Tab 组件 ============
function BadgesTab({ token, user }: { token: string | null; user: any }) {
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !user) return;
    fetch(`/api/badges/user?userId=${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setBadges(Array.isArray(data) ? data : data.badges || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, user]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
            <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-3" />
            <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (badges.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <div className="w-16 h-16 mx-auto bg-yellow-50 rounded-full flex items-center justify-center text-3xl mb-4">
          🏅
        </div>
        <p className="text-gray-500 mb-2">还没有获得徽章</p>
        <p className="text-[11px] sm:text-sm text-gray-400">
          多发帖、多评论、多互动即可自动获得徽章
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {badges.map((ub: any) => (
        <div
          key={ub.id}
          className="bg-white rounded-xl border border-gray-200 p-5 text-center hover:shadow-sm transition-shadow"
        >
          <div className="text-4xl mb-2">{ub.badge?.icon || '🏅'}</div>
          <h3 className="font-semibold text-gray-900 text-[13px] sm:text-sm mb-1">
            {ub.badge?.name}
          </h3>
          <p className="text-xs text-gray-400 line-clamp-2">
            {ub.badge?.description}
          </p>
          <p className="text-xs text-gray-300 mt-2">
            {formatDate(ub.awardedAt)}
          </p>
        </div>
      ))}
    </div>
  );
}
