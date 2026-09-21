'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Search, Trash2, Award, Users, Gift } from 'lucide-react';
import { toast } from 'sonner';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  criterion: string;
  criterionType: 'posts' | 'likes' | 'comments' | 'checkin' | 'followers' | 'custom';
  threshold: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  username: string;
  email: string;
}

export default function BadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [awardingUserId, setAwardingUserId] = useState('');
  const [selectedBadgeId, setSelectedBadgeId] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [awarding, setAwarding] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'star',
    criterion: 'posts' as Badge['criterionType'],
    threshold: 1,
    sortOrder: 0,
  });

  // 获取徽章列表
  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/badges');
      if (!response.ok) throw new Error('获取徽章列表失败');
      const data = await response.json();
      setBadges(data);
    } catch (error) {
      console.error('获取徽章失败:', error);
      toast.error('获取徽章列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取用户列表
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch('/api/admin/users?take=100');
      if (!response.ok) throw new Error('获取用户列表失败');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('获取用户失败:', error);
      toast.error('获取用户列表失败');
    } finally {
      setLoadingUsers(false);
    }
  };

  // 创建徽章
  const handleCreate = async () => {
    if (!formData.name || !formData.description) {
      toast.error('请填写必填项');
      return;
    }

    try {
      const response = await fetch('/api/badges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '创建失败');
      }

      toast.success('徽章创建成功');
      setShowCreateDialog(false);
      setFormData({
        name: '',
        description: '',
        icon: 'star',
        criterion: 'posts',
        threshold: 1,
        sortOrder: 0,
      });
      fetchBadges();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建失败');
    }
  };

  // 更新徽章
  const handleUpdate = async () => {
    if (!editingBadge) return;

    try {
      const response = await fetch(`/api/badges/${editingBadge.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '更新失败');
      }

      toast.success('徽章更新成功');
      setShowEditDialog(false);
      setEditingBadge(null);
      fetchBadges();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失败');
    }
  };

  // 删除徽章
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个徽章吗？')) return;

    try {
      const response = await fetch(`/api/badges/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '删除失败');
      }

      toast.success('徽章删除成功');
      fetchBadges();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  // 颁发徽章
  const handleAward = async () => {
    if (!selectedBadgeId || !awardingUserId) {
      toast.error('请选择徽章和用户');
      return;
    }

    try {
      setAwarding(true);
      const response = await fetch(`/api/badges/${selectedBadgeId}/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: rewardingUserId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '颁发失败');
      }

      toast.success('徽章颁发成功');
      setShowAwardDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '颁发失败');
    } finally {
      setAwarding(false);
    }
  };

  // 搜索徽章
  const filteredBadges = badges.filter(
    (badge) =>
      badge.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      badge.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 图标准确映射
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'star':
        return <Award className="w-5 h-5 text-yellow-500" />;
      case 'users':
        return <Users className="w-5 h-5 text-blue-500" />;
      case 'gift':
        return <Gift className="w-5 h-5 text-green-500" />;
      case 'heart':
        return <span className="text-red-500">❤️</span>;
      case 'check':
        return <span className="text-green-500">✓</span>;
      default:
        return <Award className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">徽章管理</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          创建徽章
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>徽章列表</CardTitle>
          <CardDescription>管理系统中的徽章奖励</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索徽章..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredBadges.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无徽章
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>图标</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>获取条件</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBadges.map((badge) => (
                  <TableRow key={badge.id}>
                    <TableCell>{getIconComponent(badge.icon)}</TableCell>
                    <TableCell className="font-medium">{badge.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{badge.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {badge.threshold} {badge.criterion === 'posts' ? '帖子' :
                         badge.criterion === 'likes' ? '点赞' :
                         badge.criterion === 'comments' ? '评论' :
                         badge.criterion === 'checkin' ? '签到' :
                         badge.criterion === 'followers' ? '粉丝' : '自定义'}
                      </Badge>
                    </TableCell>
                    <TableCell>{badge.sortOrder}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingBadge(badge);
                            setFormData({
                              name: badge.name,
                              description: badge.description,
                              icon: badge.icon,
                              criterion: badge.criterion,
                              threshold: badge.threshold,
                              sortOrder: badge.sortOrder,
                            });
                            setShowEditDialog(true);
                          }}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(badge.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 创建徽章对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建徽章</DialogTitle>
            <DialogDescription>
              创建一个新的徽章奖励
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">徽章名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入徽章名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述 *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="输入徽章描述"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon">图标</Label>
              <Select
                value={formData.icon}
                onValueChange={(value) => setFormData({ ...formData, icon: value })}
              >
                <SelectTrigger id="icon">
                  <SelectValue placeholder="选择图标" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="star">⭐ Star</SelectItem>
                  <SelectItem value="users">👥 Users</SelectItem>
                  <SelectItem value="gift">🎁 Gift</SelectItem>
                  <SelectItem value="heart">❤️ Heart</SelectItem>
                  <SelectItem value="check">✅ Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="criterion">获取条件类型</Label>
              <Select
                value={formData.criterion}
                onValueChange={(value: Badge['criterionType']) =>
                  setFormData({ ...formData, criterion: value })
                }
              >
                <SelectTrigger id="criterion">
                  <SelectValue placeholder="选择条件类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="posts">发帖数量</SelectItem>
                  <SelectItem value="likes">获得点赞数</SelectItem>
                  <SelectItem value="comments">评论数量</SelectItem>
                  <SelectItem value="checkin">签到天数</SelectItem>
                  <SelectItem value="followers">粉丝数量</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">阈值</Label>
              <Input
                id="threshold"
                type="number"
                min="1"
                value={formData.threshold}
                onChange={(e) =>
                  setFormData({ ...formData, threshold: parseInt(e.target.value) || 1 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">排序权重</Label>
              <Input
                id="sortOrder"
                type="number"
                value={formData.sortOrder}
                onChange={(e) =>
                  setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreate}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑徽章对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑徽章</DialogTitle>
            <DialogDescription>
              修改徽章信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">徽章名称 *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入徽章名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">描述 *</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="输入徽章描述"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-icon">图标</Label>
              <Select
                value={formData.icon}
                onValueChange={(value) => setFormData({ ...formData, icon: value })}
              >
                <SelectTrigger id="edit-icon">
                  <SelectValue placeholder="选择图标" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="star">⭐ Star</SelectItem>
                  <SelectItem value="users">👥 Users</SelectItem>
                  <SelectItem value="gift">🎁 Gift</SelectItem>
                  <SelectItem value="heart">❤️ Heart</SelectItem>
                  <SelectItem value="check">✅ Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-criterion">获取条件类型</Label>
              <Select
                value={formData.criterion}
                onValueChange={(value: Badge['criterionType']) =>
                  setFormData({ ...formData, criterion: value })
                }
              >
                <SelectTrigger id="edit-criterion">
                  <SelectValue placeholder="选择条件类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="posts">发帖数量</SelectItem>
                  <SelectItem value="likes">获得点赞数</SelectItem>
                  <SelectItem value="comments">评论数量</SelectItem>
                  <SelectItem value="checkin">签到天数</SelectItem>
                  <SelectItem value="followers">粉丝数量</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-threshold">阈值</Label>
              <Input
                id="edit-threshold"
                type="number"
                min="1"
                value={formData.threshold}
                onChange={(e) =>
                  setFormData({ ...formData, threshold: parseInt(e.target.value) || 1 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sort-order">排序权重</Label>
              <Input
                id="edit-sort-order"
                type="number"
                value={formData.sortOrder}
                onChange={(e) =>
                  setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleUpdate}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 颁发徽章对话框 */}
      <Dialog open={showAwardDialog} onOpenChange={setShowAwardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>颁发徽章</DialogTitle>
            <DialogDescription>
              选择用户颁发徽章
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>选择用户</Label>
              <Select
                value={awardingUserId}
                onValueChange={setAwardingUserId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择用户" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>选择徽章</Label>
              <Select
                value={selectedBadgeId}
                onValueChange={setSelectedBadgeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择徽章" />
                </SelectTrigger>
                <SelectContent>
                  {badges.map((badge) => (
                    <SelectItem key={badge.id} value={badge.id}>
                      {badge.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAwardDialog(false)}>
              取消
            </Button>
            <Button onClick={handleAward} disabled={awarding}>
              {awarding ? '颁发中...' : '颁发'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
