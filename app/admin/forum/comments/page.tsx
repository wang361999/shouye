'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Trash2,
  Edit,
  Eye,
  Ban,
  CheckCircle,
  XCircle,
  Loader2,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Comment {
  id: string;
  content: string;
  isApproved: boolean;
  authorId: string;
  authorName: string;
  postId: string;
  postTitle: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  username: string;
  avatar?: string;
  role: string;
}

export default function CommentsPage() {
  const router = useRouter();
  const { admin, loading: authLoading } = useAdminAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending'>('all');
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    content: '',
    isApproved: false,
  });
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // 获取 token
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const loadComments = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch('/api/forum/comments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && !admin) {
      router.push('/admin/login');
    }
  }, [admin, authLoading, router]);

  useEffect(() => {
    if (admin) {
      loadComments();
      loadUsers();
    }
  }, [admin, loadComments, loadUsers]);

  const handleApprove = async (commentId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/forum/comments/${commentId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast({
          title: '评论已审核通过',
          description: '该评论现在对用户可见',
        });
        loadComments();
      } else {
        const error = await response.json();
        toast({
          title: '操作失败',
          description: error.error || '请重试',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '网络错误',
        description: '请检查网络连接后重试',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!token) return;
    if (!confirm('确定要删除这条评论吗？此操作不可恢复。')) return;

    setIsDeleting(commentId);
    try {
      const response = await fetch(`/api/forum/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast({
          title: '评论已删除',
          description: '评论已从系统中删除',
        });
        loadComments();
      } else {
        const error = await response.json();
        toast({
          title: '删除失败',
          description: error.error || '请重试',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '网络错误',
        description: '请检查网络连接后重试',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleEdit = (comment: Comment) => {
    setSelectedComment(comment);
    setEditForm({
      content: comment.content,
      isApproved: comment.isApproved,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!token || !selectedComment) return;

    try {
      const response = await fetch(`/api/forum/comments/${selectedComment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        toast({
          title: '评论已更新',
          description: '评论内容和状态已更新',
        });
        setIsEditDialogOpen(false);
        setSelectedComment(null);
        loadComments();
      } else {
        const error = await response.json();
        toast({
          title: '更新失败',
          description: error.error || '请重试',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '网络错误',
        description: '请检查网络连接后重试',
        variant: 'destructive',
      });
    }
  };

  const filteredComments = comments.filter(comment => {
    const matchesSearch =
      comment.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comment.authorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comment.postTitle.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'approved' && comment.isApproved) ||
      (filterStatus === 'pending' && !comment.isApproved);

    return matchesSearch && matchesFilter;
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">评论管理</h1>
          <p className="text-muted-foreground mt-1">管理论坛评论，审核和删除不当内容</p>
        </div>
        <Button onClick={() => router.push('/admin')}>
          返回后台
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>评论列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索评论..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select
                value={filterStatus}
                onValueChange={(value: 'all' | 'approved' | 'pending') => setFilterStatus(value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="筛选状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="approved">已审核</SelectItem>
                  <SelectItem value="pending">待审核</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={loadComments} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredComments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无评论数据
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>作者</TableHead>
                  <TableHead>评论内容</TableHead>
                  <TableHead>所属帖子</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComments.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {comment.authorName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-medium">{comment.authorName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="line-clamp-2 text-sm">
                        {comment.content}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <div className="font-medium text-sm">{comment.postTitle}</div>
                        <div className="text-xs text-muted-foreground">ID: {comment.postId}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {comment.isApproved ? (
                        <Badge variant="outline" className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          已审核
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                          <XCircle className="w-3 h-3 mr-1" />
                          待审核
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(comment.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(comment)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {!comment.isApproved && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(comment.id)}
                          >
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(comment.id)}
                          disabled={isDeleting === comment.id}
                        >
                          {isDeleting === comment.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-red-500" />
                          )}
                        </Button>
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
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑评论</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>作者</Label>
              <Input
                value={selectedComment?.authorName || ''}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>评论内容</Label>
              <Textarea
                value={editForm.content}
                onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                rows={6}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isApproved"
                checked={editForm.isApproved}
                onChange={(e) => setEditForm(prev => ({ ...prev, isApproved: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isApproved">审核通过</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSaveEdit}>
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
