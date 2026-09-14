'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Award,
  Check,
  Search,
  Filter,
  Star,
  Users,
  RefreshCw,
  Crown,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  type: 'forum' | 'purchase' | 'achievement' | 'custom';
  criteria: string;
  isActive: boolean;
  awardCount: number;
  createdAt: string;
}

const DEFAULT_BADGES: Badge[] = [
  {
    id: 'first-post',
    name: '初露头角',
    description: '发布第一篇论坛帖子',
    icon: '📝',
    color: '#10B981',
    type: 'forum',
    criteria: '发布一篇被审核通过的帖子',
    isActive: true,
    awardCount: 0,
    createdAt: '2024-01-01',
  },
  {
    id: 'active-contributor',
    name: '活跃贡献者',
    description: '累计发布10篇优质帖子',
    icon: '🔥',
    color: '#F59E0B',
    type: 'forum',
    criteria: '累计发布10篇被审核通过的帖子',
    isActive: true,
    awardCount: 0,
    createdAt: '2024-01-01',
  },
  {
    id: 'community-helper',
    name: '社区帮手',
    description: '获得50次评论点赞',
    icon: '💬',
    color: '#3B82F6',
    type: 'forum',
    criteria: '你的评论累计获得50个赞',
    isActive: true,
    awardCount: 0,
    createdAt: '2024-01-01',
  },
  {
    id: 'first-purchase',
    name: '首购支持',
    description: '完成第一笔产品购买',
    icon: '🛒',
    color: '#8B5CF6',
    type: 'purchase',
    criteria: '购买任意一个产品',
    isActive: true,
    awardCount: 0,
    createdAt: '2024-01-01',
  },
  {
    id: 'premium-member',
    name: '高级会员',
    description: '订阅3个月以上的高级套餐',
    icon: '💎',
    color: '#EC4899',
    type: 'purchase',
    criteria: '连续订阅高级套餐3个月',
    isActive: true,
    awardCount: 0,
    createdAt: '2024-01-01',
  },
  {
    id: 'bug-finder',
    name: '漏洞猎手',
    description: '报告并经确认的有效Bug',
    icon: '🐛',
    color: '#EF4444',
    type: 'achievement',
    criteria: '报告一个被确认的有效漏洞',
    isActive: true,
    awardCount: 0,
    createdAt: '2024-01-01',
  },
];

