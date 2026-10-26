'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Button } from '@/components/admin/ui';
import { Badge, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: string;
  createdAt: string;
}

export default function BadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    try {
      const response = await fetch('/api/badges');
      if (!response.ok) throw new Error('获取徽章列表失败');
      const data = await response.json();
      setBadges(data.badges || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '获取徽章列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个徽章吗？此操作不可恢复。')) return;
    
    setDeleting(id);
    try {
      const csrfToken = await fetch('/api/csrf').then(r => r.json()).then(d => d.csrfToken);
      const response = await fetch(`/api/badges/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      });
      
      if (!response.ok) throw new Error('删除失败');
      
      toast.success('徽章已删除');
      fetchBadges();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">徽章管理</h1>
        <Button onClick={() => toast.info('创建徽章功能开发中')}>
          <BadgeCheck className="w-4 h-4 mr-2" />
          创建徽章
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">徽章列表</h2>
        </CardHeader>
        <CardBody>
          {badges.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BadgeCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无徽章</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {badges.map((badge) => (
                <div key={badge.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-2xl">{badge.icon}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold">{badge.name}</h3>
                      <p className="text-sm text-muted-foreground">{badge.description}</p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(badge.id)}
                    disabled={deleting === badge.id}
                  >
                    {deleting === badge.id ? '删除中...' : '删除'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
