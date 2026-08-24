'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Award,
  Search,
  Plus,
  RefreshCw,
  Gift,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Users,
  Star,
  Zap,
  Shield,
  Trophy,
  Crown,
  Flame,
  Heart,
  MessageCircle,
  Eye,
  ThumbsUp,
  Download,
  Edit,
  Trash2,
  Filter,
  Settings,
  Info,
  Loader2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: string;
  category: string;
  sortOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
}

interface AwardRecord {
  id: string;
  badgeId: string;
  userId: string;
  awardedAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
  reason: string | null;
  badge: Badge;
  user: User;
}

const CATEGORIES = [
  { value: 'activity', label: '活跃度', icon: Zap },
  { value: 'quality', label: '质量贡献', icon: Star },
  { value: 'community', label: '社区贡献', icon: Heart },
  { value: 'special', label: '特殊成就', icon: Trophy },
];

export default function BadgesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [badges, setBadges] = useState<Badge[]>([]);
  const [awards, setAwards] = useState<AwardRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAwardDialog, setShowAwardDialog] = useState(false);
  const [showRevokerDialog, setShowRevokerDialog] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [reason, setReason] = useState('');
  const [searchUsers, setSearchUsers] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'revoked'>('all');
  const [expandedBadge, setExpandedBadge] = useState<string | null>(null);

  // Fetch badges
  const fetchBadges = useCallback(async () => {
    try {
      const response = await fetch('/api/badges');
      if (response.ok) {
        const data = await response.json();
        setBadges(data);
      }
    } catch (error) {
      console.error('Failed to fetch badges:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch awards
  const fetchAwards = useCallback(async () => {
    try {
      const response = await fetch('/api/badges');
      if (response.ok) {
        const data = await response.json();
        setAwards(data.awards || []);
      }
    } catch (error) {
      console.error('Failed to fetch awards:', error);
    }
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users?page=1&limit=100');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }, []);

  useEffect(() => {
    fetchBadges();
    fetchAwards();
    fetchUsers();
  }, [fetchBadges, fetchAwards, fetchUsers]);

  // Filter badges
  const filteredBadges = badges.filter((badge) => {
    const matchesSearch =
      badge.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      badge.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || badge.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Filter awards
  const filteredAwards = awards.filter((award) => {
    const matchesSearch =
      award.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      award.badge.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && !award.revokedAt) ||
      (filterStatus === 'revoked' && award.revokedAt);
    return matchesSearch && matchesStatus;
  });

  // Award badge to user
  const handleAwardBadge = async () => {
    if (!selectedBadge || !selectedUser) return;

    try {
      const response = await fetch(`/api/badges/${selectedBadge.id}/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          reason: reason || '手动授予',
        }),
      });

      if (response.ok) {
        setShowAwardDialog(false);
        setSelectedBadge(null);
        setSelectedUser(null);
        setReason('');
        fetchBadges();
        fetchAwards();
      }
    } catch (error) {
      console.error('Failed to award badge:', error);
    }
  };

  // Revoke badge
  const handleRevokeBadge = async (awardId: string) => {
    if (!reason) {
      alert('请填写撤销原因');
      return;
    }

    try {
      const response = await fetch(`/api/badges/awards/${awardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
        }),
      });

      if (response.ok) {
        setShowRevokerDialog(false);
        setReason('');
        fetchAwards();
      }
    } catch (error) {
      console.error('Failed to revoke badge:', error);
    }
  };

  // Toggle badge enabled status
  const handleToggleBadge = async (badgeId: string) => {
    try {
      const response = await fetch(`/api/badges/${badgeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isEnabled: !badges.find((b) => b.id === badgeId)?.isEnabled,
        }),
      });

      if (response.ok) {
        fetchBadges();
      }
    } catch (error) {
      console.error('Failed to toggle badge:', error);
    }
  };

  // Delete badge
  const handleDeleteBadge = async (badgeId: string) => {
    if (!confirm('确定要删除这个徽章吗？此操作不可恢复。')) return;

    try {
      const response = await fetch(`/api/badges/${badgeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchBadges();
        fetchAwards();
      }
    } catch (error) {
      console.error('Failed to delete badge:', error);
    }
  };

  // Get icon component
  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, React.ElementType> = {
      Zap,
      Star,
      Shield,
      Trophy,
      Crown,
      Flame,
      Heart,
      MessageCircle,
      Eye,
      ThumbsUp,
      Download,
      Award,
      Users,
      Gift,
    };
    return iconMap[iconName] || Award;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">徽章管理</h1>
          <p className="text-muted-foreground">管理系统徽章和授予记录</p>
        </div>
        <Button onClick={fetchBadges} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      <Tabs defaultValue="badges" className="space-y-6">
        <TabsList>
          <TabsTrigger value="badges">徽章列表</TabsTrigger>
          <TabsTrigger value="awards">授予记录</TabsTrigger>
        </TabsList>

        <TabsContent value="badges" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索徽章..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            {filteredBadges.map((badge) => {
              const IconComponent = getIconComponent(badge.icon);
              const isExpanded = expandedBadge === badge.id;

              return (
                <Card key={badge.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <IconComponent className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {badge.name}
                            <Badge
                              variant={badge.isEnabled ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {badge.isEnabled ? '启用' : '禁用'}
                            </Badge>
                          </CardTitle>
                          <CardDescription>{badge.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleBadge(badge.id)}
                              >
                                {badge.isEnabled ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {badge.isEnabled ? '禁用徽章' : '启用徽章'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteBadge(badge.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>删除徽章</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setExpandedBadge(isExpanded ? null : badge.id)
                          }
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">授予条件</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {badge.criteria}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>排序: {badge.sortOrder}</span>
                        <span>•</span>
                        <span>
                          更新于{' '}
                          {new Date(badge.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {filteredBadges.length === 0 && (
            <div className="text-center py-12">
              <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">暂无徽章</h3>
              <p className="text-muted-foreground">
                没有找到匹配的徽章，请调整搜索条件
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="awards" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户或徽章..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as 'all' | 'active' | 'revoked')}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">已授予</SelectItem>
                <SelectItem value="revoked">已撤销</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {filteredAwards.map((award) => (
              <Card key={award.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={award.user.avatar || '/placeholder-avatar.png'}
                        alt={award.user.username}
                        className="h-10 w-10 rounded-full"
                      />
                      <div>
                        <p className="font-medium">{award.user.username}</p>
                        <p className="text-sm text-muted-foreground">
                          {award.badge.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {award.revokedAt ? '已撤销' : '已授予'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(
                            award.revokedAt || award.awardedAt,
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      {!award.revokedAt && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedBadge(award.badge);
                                  setSelectedUser(award.user);
                                  setShowRevokerDialog(true);
                                }}
                              >
                                <XCircle className="h-4 w-4 text-red-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>撤销徽章</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                  {award.reason && (
                    <div className="mt-3 text-sm text-muted-foreground">
                      {award.revokedAt ? '撤销原因: ' + award.reason : '授予原因: ' + award.reason}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredAwards.length === 0 && (
            <div className="text-center py-12">
              <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">暂无授予记录</h3>
              <p className="text-muted-foreground">还没有徽章授予记录</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Award Dialog */}
      <Dialog open={showAwardDialog} onOpenChange={setShowAwardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>授予徽章</DialogTitle>
            <DialogDescription>
              选择要授予徽章的用户
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="user-search">搜索用户</Label>
              <Input
                id="user-search"
                placeholder="输入用户名..."
                value={searchUsers}
                onChange={(e) => setSearchUsers(e.target.value)}
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {users
                .filter((u) =>
                  u.username.toLowerCase().includes(searchUsers.toLowerCase()),
                )
                .map((user) => (
                  <Button
                    key={user.id}
                    variant={selectedUser?.id === user.id ? 'default' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => setSelectedUser(user)}
                  >
                    <img
                      src={user.avatar || '/placeholder-avatar.png'}
                      alt={user.username}
                      className="h-5 w-5 rounded-full mr-2"
                    />
                    {user.username}
                  </Button>
                ))}
            </div>
            <div>
              <Label htmlFor="reason">授予原因</Label>
              <Input
                id="reason"
                placeholder="可选，填写授予原因..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAwardDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleAwardBadge}
              disabled={!selectedUser}
            >
              授予
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={showRevokerDialog} onOpenChange={setShowRevokerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>撤销徽章</DialogTitle>
            <DialogDescription>
              确认要撤销 {selectedUser?.username} 的 {selectedBadge?.name} 徽章吗？
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="revoke-reason">撤销原因（必填）</Label>
              <Input
                id="revoke-reason"
                placeholder="请填写撤销原因..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRevokerDialog(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedBadge && selectedUser) {
                  const award = awards.find(
                    (a) =>
                      a.badgeId === selectedBadge.id &&
                      a.userId === selectedUser.id,
                  );
                  if (award) {
                    handleRevokeBadge(award.id);
                  }
                }
              }}
              disabled={!reason}
            >
              确认撤销
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
