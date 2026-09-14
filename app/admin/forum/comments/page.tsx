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
} from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  postId: string;
  postTitle: string;
  parentId?: string;
  depth: number;
  likeCount: number;
  isApproved: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export default function ForumCommentsPage() {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('admin_token');
    if (stored) setToken(stored);
  }, []);

  const fetchComments = useCallback(async () => {
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

      const res = await fetch(`/api/forum/comments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
        setTotalPages(data.totalPages || 1);
      }
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, filterStatus, searchQuery, router]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleDelete = async (commentId: string) => {
    if (!confirm('确定要删除这条评论吗？此操作不可恢复。')) return;

    try {
      const res = await fetch(`/api/forum/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchComments();
      }
    } catch {
      // ignore
    }
  };

  const handleToggleApprove = async (comment: Comment) => {
    try {
      const res = await fetch(`/api/forum/comments/${comment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isApproved: !comment.isApproved }),
      });

      if (res.ok) {
        fetchComments();
      }
    } catch {
      // ignore
    }
  };

  const getStatusBadge = (comment: Comment) => {
    if (comment.isDeleted) {
      return <Badge variant="destructive">已删除</Badge>;
    }
    return comment.isApproved ? (
      <Badge variant="default" className="bg-green-500">已审核</Badge>
    ) : (
      <Badge variant="secondary">待审核</Badge>
    );
  };

  const getDepthIndent = (depth: number) => {
    if (depth <= 1) return '';
    return 'ml-' + Math.min(depth * 4, 12);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">评论管理</h1>
          <p className="text-muted-foreground mt-1">
            管理论坛评论内容
          </p>
        </div>
        <Button variant="outline" onClick={fetchComments}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索评论内容..."
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
          <option value="approved">已审核</option>
          <option value="pending">待审核</option>
          <option value="deleted">已删除</option>
        </select>
      </div>

      {/* 评论列表 */}
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
      ) : comments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>没有找到评论</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <Card key={comment.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    {comment.authorAvatar ? (
                      <img
                        src={comment.authorAvatar}
                        alt={comment.authorName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{comment.authorName}</span>
                      {getStatusBadge(comment)}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(comment.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      回复于：<span className="font-medium text-foreground">{comment.postTitle}</span>
                    </p>
                    <p className="mt-2 text-sm line-clamp-3">{comment.content}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span>👍 {comment.likeCount}</span>
                      <span>楼层 #{comment.id.slice(0, 8)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedComment(comment)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleApprove(comment)}
                    >
                      {comment.isApproved ? '撤销' : '审核'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(comment.id)}
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
      {selectedComment && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">评论详情</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedComment(null)}
                >
                  ✕
                </Button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    {selectedComment.authorAvatar ? (
                      <img
                        src={selectedComment.authorAvatar}
                        alt={selectedComment.authorName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{selectedComment.authorName}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(selectedComment.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">回复帖子：</p>
                  <p className="font-medium">{selectedComment.postTitle}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">评论内容：</p>
                  <div className="mt-2 p-4 bg-muted rounded-lg whitespace-pre-wrap">
                    {selectedComment.content}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>点赞数：{selectedComment.likeCount}</span>
                  <span>楼层深度：{selectedComment.depth}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
