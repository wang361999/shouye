'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, CardHeader, Button } from '@/components/admin/ui';
import { Post, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface Post {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    username: string;
    avatar?: string;
  };
  category: {
    id: string;
    name: string;
  };
  createdAt: string;
  status: 'PUBLISHED' | 'DRAFT' | 'DELETED';
  viewCount: number;
  commentCount: number;
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [token, setToken] = useState<string>('');

  const fetchPosts = useCallback(async () => {
    try {
      const response = await fetch(`/api/forum/posts?page=${page}&limit=20`);
      if (!response.ok) throw new Error('获取帖子列表失败');
      const data = await response.json();
      setPosts(data.posts || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '获取帖子列表失败');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleStatusChange = async (id: string, status: Post['status']) => {
    try {
      const csrfToken = await fetch('/api/csrf').then(r => r.json()).then(d => d.csrfToken);
      const response = await fetch(`/api/forum/posts/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) throw new Error('操作失败');
      
      toast.success('帖子状态已更新');
      fetchPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这篇帖子吗？此操作不可恢复。')) return;
    
    try {
      const csrfToken = await fetch('/api/csrf').then(r => r.json()).then(d => d.csrfToken);
      const response = await fetch(`/api/forum/posts/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      });
      
      if (!response.ok) throw new Error('删除失败');
      
      toast.success('帖子已删除');
      fetchPosts();
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
        <h1 className="text-2xl font-bold">帖子管理</h1>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">帖子列表</h2>
        </CardHeader>
        <CardBody>
          {posts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Post className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无帖子</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="p-4 border rounded-lg">
                  <div className="flex items-start space-x-4">
                    <img
                      src={post.author.avatar || `/api/placeholder/40/40`}
                      alt={post.author.username}
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold">{post.title}</span>
                        <span className={`px-2 py-1 text-xs rounded ${
                          post.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
                          post.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {post.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        作者: {post.author.username} | 分类: {post.category.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        发布于: {new Date(post.createdAt).toLocaleDateString()} | 
                        浏览: {post.viewCount} | 评论: {post.commentCount}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end space-x-2 mt-4">
                    {post.status === 'PUBLISHED' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(post.id, 'DRAFT')}
                      >
                        设为草稿
                      </Button>
                    ) : post.status === 'DRAFT' ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleStatusChange(post.id, 'PUBLISHED')}
                      >
                        发布
                      </Button>
                    ) : null}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(post.id)}
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
