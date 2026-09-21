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
import { Search, Trash2, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Comment {
  id: string;
  content: string;
  authorId: string;
  postId: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  isApproved: boolean;
  deletedAt: string | null;
  author: {
    id: string;
    username: string;
    avatar: string;
  };
  post: {
    id: string;
    title: string;
  };
}

export default function CommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // 获取评论列表
  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/forum/comments');
      if (!response.ok) throw new Error('获取评论列表失败');
      const data = await response.json();
      setComments(data.comments || []);
    } catch (error) {
      console.error('获取评论失败:', error);
      toast.error('获取评论列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // 获取 token
  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) {
      setToken(stored);
    }
  }, []);

  // 审核评论
  const handleApprove = async (id: string, approve: boolean) => {
    try {
      const response = await fetch(`/api/forum/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved: approve }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '操作失败');
      }

      toast.success(approve ? '评论已通过审核' : '评论已拒绝');
      fetchComments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  // 删除评论
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条评论吗？此操作不可恢复。')) return;

    try {
      const response = await fetch(`/api/forum/comments/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '删除失败');
      }

      toast.success('评论已删除');
      fetchComments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  // 编辑评论
  const handleEdit = (comment: Comment) => {
    setEditingComment(comment);
    setEditContent(comment.content);
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingComment) return;

    try {
      const response = await fetch(`/api/forum/comments/${editingComment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '更新失败');
      }

      toast.success('评论已更新');
      setShowEditDialog(false);
      setEditingComment(null);
      fetchComments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失败');
    }
  };

  // 搜索评论
  const filteredComments = comments.filter((comment) => {
    const matchesSearch =
      comment.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comment.author.username.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'approved' && comment.isApproved) ||
      (filterStatus === 'pending' && !comment.isApproved) ||
      (filterStatus === 'deleted' && comment.deletedAt !== null);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">评论管理</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>评论列表</CardTitle>
          <CardDescription>管理论坛中的所有评论</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索评论..."
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
                <SelectItem value="approved">已通过</SelectItem>
                <SelectItem value="pending">待审核</SelectItem>
                <SelectItem value="deleted">已删除</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredComments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无评论
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>作者</TableHead>
                  <TableHead>内容</TableHead>
                  <TableHead>帖子</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComments.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {comment.author.avatar ? (
                          <img
                            src={comment.author.avatar}
                            alt={comment.author.username}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            {comment.author.username[0].toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium">{comment.author.username}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="line-clamp-2">{comment.content}</div>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`/forum/post/${comment.postId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {comment.post.title}
                      </a>
                    </TableCell>
                    <TableCell>
                      {comment.deletedAt ? (
                        <Badge variant="destructive">已删除</Badge>
                      ) : comment.isApproved ? (
                        <Badge variant="default">已通过</Badge>
                      ) : (
                        <Badge variant="secondary">待审核</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {!comment.deletedAt && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprove(comment.id, !comment.isApproved)}
                            >
                              {comment.isApproved ? (
                                <X className="w-4 h-4 text-destructive" />
                              ) : (
                                <Check className="w-4 h-4 text-green-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(comment)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(comment.id)}
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

      {/* 编辑评论对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑评论</DialogTitle>
            <DialogDescription>
              修改评论内容
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="content">评论内容</Label>
              <Textarea
                id="content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={5}
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
