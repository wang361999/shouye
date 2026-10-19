'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAdminAuth } from '@/lib/auth-client';
import { fetcher } from '@/lib/fetch-retry';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Comment {
  id: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  isSpam: boolean;
  createdAt: string;
  updatedAt: string;
  postId: string;
  userId: string;
  parentId: string | null;
  post?: {
    id: string;
    title: string;
    slug: string;
  };
  user?: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function AdminCommentsPage({ searchParams }: PageProps) {
  const router = useRouter();
  const search = useSearchParams();
  const { user, loading } = useAdminAuth();
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(search.get('page')) || 1);
  const [limit, setLimit] = useState(Number(search.get('limit')) || 20);
  const [status, setStatus] = useState(search.get('status') || 'all');
  const [spam, setSpam] = useState(search.get('spam') || 'all');
  const [searchText, setSearchText] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== 'ADMIN') {
      router.push('/admin/login');
      return;
    }
    loadComments();
  }, [page, limit, status, spam, searchText, loading, user, router]);

  const loadComments = async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(status !== 'all' && { status }),
        ...(spam !== 'all' && { spam }),
        ...(searchText && { search: searchText }),
      });

      const data = await fetcher(`/api/forum/comments?${params}`);
      setComments(data.comments || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('[ADMIN COMMENTS] Failed to load:', error);
      toast.error('加载评论失败');
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    try {
      await fetcher(`/api/forum/comments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setComments(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
      toast.success('状态已更新');
    } catch (error) {
      toast.error('更新失败');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setProcessing(true);
    try {
      await fetcher(`/api/forum/comments/${deleteId}`, {
        method: 'DELETE',
      });
      setComments(prev => prev.filter(c => c.id !== deleteId));
      setTotal(prev => prev - 1);
      setDeleteId(null);
      toast.success('评论已删除');
    } catch (error) {
      toast.error('删除失败');
    } finally {
      setProcessing(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">评论管理</h1>
        <Link href="/admin/forum/posts">
          <Button variant="outline">返回帖子列表</Button>
        </Link>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Input
          placeholder="搜索评论内容..."
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待审核</SelectItem>
            <SelectItem value="approved">已审核</SelectItem>
            <SelectItem value="rejected">已拒绝</SelectItem>
          </SelectContent>
        </Select>
        <Select value={spam} onValueChange={(v) => { setSpam(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="垃圾评论" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="true">仅垃圾评论</SelectItem>
            <SelectItem value="false">仅正常评论</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 条</SelectItem>
            <SelectItem value="20">20 条</SelectItem>
            <SelectItem value="50">50 条</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>作者</TableHead>
              <TableHead>内容</TableHead>
              <TableHead>帖子</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>垃圾</TableHead>
              <TableHead>时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  暂无评论数据
                </TableCell>
              </TableRow>
            ) : (
              comments.map((comment) => (
                <TableRow key={comment.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={comment.user?.avatar || ''} />
                        <AvatarFallback>{comment.user?.username?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{comment.user?.username || '未知用户'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <div className="line-clamp-2 text-sm">
                      {comment.content.length > 100 
                        ? comment.content.slice(0, 100) + '...' 
                        : comment.content}
                    </div>
                  </TableCell>
                  <TableCell>
                    {comment.post ? (
                      <Link 
                        href={`/forum/post/${comment.post.slug}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {comment.post.title.length > 30 
                          ? comment.post.title.slice(0, 30) + '...' 
                          : comment.post.title}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      comment.status === 'approved' ? 'default' :
                      comment.status === 'rejected' ? 'destructive' : 'secondary'
                    }>
                      {comment.status === 'approved' ? '已审核' :
                       comment.status === 'rejected' ? '已拒绝' : '待审核'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {comment.isSpam ? (
                      <Badge variant="destructive">垃圾</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleString('zh-CN')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {comment.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(comment.id, 'approved')}
                          >
                            通过
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(comment.id, 'rejected')}
                          >
                            拒绝
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteId(comment.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
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
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除评论</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销。该评论将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={processing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
