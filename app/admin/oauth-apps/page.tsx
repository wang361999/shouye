'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Key,
  Plus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Loader2,
  Settings,
  Shield,
} from 'lucide-react';
import Image from 'next/image';

interface OAuthApp {
  id: string;
  name: string;
  description: string;
  logo: string;
  homepageUrl: string;
  redirectUris: string[];
  clientId: string;
  clientSecret: string;
  scopes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function OAuthAppsPage() {
  const [apps, setApps] = useState<OAuthApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingApp, setEditingApp] = useState<OAuthApp | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [token, setToken] = useState('');

  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo: '',
    homepageUrl: '',
    redirectUris: [''] as string[],
    scopes: ['read'] as string[],
    isActive: true,
  });

  useEffect(() => {
    const stored = localStorage.getItem('admin_token');
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (token) {
      fetchApps();
    }
  }, [token]);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/oauth/app-info', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApps(data.apps || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!formData.name.trim()) {
      alert('请填写应用名称');
      return;
    }

    setIsSaving(true);
    try {
      const method = editingApp ? 'PATCH' : 'POST';
      const body = editingApp
        ? { ...formData, id: editingApp.id }
        : formData;

      const res = await fetch('/api/oauth/app-info', {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setEditingApp(null);
        setFormData({
          name: '',
          description: '',
          logo: '',
          homepageUrl: '',
          redirectUris: [''],
          scopes: ['read'],
          isActive: true,
        });
        fetchApps();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const deleteApp = async (id: string) => {
    if (!confirm('确定要删除这个应用吗？所有授权记录将被保留但无法重新授权。')) return;

    try {
      const res = await fetch(`/api/oauth/app-info?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchApps();
      }
    } catch {
      // ignore
    }
  };

  const toggleAppStatus = async (app: OAuthApp) => {
    try {
      const res = await fetch(`/api/oauth/app-info/${app.id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !app.isActive }),
      });

      if (res.ok) {
        fetchApps();
      }
    } catch {
      // ignore
    }
  };

  const openEditModal = (app: OAuthApp) => {
    setEditingApp(app);
    setFormData({
      name: app.name,
      description: app.description,
      logo: app.logo,
      homepageUrl: app.homepageUrl,
      redirectUris: app.redirectUris.length > 0 ? app.redirectUris : [''],
      scopes: app.scopes.length > 0 ? app.scopes : ['read'],
      isActive: app.isActive,
    });
    setShowCreateModal(true);
  };

  const openCreateModal = () => {
    setEditingApp(null);
    setFormData({
      name: '',
      description: '',
      logo: '',
      homepageUrl: '',
      redirectUris: [''],
      scopes: ['read'],
      isActive: true,
    });
    setShowCreateModal(true);
  };

  const addRedirectUri = () => {
    setFormData({ ...formData, redirectUris: [...formData.redirectUris, ''] });
  };

  const removeRedirectUri = (index: number) => {
    const newUris = [...formData.redirectUris];
    newUris.splice(index, 1);
    setFormData({ ...formData, redirectUris: newUris });
  };

  const toggleScope = (scope: string) => {
    const currentScopes = formData.scopes;
    if (currentScopes.includes(scope)) {
      setFormData({
        ...formData,
        scopes: currentScopes.filter(s => s !== scope),
      });
    } else {
      setFormData({ ...formData, scopes: [...currentScopes, scope] });
    }
  };

  const SCOPES = [
    { value: 'read', label: '读取基本信息', description: '允许读取公开信息' },
    { value: 'profile', label: '读取个人资料', description: '允许读取用户个人资料' },
    { value: 'email', label: '读取邮箱', description: '允许读取用户邮箱地址' },
    { value: 'write', label: '写入内容', description: '允许发布内容和评论' },
    { value: 'admin', label: '管理员权限', description: '允许访问管理接口' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">OAuth 应用管理</h1>
          <p className="text-muted-foreground mt-1">
            管理第三方应用的 OAuth 授权配置
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          新建应用
        </Button>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{apps.length}</p>
                <p className="text-xs text-muted-foreground">总应用数</p>
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
                  {apps.filter(a => a.isActive).length}
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
                <Shield className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {apps.reduce((sum, a) => sum + a.redirectUris.length, 0)}
                </p>
                <p className="text-xs text-muted-foreground">回调地址</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Settings className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {new Set(apps.flatMap(a => a.scopes)).size}
                </p>
                <p className="text-xs text-muted-foreground">权限类型</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 应用列表 */}
      {loading ? (
        <div className="grid grid-cols-1 md
