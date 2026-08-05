'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ---- 新拆分的子组件 ----
import ProfileHeader from '@/components/profile/ProfileHeader';
import EditProfileForm from '@/components/profile/EditProfileForm';
import ChangePasswordForm from '@/components/profile/ChangePasswordForm';
import MyPostsTab from '@/components/profile/MyPostsTab';
import MyCommentsTab from '@/components/profile/MyCommentsTab';
import MyLikesTab from '@/components/profile/MyLikesTab';
import FavoritesTab from '@/components/profile/FavoritesTab';
import BadgesTab from '@/components/profile/BadgesTab';
import type { UserProfile } from '@/components/profile/types';

// ============ 类型定义 ============
type TabKey =
  | 'profile'
  | 'posts'
  | 'comments'
  | 'likes'
  | 'favorites'
  | 'badges';

interface NavItem {
  key: TabKey;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'profile', label: '个人资料', icon: '👤' },
  { key: 'posts', label: '我的帖子', icon: '📝' },
  { key: 'comments', label: '我的评论', icon: '💬' },
  { key: 'likes', label: '我的点赞', icon: '❤️' },
  { key: 'favorites', label: '我的收藏', icon: '⭐' },
  { key: 'badges', label: '我的徽章', icon: '🏅' },
];

// 侧边栏底部快捷链接
const SIDEBAR_LINKS: { href: string; icon: string; label: string }[] = [
  { href: '/profile/licenses', icon: '🔑', label: '我的授权' },
  { href: '/profile/orders', icon: '🛒', label: '我的订单' },
  { href: '/products', icon: '📦', label: '产品中心' },
];

// 个人资料 Tab 下方的快捷入口卡片
const QUICK_LINK_CARDS: {
  href: string;
  icon: string;
  title: string;
  desc: string;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    href: '/profile/licenses',
    icon: '🔑',
    title: '我的授权码',
    desc: '查看授权状态、绑定域名',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    href: '/profile/orders',
    icon: '🛒',
    title: '我的订单',
    desc: '查看订单、支付购买',
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
  },
  {
    href: '/products',
    icon: '📦',
    title: '产品中心',
    desc: '浏览所有产品',
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
  },
];

export default function ProfilePage() {
  const { user, token, hydrate, _hydrated, setAuth, updateAvatar } =
    useAppStore();
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  // ---- 个人资料状态 ----
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

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
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '获取个人资料失败';
      toast.error(message);
    } finally {
      setProfileLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user && token && _hydrated && activeTab === 'profile' && !profile) {
      fetchProfile();
    }
  }, [user, token, _hydrated, activeTab, profile, fetchProfile]);

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
      {/* 返回首页 */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[11px] sm:text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        返回首页
      </Link>

      {/* ========== 用户信息横幅 ========== */}
      <div className="mb-6">
        <ProfileHeader
          profile={profile}
          loading={profileLoading}
          fallbackUser={{ username: user.username, avatar: user.avatar }}
        />
      </div>

      {/* ========== 双栏布局 ========== */}
      <div className="flex gap-6">
        {/* ===== 左侧导航（桌面端） ===== */}
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

            {/* 分隔线 + 快捷链接 */}
            <div className="pt-2 mt-2 border-t border-gray-200 space-y-1">
              {SIDEBAR_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] sm:text-sm font-medium text-gray-600 hover:bg-gray-50 border border-transparent transition-colors"
                >
                  <span className="text-[15px]">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
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
            <div className="space-y-6">
              {/* 编辑资料 */}
              {profile ? (
                <EditProfileForm
                  profile={profile}
                  token={token}
                  user={user}
                  setAuth={setAuth}
                  updateAvatar={updateAvatar}
                />
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-32 mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-48 mb-6" />
                  <div className="space-y-4">
                    <div className="h-10 bg-gray-100 rounded" />
                    <div className="h-10 bg-gray-100 rounded" />
                    <div className="h-20 bg-gray-100 rounded" />
                  </div>
                </div>
              )}

              {/* 修改密码 */}
              <ChangePasswordForm token={token} />

              {/* 快捷入口 */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  🔗 快捷入口
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {QUICK_LINK_CARDS.map((card) => (
                    <Link
                      key={card.href}
                      href={card.href}
                      className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all"
                    >
                      <div
                        className={cn(
                          'w-11 h-11 rounded-lg flex items-center justify-center text-xl mb-3 transition-colors',
                          card.iconBg,
                          card.iconColor,
                        )}
                      >
                        {card.icon}
                      </div>
                      <h3 className="text-[13px] sm:text-sm font-bold text-gray-900">
                        {card.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {card.desc}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============ Tab: 我的帖子 ============ */}
          {activeTab === 'posts' && (
            <MyPostsTab user={user} token={token} />
          )}

          {/* ============ Tab: 我的评论 ============ */}
          {activeTab === 'comments' && (
            <MyCommentsTab user={user} token={token} />
          )}

          {/* ============ Tab: 我的点赞 ============ */}
          {activeTab === 'likes' && (
            <MyLikesTab user={user} token={token} />
          )}

          {/* ============ Tab: 我的收藏 ============ */}
          {activeTab === 'favorites' && (
            <FavoritesTab token={token} user={user} />
          )}

          {/* ============ Tab: 我的徽章 ============ */}
          {activeTab === 'badges' && (
            <BadgesTab token={token} user={user} />
          )}
        </div>
      </div>
    </Container>
  );
}
