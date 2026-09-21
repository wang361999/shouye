'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Trash2, Edit2, Eye, Check, X, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  categoryId: string;
  status: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  author: {
    id: string;
    username: string;
    avatar: string;
  };
  category: {
    id: string;
    name: string;
  };
  tags: Array<{
    id: string;
    name: string;
  }>;
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // 获取帖子列表
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/forum/posts');
      if (!response.ok) throw new Error('获取帖子列表失败');
      const data = await response.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('获取帖子失败:', error);
      toast.error('获取帖子列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // 获取 token
  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) {
      setToken(stored);
    }
  }, []);

  // 排序处理
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // 审核帖子
  const handleApprove = async (id: string, approve: boolean) => {
    try {
      const response = await fetch(`/api/forum/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: approve ? 'PUBLISHED' : 'DRAFT' }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '操作失败');
      }

      toast.success(approve ? '帖子已通过审核' : '帖子已设为草稿');
      fetchPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  // 删除帖子
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这篇帖子吗？此操作不可恢复。')) return;

    try {
      const response = await fetch(`/api/forum/posts/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '删除失败');
      }

      toast.success('帖子已删除');
      fetchPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  // 编辑帖子
  const handleEdit = (post: Post) => {
    setEditingPost(post);
    setEditTitle(post.title);
    setEditContent(post.content);
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;

    try {
      const response = await fetch(`/api/forum/posts/${editingPost.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '更新失败');
      }

      toast.success('帖子已更新');
      setShowEditDialog(false);
      setEditingPost(null);
      fetchPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失败');
    }
  };

  // 搜索帖子
  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.author.username.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'published' && post.status === 'PUBLISHED') ||
      (filterStatus === 'draft' && post.status === 'DRAFT') ||
      (filterStatus === 'deleted' && post.deletedAt !== null);

    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const aVal = a[sortField as keyof Post];
    const bVal = b[sortField as keyof Post];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">帖子管理</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>帖子列表</CardTitle>
          <CardDescription>管理论坛中的所有帖子</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索帖子..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="published">已发布</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="deleted">已删除</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无帖子
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>作者</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>浏览</TableHead>
                  <TableHead>点赞</TableHead>
                  <TableHead>评论</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {post.author.avatar ? (
                          <img
                            src={post.author.avatar}
                            alt={post.author.username}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            {post.author.username[0].toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium">{post.author.username}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="line-clamp-1">{post.title}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{post.category?.name || '无分类'}</Badge>
                    </TableCell>
                    <TableCell>
                      {post.deletedAt ? (
                        <Badge variant="destructive">已删除</Badge>
                      ) : post.status === 'PUBLISHED' ? (
                        <Badge variant="default">已发布</Badge>
                      ) : (
                        <Badge variant="secondary">草稿</Badge>
                      )}
                    </TableCell>
                    <TableCell>{post.viewCount}</TableCell>
                    <TableCell>{post.likeCount}</TableCell>
                    <TableCell>{post.commentCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(post.createdAt).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href={`/forum/post/${post.id}`} target="_blank" rel="noopener noreferrer">
                            <Eye className="w-4 h-4" />
                          </a>
                        </Button>
                        {!post.deletedAt && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprove(post.id, post.status !== 'PUBLISHED')}
                            >
                              {post.status !== 'PUBLISHED' ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <X className="w-4 h-4 text-destructive" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(post)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(post.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 编辑帖子对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>编辑帖子</DialogTitle>
            <DialogDescription>
              修改帖子标题和内容
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="输入帖子标题"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">内容</Label>
              <Textarea
                id="content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={10}
                placeholder="输入帖子内容（支持 Markdown）"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSaveEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
