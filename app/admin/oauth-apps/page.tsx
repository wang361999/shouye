'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Trash2, Edit2, Plus, Key, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface OAuthApp {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function OAuthAppsPage() {
  const [apps, setApps] = useState<OAuthApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingApp, setEditingApp] = useState<OAuthApp | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    redirectUri: '',
    description: '',
    isActive: true,
  });

  // 获取应用列表
  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/oauth-apps');
      if (!response.ok) throw new Error('获取应用列表失败');
      const data = await response.json();
      setApps(data.apps || []);
    } catch (error) {
      console.error('获取应用失败:', error);
      toast.error('获取应用列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建应用
  const handleCreate = async () => {
    if (!formData.name || !formData.redirectUri) {
      toast.error('请填写必填项');
      return;
    }

    try {
      const response = await fetch('/api/admin/oauth-apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '创建失败');
      }

      toast.success('应用创建成功');
      setShowCreateDialog(false);
      setFormData({
        name: '',
        redirectUri: '',
        description: '',
        isActive: true,
      });
      fetchApps();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建失败');
    }
  };

  // 更新应用
  const handleUpdate = async () => {
    if (!editingApp) return;

    try {
      const response = await fetch(`/api/admin/oauth-apps/${editingApp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '更新失败');
      }

      toast.success('应用更新成功');
      setShowEditDialog(false);
      setEditingApp(null);
      fetchApps();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失败');
    }
  };

  // 删除应用
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个应用吗？所有使用该应用的授权都将失效。')) return;

    try {
      const response = await fetch(`/api/admin/oauth-apps/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '删除失败');
      }

      toast.success('应用已删除');
      fetchApps();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  // 生成新的 client secret
  const handleRegenerateSecret = async (id: string) => {
    if (!confirm('确定要重新生成 client secret 吗？旧 secret 将立即失效。')) return;

    try {
      const response = await fetch(`/api/admin/oauth-apps/${id}/regenerate-secret`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '重新生成失败');
      }

      toast.success('Client secret 已重新生成');
      fetchApps();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '重新生成失败');
    }
  };

  // 搜索应用
  const filteredApps = apps.filter(
    (app) =>
      app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.redirectUri.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 显示/隐藏 secret
  const toggleSecret = (id: string) => {
    setShowSecret(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">OAuth 应用管理</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          创建应用
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>应用列表</CardTitle>
          <CardDescription>管理 OAuth 第三方登录应用</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索应用..."
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
          ) : filteredApps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无应用
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Redirect URI</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.name}</TableCell>
                    <TableCell>
                      <code className="text-xs">{app.clientId}</code>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <code className="text-xs break-all">{app.redirectUri}</code>
                    </TableCell>
                    <TableCell>
                      {app.isActive ? (
                        <Badge variant="default">启用</Badge>
                      ) : (
                        <Badge variant="destructive">禁用</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(app.createdAt).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingApp(app);
                            setFormData({
                              name: app.name,
                              redirectUri: app.redirectUri,
                              description: app.description || '',
                              isActive: app.isActive,
                            });
                            setShowEditDialog(true);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRegenerateSecret(app.id)}
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSecret(app.id)}
                        >
                          {showSecret[app.id] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(app.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(app.createdAt).toLocaleString('zh-CN')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 创建应用对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建 OAuth 应用</DialogTitle>
            <DialogDescription>
              创建一个新的 OAuth 第三方登录应用
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">应用名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入应用名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="redirectUri">回调地址 *</Label>
              <Input
                id="redirectUri"
                value={formData.redirectUri}
                onChange={(e) => setFormData({ ...formData, redirectUri: e.target.value })}
                placeholder="https://example.com/callback"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="输入应用描述（可选）"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
