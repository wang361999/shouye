'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageSquare,
  Search,
  Filter,
  Trash2,
  Eye,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ThumbsUp,
  MessageCircle,
} from 'lucide-react';

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  categoryId: string;
  categoryName: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'DELETED';
  isSticky: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ForumPostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('admin_token');
    if (stored) setToken(stored);
  }, []);

  const fetchPosts = useCallback(async () => {
    if (!token) {
      router.push('/admin/login');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(filterStatus !== 'all' && { status: filterStatus }),
        ...(searchQuery && { search: searchQuery }),
      });

      const res = await fetch(`/api/forum/posts?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        setTotalPages(data.totalPages || 1);
      }
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, filterStatus, searchQuery, router]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDelete = async (postId: string) => {
    if (!confirm('确定要删除这篇帖子吗？此操作不可恢复。')) return;

    try {
      const res = await fetch(`/api/forum/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchPosts();
      }
    } catch {
      // ignore
    }
  };

  const handleToggleStatus = async (post: Post) => {
    const newStatus = post.status === 'HIDDEN' ? 'PUBLISHED' : 'HIDDEN';
    try {
      const res = await fetch(`/api/forum/posts/${post.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        fetchPosts();
      }
    } catch {
      // ignore
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
      PUBLISHED: { label: '已发布', variant: 'default' },
      DRAFT: { label: '草稿', variant: 'secondary' },
      HIDDEN: { label: '已隐藏', variant: 'destructive' },
      DELETED: { label: '已删除', variant: 'destructive' },
    };
    const badge = badges[status] || { label: status, variant: 'secondary' };
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">帖子管理</h1>
          <p className="text-muted-foreground mt-1">
            管理论坛帖子内容
          </p>
        </div>
        <Button variant="outline" onClick={fetchPosts}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索帖子标题..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
        >
          <option value="all">全部状态</option>
          <option value="PUBLISHED">已发布</option>
          <option value="DRAFT">草稿</option>
          <option value="HIDDEN">已隐藏</option>
          <option value="DELETED">已删除</option>
        </select>
      </div>

      {/* 帖子列表 */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>没有找到帖子</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    {post.authorAvatar ? (
                      <img
                        src={post.authorAvatar}
                        alt={post.authorName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{post.title}</h3>
                      {post.isSticky && (
                        <Badge variant="default" className="text-xs">置顶</Badge>
                      )}
                      {getStatusBadge(post.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      作者：<span className="font-medium">{post.authorName}</span>
                      {' · '}分类：<span className="font-medium">{post.categoryName}</span>
                    </p>
                    <p className="mt-2 text-sm line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {post.viewCount} 浏览
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        {post.likeCount} 点赞
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {post.commentCount} 评论
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(post.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPost(post)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleStatus(post)}
                    >
                      {post.status === 'HIDDEN' ? '公开' : '隐藏'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(post.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {currentPage} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 详情 Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">帖子详情</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedPost(null)}
                >
                  ✕
                </Button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    {selectedPost.authorAvatar ? (
                      <img
                        src={selectedPost.authorAvatar}
                        alt={selectedPost.authorName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{selectedPost.authorName}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(selectedPost.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold">{selectedPost.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    分类：{selectedPost.categoryName}
                  </p>
                </div>
                <div className="prose prose-sm max-w-none">
                  <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap">
                    {selectedPost.content}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <span>👁️ {selectedPost.viewCount} 浏览</span>
                  <span>👍 {selectedPost.likeCount} 点赞</span>
                  <span>💬 {selectedPost.commentCount} 评论</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
