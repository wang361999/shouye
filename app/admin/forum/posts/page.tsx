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

interface Post {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  categoryId: string;
  author?: {
    id: string;
    username: string;
    avatar: string | null;
  };
  category?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function AdminPostsPage({ searchParams }: PageProps) {
  const router = useRouter();
  const search = useSearchParams();
  const { user, loading } = useAdminAuth();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(search.get('page')) || 1);
  const [limit, setLimit] = useState(Number(search.get('limit')) || 20);
  const [status, setStatus] = useState(search.get('status') || 'all');
  const [searchText, setSearchText] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== 'ADMIN') {
      router.push('/admin/login');
      return;
    }
    loadPosts();
  }, [page, limit, status, searchText, loading, user, router]);

  const loadPosts = async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(status !== 'all' && { status }),
        ...(searchText && { search: searchText }),
      });

      const data = await fetcher(`/api/forum/posts?${params}`);
      setPosts(data.posts || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('[ADMIN POSTS] Failed to load:', error);
      toast.error('加载帖子失败');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setProcessing(true);
    try {
      await fetcher(`/api/forum/posts/${deleteId}`, {
        method: 'DELETE',
      });
      setPosts(prev => prev.filter(p => p.id !== deleteId));
      setTotal(prev => prev - 1);
      setDeleteId(null);
      toast.success('帖子已删除');
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
        <h1 className="text-2xl font-bold">帖子管理</h1>
        <Link href="/admin/forum/categories">
          <Button variant="outline">分类管理</Button>
        </Link>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Input
          placeholder="搜索帖子标题..."
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
            <SelectItem value="published">已发布</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="archived">归档</SelectItem>
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
              <TableHead>标题</TableHead>
              <TableHead>作者</TableHead>
              <TableHead>分类</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>互动</TableHead>
              <TableHead>时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  暂无帖子数据
                </TableCell>
              </TableRow>
            ) : (
              posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="max-w-md">
                    <Link 
                      href={`/forum/post/${post.slug}`}
                      className="font-medium hover:text-primary hover:underline line-clamp-1"
                    >
                      {post.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={post.author?.avatar || ''} />
                        <AvatarFallback>{post.author?.username?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{post.author?.username || '未知'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {post.category ? (
                      <Badge variant="secondary" className="text-xs">
                        {post.category.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      post.status === 'published' ? 'default' :
                      post.status === 'draft' ? 'secondary' : 'outline'
                    }>
                      {post.status === 'published' ? '已发布' :
                       post.status === 'draft' ? '草稿' : '归档'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex gap-3">
                      <span>👁 {post.viewCount}</span>
                      <span>👍 {post.likeCount}</span>
                      <span>💬 {post.commentCount}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(post.createdAt).toLocaleString('zh-CN')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link href={`/forum/post/${post.slug}/edit`}>
                        <Button size="sm" variant="outline">编辑</Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteId(post.id)}
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
            <AlertDialogTitle>确认删除帖子</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销。该帖子及其所有评论将被永久删除。
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
