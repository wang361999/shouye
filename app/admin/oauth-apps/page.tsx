'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Plus, Trash2, Check, X, Loader2, Key, Eye, EyeOff, RefreshCw, Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/store/appStore';

// OAuth 应用接口
interface OAuthApp {
  id: string;
  name: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  isActive: boolean;
  scope: string;
  createdAt: string;
  updatedAt: string;
}

// API 请求配置
const API_BASE = '/api';

export default function OAuthAppsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { token } = useAppStore();
  const [apps, setApps] = useState<OAuthApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  
  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    redirectUri: '',
    scope: 'read',
  });
  
  // 编辑状态
  const [editingApp, setEditingApp] = useState<OAuthApp | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    redirectUri: '',
    scope: 'read',
    isActive: true,
  });

  // 获取应用列表
  const fetchApps = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/admin/oauth-apps`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('获取应用列表失败');
      }
      
      const data = await response.json();
      setApps(data.apps || []);
    } catch (error) {
      console.error('获取 OAuth 应用列表失败:', error);
      toast({
        title: '加载失败',
        description: '获取 OAuth 应用列表失败，请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  // 创建应用
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: '验证失败',
        description: '请输入应用名称',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${API_BASE}/api/admin/oauth-apps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '创建失败');
      }

      toast({
        title: '创建成功',
        description: 'OAuth 应用已创建',
      });

      // 重置表单
      setFormData({ name: '', redirectUri: '', scope: 'read' });
      fetchApps();
    } catch (error) {
      console.error('创建 OAuth 应用失败:', error);
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 更新应用
  const handleUpdate = async (id: string) => {
    if (!editFormData.name.trim()) {
      toast({
        title: '验证失败',
        description: '请输入应用名称',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${API_BASE}/api/admin/oauth-apps/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(editFormData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '更新失败');
      }

      toast({
        title: '更新成功',
        description: 'OAuth 应用已更新',
      });

      setEditingApp(null);
      fetchApps();
    } catch (error) {
      console.error('更新 OAuth 应用失败:', error);
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 删除应用
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除应用 "${name}" 吗？此操作不可恢复！`)) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${API_BASE}/api/admin/oauth-apps/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '删除失败');
      }

      toast({
        title: '删除成功',
        description: 'OAuth 应用已删除',
      });

      fetchApps();
    } catch (error) {
      console.error('删除 OAuth 应用失败:', error);
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 切换应用状态
  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/oauth-apps/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        throw new Error('状态更新失败');
      }

      toast({
        title: '状态已更新',
        description: `应用已${isActive ? '启用' : '禁用'}`,
      });

      fetchApps();
    } catch (error) {
      console.error('更新应用状态失败:', error);
      toast({
        title: '更新失败',
        description: '状态更新失败，请稍后重试',
        variant: 'destructive',
      });
    }
  };

  // 生成客户端ID
  const generateClientId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // 生成客户端密钥
  const generateClientSecret = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < 48; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // 显示/隐藏密钥
  const toggleShowSecret = (id: string) => {
    setShowSecret(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 复制客户端ID或密钥
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: '复制成功',
        description: `${type} 已复制到剪贴板`,
      });
    } catch (error) {
      toast({
        title: '复制失败',
        description: '无法复制到剪贴板',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">OAuth 应用管理</h1>
          <p className="text-muted-foreground mt-1">管理第三方应用的 OAuth 授权配置</p>
        </div>
        <Button onClick={() => router.push('/admin/settings/security')}>
          <Shield className="h-4 w-4 mr-2" />
          安全设置
        </Button>
      </div>

      {/* 创建应用表单 */}
      <Card>
        <CardHeader>
          <CardTitle>创建新应用</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">应用名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例如：我的测试应用"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope">授权范围</Label>
              <select
                id="scope"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.scope}
                onChange={(e) => setFormData(prev => ({ ...prev, scope: e.target.value }))}
              >
                <option value="read">仅读取</option>
                <option value="write">读取和写入</option>
                <option value="admin">管理员权限</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="redirectUri">回调 URL</Label>
            <Input
              id="redirectUri"
              value={formData.redirectUri}
              onChange={(e) => setFormData(prev => ({ ...prev, redirectUri: e.target.value }))}
              placeholder="https://example.com/auth/callback"
            />
            <p className="text-xs text-muted-foreground">应用完成授权后重定向到的 URL</p>
          </div>
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Plus className="h-4 w-4 mr-2" />
            创建应用
          </Button>
        </CardContent>
      </Card>

      {/* 应用列表 */}
      <Card>
        <CardHeader>
          <CardTitle>已配置的应用 ({apps.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {apps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无已配置的 OAuth 应用</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apps.map((app) => (
                <div key={app.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg">{app.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant={app.isActive ? 'default' : 'secondary'}>
                          {app.isActive ? '已启用' : '已禁用'}
                        </Badge>
                        <span>创建时间: {new Date(app.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingApp(app);
                          setEditFormData({
                            name: app.name,
                            redirectUri: app.redirectUri,
                            scope: app.scope,
                            isActive: app.isActive,
                          });
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(app.id, app.name)}
                        disabled={submitting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <div className="font-medium">客户端 ID</div>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-xs font-mono break-all flex-1">
                          {app.clientId}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => copyToClipboard(app.clientId, '客户端 ID')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium">客户端密钥</div>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-xs font-mono break-all flex-1">
                          {showSecret[app.id] ? app.clientSecret : '••••••••••••••••••••••••••••••••'}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => toggleShowSecret(app.id)}
                        >
                          {showSecret[app.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => copyToClipboard(app.clientSecret, '客户端密钥')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <div className="font-medium">回调 URL</div>
                      <code className="bg-muted px-2 py-1 rounded text-xs font-mono break-all">
                        {app.redirectUri || '未设置'}
                      </code>
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium">授权范围</div>
                      <Badge variant="outline">{app.scope}</Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      最后更新: {new Date(app.updatedAt).toLocaleString()}
                    </span>
                    <Button
                      size="sm"
                      variant={app.isActive ? 'destructive' : 'default'}
                      onClick={() => handleToggleStatus(app.id, !app.isActive)}
                    >
                      {app.isActive ? '禁用应用' : '启用应用'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 编辑应用对话框 */}
      <Dialog open={!!editingApp} onOpenChange={(open) => !open && setEditingApp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑 OAuth 应用</DialogTitle>
            <DialogDescription>
              修改应用的基本配置信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">应用名称 *</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-redirectUri">回调 URL</Label>
              <Input
                id="edit-redirectUri"
                value={editFormData.redirectUri}
                onChange={(e) => setEditFormData(prev => ({ ...prev, redirectUri: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-scope">授权范围</Label>
              <select
                id="edit-scope"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={editFormData.scope}
                onChange={(e) => setEditFormData(prev => ({ ...prev, scope: e.target.value }))}
              >
                <option value="read">仅读取</option>
                <option value="write">读取和写入</option>
                <option value="admin">管理员权限</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-isActive"
                checked={editFormData.isActive}
                onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="edit-isActive">应用状态</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingApp(null)}>
              取消
            </Button>
            <Button onClick={() => editingApp && handleUpdate(editingApp.id)} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存更改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