export default function BadgesPage() {
  const router = useRouter();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 新增/编辑表单状态
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    color: '#3B82F6',
    type: 'forum' as Badge['type'],
    criteria: '',
    isActive: true,
  });

  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/badges');
      if (res.ok) {
        const data = await res.json();
        setBadges(data.badges || DEFAULT_BADGES);
      } else {
        setBadges(DEFAULT_BADGES);
      }
    } catch {
      setBadges(DEFAULT_BADGES);
    } finally {
      setLoading(false);
    }
  };

  const filteredBadges = badges.filter((badge) => {
    const matchesSearch =
      badge.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      badge.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || badge.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleCreateOrUpdate = async () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      alert('请填写名称和描述');
      return;
    }

    setIsSaving(true);
    try {
      const method = editingBadge ? 'PATCH' : 'POST';
      const body = editingBadge
        ? { ...formData, id: editingBadge.id }
        : formData;

      const res = await fetch('/api/badges', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setEditingBadge(null);
        setFormData({
          name: '',
          description: '',
          icon: '',
          color: '#3B82F6',
          type: 'forum',
          criteria: '',
          isActive: true,
        });
        fetchBadges();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleBadgeStatus = async (badge: Badge) => {
    try {
      const res = await fetch(`/api/badges/${badge.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !badge.isActive }),
      });
      if (res.ok) {
        fetchBadges();
      }
    } catch {
      // ignore
    }
  };

  const openEditModal = (badge: Badge) => {
    setEditingBadge(badge);
    setFormData({
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      color: badge.color,
      type: badge.type,
      criteria: badge.criteria,
      isActive: badge.isActive,
    });
    setShowCreateModal(true);
  };

  const openCreateModal = () => {
    setEditingBadge(null);
    setFormData({
      name: '',
      description: '',
      icon: '',
      color: '#3B82F6',
      type: 'forum',
      criteria: '',
      isActive: true,
    });
    setShowCreateModal(true);
  };

  const deleteBadge = async (id: string) => {
    try {
      const res = await fetch(`/api/badges/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setShowDeleteConfirm(null);
        fetchBadges();
      }
    } catch {
      // ignore
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      forum: '论坛行为',
      purchase: '购买行为',
      achievement: '成就',
      custom: '自定义',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">徽章管理</h1>
          <p className="text-muted-foreground mt-1">
            管理系统徽章，自动奖励给用户
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          新建徽章
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索徽章..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
        >
          <option value="all">全部类型</option>
          <option value="forum">论坛行为</option>
          <option value="purchase">购买行为</option>
          <option value="achievement">成就</option>
          <option value="custom">自定义</option>
        </select>
        <Button variant="outline" size="icon" onClick={fetchBadges}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Award className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{badges.length}</p>
                <p className="text-xs text-muted-foreground">总徽章数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {badges.filter((b) => b.isActive).length}
                </p>
                <p className="text-xs text-muted-foreground">已启用</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {badges.reduce((sum, b) => sum + b.awardCount, 0)}
                </p>
                <p className="text-xs text-muted-foreground">已发放</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Star className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {new Set(badges.map((b) => b.type)).size}
                </p>
                <p className="text-xs text-muted-foreground">类型数</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 徽章列表 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredBadges.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>没有找到匹配的徽章</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBadges.map((badge) => (
            <Card key={badge.id} className="relative group">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div
                    className="text-4xl"
                    style={{ color: badge.color }}
                  >
                    {badge.icon || '🏅'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{badge.name}</h3>
                      <Badge
                        variant={badge.isActive ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {badge.isActive ? '启用' : '禁用'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {badge.description}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span>{getTypeLabel(badge.type)}</span>
                      <span>·</span>
                      <span>{badge.awardCount} 人已获得</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      <span className="font-medium">条件：</span>
                      {badge.criteria}
                    </p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => toggleBadgeStatus(badge)}
                  >
                    {badge.isActive ? (
                      <>
                        <X className="h-3 w-3 mr-1" />
                        禁用
                      </>
                    ) : (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        启用
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(badge)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(badge.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>

              {/* 删除确认 */}
              {showDeleteConfirm === badge.id && (
                <div className="absolute inset-0 bg-background/95 backdrop-blur-sm rounded-lg flex items-center justify-center p-4">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                    <p className="text-sm font-medium">确认删除徽章？</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      此操作不可撤销
                    </p>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(null)}
                      >
                        取消
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteBadge(badge.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* 创建/编辑 Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {editingBadge ? '编辑徽章' : '新建徽章'}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCreateModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">徽章名称 *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="例如：初露头角"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">描述 *</label>
                  <Input
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="简短描述此徽章的获得条件"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">图标 Emoji</label>
                  <Input
                    value={formData.icon}
                    onChange={(e) =>
                      setFormData({ ...formData, icon: e.target.value })
                    }
                    placeholder="例如：🏅"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">颜色</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">类型</label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as Badge['type'],
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  >
                    <option value="forum">论坛行为</option>
                    <option value="purchase">购买行为</option>
                    <option value="achievement">成就</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">获得条件</label>
                  <textarea
                    value={formData.criteria}
                    onChange={(e) =>
                      setFormData({ ...formData, criteria: e.target.value })
                    }
                    placeholder="描述用户需要满足什么条件才能获得此徽章"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background resize-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isActive: e.target.checked,
                      })
                    }
                    className="rounded"
                  />
                  <label htmlFor="isActive" className="text-sm">
                    默认启用
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  取消
                </Button>
                <Button onClick={handleCreateOrUpdate} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingBadge ? '保存修改' : '创建徽章'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
