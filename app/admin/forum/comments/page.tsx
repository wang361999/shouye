'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, CardHeader, Button } from '@/components/admin/ui';
import { Comment, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    avatar?: string;
  };
  post: {
    id: string;
    title: string;
  };
  createdAt: string;
  isApproved: boolean;
}

export default function CommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [token, setToken] = useState<string>('');

  const fetchComments = useCallback(async () => {
    try {
      const response = await fetch(`/api/forum/comments?page=${page}&limit=20`);
      if (!response.ok) throw new Error('获取评论列表失败');
      const data = await response.json();
      setComments(data.comments || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '获取评论列表失败');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleApprove = async (id: string, approve: boolean) => {
    try {
      const csrfToken = await fetch('/api/csrf').then(r => r.json()).then(d => d.csrfToken);
      const response = await fetch(`/api/forum/comments/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ approve }),
      });
      
      if (!response.ok) throw new Error('操作失败');
      
      toast.success(approve ? '评论已批准' : '评论已拒绝');
      fetchComments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条评论吗？此操作不可恢复。')) return;
    
    try {
      const csrfToken = await fetch('/api/csrf').then(r => r.json()).then(d => d.csrfToken);
      const response = await fetch(`/api/forum/comments/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      });
      
      if (!response.ok) throw new Error('删除失败');
      
      toast.success('评论已删除');
      fetchComments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
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
        <h1 className="text-2xl font-bold">评论管理</h1>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">评论列表</h2>
        </CardHeader>
        <CardBody>
          {comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无评论</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="p-4 border rounded-lg">
                  <div className="flex items-start space-x-4">
                    <img
                      src={comment.author.avatar || `/api/placeholder/40/40`}
                      alt={comment.author.username}
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold">{comment.author.username}</span>
                        <span className="text-sm text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        回复于: {comment.post.title}
                      </p>
                      <p className="mt-2">{comment.content}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end space-x-2 mt-4">
                    <Button
                      variant={comment.isApproved ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleApprove(comment.id, !comment.isApproved)}
                    >
                      {comment.isApproved ? '已批准' : '批准'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(comment.id)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex items-center justify-center space-x-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              上一页
            </Button>
            <span className="text-sm text-muted-foreground">
              第 {page} 页，共 {totalPages} 页
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              下一页
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
