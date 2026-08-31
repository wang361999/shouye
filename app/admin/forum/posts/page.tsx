'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Eye,
  Edit,
  Ban,
  CheckCircle,
  XCircle,
  Loader2,
  Filter,
  RefreshCw,
  TrendingUp,
  MessageSquare,
  ThumbsUp,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Post {
  id: string;
  title: string;
  content: string;
  status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
  viewCount: number;
  commentCount: number;
  likeCount: number;
  authorId: string;
  authorName: string;
  categoryId: string;
  categoryName: string;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function PostsPage() {
  const router = useRouter();
  const { admin, loading: authLoading } = useAdminAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft' | 'hidden'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setToken(localStorage.getItem('token'));
    }
  }, []);

  const loadPosts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch('/api/forum/posts', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadCategories = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/forum/categories', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && !admin) {
      router.push('/admin/login');
    }
  }, [admin, authLoading, router]);

  useEffect(() => {
    if (admin) {
      loadPosts();
      loadCategories();
    }
  }, [admin, loadPosts, loadCategories]);

  const handleDelete = async (postId: string) => {
    if (!token) return;
    if (!confirm('确定要删除这篇帖子吗？此操作不可恢复。')) return;

    setIsDeleting(postId);
    try {
      const response = await fetch(`/api/forum/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast({
          title: '帖子已删除',
          description: '帖子已从系统中删除',
        });
        loadPosts();
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

  const handleView = (post: Post) => {
    setSelectedPost(post);
    setIsViewDialogOpen(true);
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.authorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.categoryName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'published' && post.status === 'PUBLISHED') ||
      (filterStatus === 'draft' && post.status === 'DRAFT') ||
      (filterStatus === 'hidden' && post.status === 'HIDDEN');

    const matchesCategory =
      filterCategory === 'all' || post.categoryId === filterCategory;

    return matchesSearch && matchesStatus && matchesCategory;
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
          <h1 className="text-3xl font-bold">帖子管理</h1>
          <p className="text-muted-foreground mt-1">管理论坛帖子，审核和删除不当内容</p>
        </div>
        <Button onClick={() => router.push('/admin')}>
          返回后台
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>帖子列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索帖子..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select
                value={filterStatus}
                onValueChange={(value: 'all' | 'published' | 'draft' | 'hidden') => setFilterStatus(value)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="published">已发布</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="hidden">隐藏</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Select
                value={filterCategory}
                onValueChange={setFilterCategory}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={loadPosts} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无帖子数据
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>作者</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>浏览/评论/点赞</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="max-w-md">
                      <div className="font-medium">{post.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {post.content}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {post.authorName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-medium">{post.authorName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{post.categoryName}</Badge>
                    </TableCell>
                    <TableCell>
                      {post.status === 'PUBLISHED' ? (
                        <Badge variant="outline" className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          已发布
                        </Badge>
                      ) : post.status === 'DRAFT' ? (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                          <XCircle className="w-3 h-3 mr-1" />
                          草稿
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-100 text-red-800">
                          <Ban className="w-3 h-3 mr-1" />
                          隐藏
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="flex items-center space-x-1">
                          <TrendingUp className="w-4 h-4" />
                          <span>{post.viewCount}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <MessageSquare className="w-4 h-4" />
                          <span>{post.commentCount}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <ThumbsUp className="w-4 h-4" />
                          <span>{post.likeCount}</span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(post.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(post)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/forum/post/${post.id}`)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(post.id)}
                          disabled={isDeleting === post.id}
                        >
                          {isDeleting === post.id ? (
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

      {/* 查看帖子对话框 */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>帖子详情</DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedPost.title}</h2>
                <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                  <span>作者: {selectedPost.authorName}</span>
                  <span>分类: {selectedPost.categoryName}</span>
                  <span>创建时间: {new Date(selectedPost.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="prose max-w-none">
                <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap">
                  {selectedPost.content}
                </div>
              </div>
              <div className="flex items-center space-x-6 text-sm">
                <span className="flex items-center space-x-1">
                  <TrendingUp className="w-4 h-4" />
                  <span>浏览: {selectedPost.viewCount}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <MessageSquare className="w-4 h-4" />
                  <span>评论: {selectedPost.commentCount}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <ThumbsUp className="w-4 h-4" />
                  <span>点赞: {selectedPost.likeCount}</span>
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
