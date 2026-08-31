import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Trash2, Edit, Award, Users, Settings, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/hooks/use-admin-auth';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  criteria: string;
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BadgeAward {
  id: string;
  badgeId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  awardedAt: string;
  reason: string;
  badge: {
    name: string;
    icon: string;
    category: string;
  };
}

interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
  role: string;
  badges: BadgeAward[];
}

export default function BadgesPage() {
  const router = useRouter();
  const { admin, loading } = useAdminAuth();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [awards, setAwards] = useState<BadgeAward[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('badges');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '🏆',
    category: 'achievement',
    criteria: '',
    color: '#3B82F6',
    isActive: true,
  });

  useEffect(() => {
    if (!loading && !admin) {
      router.push('/admin/login');
    }
  }, [admin, loading, router]);

  useEffect(() => {
    if (admin) {
      loadBadges();
      loadAwards();
      loadUsers();
    }
  }, [admin]);

  const loadBadges = async () => {
    try {
      const response = await fetch('/api/admin/badges');
      if (response.ok) {
        const data = await response.json();
        setBadges(data.badges || []);
      }
    } catch (error) {
      console.error('Failed to load badges:', error);
    }
  };

  const loadAwards = async () => {
    try {
      const response = await fetch('/api/admin/badges');
      if (response.ok) {
        const data = await response.json();
        setAwards(data.awards || []);
      }
    } catch (error) {
      console.error('Failed to load awards:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = editingBadge
        ? `/api/admin/badges/${editingBadge.id}`
        : '/api/admin/badges';
      const method = editingBadge ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: editingBadge ? '徽章更新成功' : '徽章创建成功',
          description: editingBadge ? '徽章信息已更新' : '新徽章已成功创建',
        });
        setIsDialogOpen(false);
        setEditingBadge(null);
        setFormData({
          name: '',
          description: '',
          icon: '🏆',
          category: 'achievement',
          criteria: '',
          color: '#3B82F6',
          isActive: true,
        });
        loadBadges();
      } else {
        const error = await response.json();
        toast({
          title: '操作失败',
          description: error.error || '请重试',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '网络错误',
        description: '请检查网络连接后重试',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (badge: Badge) => {
    setEditingBadge(badge);
    setFormData({
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      category: badge.category,
      criteria: badge.criteria,
      color: badge.color,
      isActive: badge.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (badgeId: string) => {
    if (!confirm('确定要删除这个徽章吗？此操作不可恢复。')) return;

    try {
      const response = await fetch(`/api/admin/badges/${badgeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: '徽章删除成功',
          description: '徽章已从系统中删除',
        });
        loadBadges();
      } else {
        const error = await response.json();
        toast({
          title: '删除失败',
          description: error.error || '请重试',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '网络错误',
        description: '请检查网络连接后重试',
        variant: 'destructive',
      });
    }
  };

  const handleAwardBadge = async (userId: string, badgeId: string, reason: string) => {
    try {
      const response = await fetch('/api/badges/[id]/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, badgeId, reason }),
      });

      if (response.ok) {
        toast({
          title: '徽章颁发成功',
          description: '已成功颁发徽章给用户',
        });
        loadAwards();
        loadUsers();
      } else {
        const error = await response.json();
        toast({
          title: '颁发失败',
          description: error.error || '请重试',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '网络错误',
        description: '请检查网络连接后重试',
        variant: 'destructive',
      });
    }
  };

  const filteredBadges = badges.filter(badge =>
    badge.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    badge.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAwards = awards.filter(award =>
    award.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    award.badge?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading || !admin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">徽章管理</h1>
          <p className="text-muted-foreground mt-1">管理系统徽章和颁发记录</p>
        </div>
        <Button onClick={() => router.push('/admin')}>
          返回后台
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="badges">徽章列表</TabsTrigger>
          <TabsTrigger value="awards">颁发记录</TabsTrigger>
          <TabsTrigger value="users">用户徽章</TabsTrigger>
        </TabsList>

        <TabsContent value="badges">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>徽章管理</CardTitle>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingBadge(null);
                      setFormData({
                        name: '',
                        description: '',
                        icon: '🏆',
                        category: 'achievement',
                        criteria: '',
                        color: '#3B82F6',
                        isActive: true,
                      });
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      创建徽章
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingBadge ? '编辑徽章' : '创建徽章'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">徽章名称 *</Label>
                          <Input
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="输入徽章名称"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="icon">图标 Emoji</Label>
                          <Input
                            id="icon"
                            name="icon"
                            value={formData.icon}
                            onChange={handleInputChange}
                            placeholder="🏆"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">描述</Label>
                        <Textarea
                          id="description"
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          placeholder="描述徽章的用途和获取条件"
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="category">分类</Label>
                          <Select
                            name="category"
                            value={formData.category}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择分类" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="achievement">成就</SelectItem>
                              <SelectItem value="participation">参与</SelectItem>
                              <SelectItem value="special">特殊</SelectItem>
                              <SelectItem value="contribution">贡献</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="color">颜色</Label>
                          <Input
                            id="color"
                            name="color"
                            type="color"
                            value={formData.color}
                            onChange={handleInputChange}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="criteria">获取条件</Label>
                        <Textarea
                          id="criteria"
                          name="criteria"
                          value={formData.criteria}
                          onChange={handleInputChange}
                          placeholder="描述用户如何获得此徽章"
                          rows={3}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="isActive"
                          name="isActive"
                          checked={formData.isActive}
                          onChange={handleCheckboxChange}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="isActive">启用徽章</Label>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                          取消
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                          {isLoading ? '保存中...' : '保存'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索徽章..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>图标</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBadges.map((badge) => (
                    <TableRow key={badge.id}>
                      <TableCell className="text-2xl">{badge.icon}</TableCell>
                      <TableCell className="font-medium">{badge.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{badge.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {badge.isActive ? (
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            启用
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3 mr-1" />
                            禁用
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{new Date(badge.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(badge)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(badge.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredBadges.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  暂无徽章数据
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="awards">
          <Card>
            <CardHeader>
              <CardTitle>颁发记录</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>徽章</TableHead>
                    <TableHead>原因</TableHead>
                    <TableHead>颁发时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAwards.map((award) => (
                    <TableRow key={award.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {award.userAvatar && (
                            <img
                              src={award.userAvatar}
                              alt={award.userName}
                              className="w-8 h-8 rounded-full"
                            />
                          )}
                          <span className="font-medium">{award.userName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className="text-xl">{award.badge?.icon}</span>
                          <span>{award.badge?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{award.reason}</TableCell>
                      <TableCell>{new Date(award.awardedAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredAwards.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  暂无颁发记录
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>用户徽章</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>徽章数量</TableHead>
                    <TableHead>最近获得</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {user.avatar && (
                            <img
                              src={user.avatar}
                              alt={user.username}
                              className="w-8 h-8 rounded-full"
                            />
                          )}
                          <span className="font-medium">{user.username}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{user.role}</Badge>
                      </TableCell>
                      <TableCell>{user.badges?.length || 0}</TableCell>
                      <TableCell>
                        {user.badges?.[0] ? new Date(user.badges[0].awardedAt).toLocaleDateString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {users.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  暂无用户数据
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
