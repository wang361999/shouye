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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Report {
  id: string;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
  postId?: string;
  commentId?: string;
  userId: string;
  reporterId: string;
  post?: {
    id: string;
    title: string;
    slug: string;
  };
  comment?: {
    id: string;
    content: string;
  };
  user?: {
    id: string;
    username: string;
    avatar: string | null;
  };
  reporter?: {
    id: string;
    username: string;
  };
}

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function AdminReportsPage({ searchParams }: PageProps) {
  const router = useRouter();
  const search = useSearchParams();
  const { user, loading } = useAdminAuth();
  
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(search.get('page')) || 1);
  const [limit, setLimit] = useState(Number(search.get('limit')) || 20);
  const [status, setStatus] = useState(search.get('status') || 'all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== 'ADMIN') {
      router.push('/admin/login');
      return;
    }
    loadReports();
  }, [page, limit, status, loading, user, router]);

  const loadReports = async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(status !== 'all' && { status }),
      });

      const data = await fetcher(`/api/forum/reports?${params}`);
      setReports(data.reports || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('[ADMIN REPORTS] Failed to load:', error);
      toast.error('加载举报数据失败');
    }
  };

  const handleResolve = async (reportId: string, action: 'remove' | 'warn' | 'none') => {
    if (!selectedReport) return;
    
    setProcessing(true);
    try {
      const result = await fetcher(`/api/forum/reports/${reportId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          note: resolutionNote,
        }),
      });
      
      setReports(prev => prev.map(r => 
        r.id === reportId ? { ...r, status: 'resolved' } : r
      ));
      setSelectedReport(null);
      setResolutionNote('');
      toast.success('举报已处理');
    } catch (error) {
      toast.error('处理失败');
    } finally {
      setProcessing(false);
    }
  };

  const handleDismiss = async (reportId: string) => {
    if (!selectedReport) return;
    
    setProcessing(true);
    try {
      await fetcher(`/api/forum/reports/${reportId}/dismiss`, {
        method: 'POST',
      });
      
      setReports(prev => prev.map(r => 
        r.id === reportId ? { ...r, status: 'dismissed' } : r
      ));
      setSelectedReport(null);
      toast.success('举报已忽略');
    } catch (error) {
      toast.error('操作失败');
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
        <h1 className="text-2xl font-bold">举报管理</h1>
        <Link href="/admin/forum/posts">
          <Button variant="outline">返回帖子列表</Button>
        </Link>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待处理</SelectItem>
            <SelectItem value="resolved">已处理</SelectItem>
            <SelectItem value="dismissed">已忽略</SelectItem>
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
              <TableHead>举报人</TableHead>
              <TableHead>被举报内容</TableHead>
              <TableHead>原因</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  暂无举报数据
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={report.reporter?.username ? undefined : ''} />
                        <AvatarFallback>{report.reporter?.username?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{report.reporter?.username || '未知用户'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {report.post ? (
                      <Link 
                        href={`/forum/post/${report.post.slug}`}
                        className="text-sm text-primary hover:underline"
                      >
                        帖子: {report.post.title.slice(0, 30)}
                        {report.post.title.length > 30 ? '...' : ''}
                      </Link>
                    ) : report.comment ? (
                      <span className="text-sm text-muted-foreground">
                        评论: {report.comment.content.slice(0, 30)}...
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{report.reason}</TableCell>
                  <TableCell>
                    <Badge variant={
                      report.status === 'resolved' ? 'default' :
                      report.status === 'dismissed' ? 'secondary' : 'destructive'
                    }>
                      {report.status === 'resolved' ? '已处理' :
                       report.status === 'dismissed' ? '已忽略' : '待处理'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(report.createdAt).toLocaleString('zh-CN')}
                  </TableCell>
                  <TableCell>
                    {report.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => setSelectedReport(report)}
                      >
                        处理
                      </Button>
                    )}
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

      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>处理举报</DialogTitle>
            <DialogDescription>
              查看举报详情并采取相应措施
            </DialogDescription>
          </DialogHeader>
          
          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">举报人:</span> {selectedReport.reporter?.username}
                </div>
                <div>
                  <span className="font-medium">举报时间:</span>{' '}
                  {new Date(selectedReport.createdAt).toLocaleString('zh-CN')}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">举报原因:</span> {selectedReport.reason}
                </div>
              </div>

              {selectedReport.post && (
                <div className="border rounded p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">相关帖子</span>
                    <Link 
                      href={`/forum/post/${selectedReport.post.slug}`}
                      className="text-sm text-primary hover:underline"
                    >
                      查看帖子
                    </Link>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedReport.post.title}</p>
                </div>
              )}

              {selectedReport.comment && (
                <div className="border rounded p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">相关评论</span>
                    <Link 
                      href={`/forum/post/${selectedReport.post?.slug}`}
                      className="text-sm text-primary hover:underline"
                    >
                      查看上下文
                    </Link>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedReport.comment.content}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">处理备注（可选）</label>
                <Textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="输入处理说明..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleDismiss(selectedReport.id)}
                  disabled={processing}
                >
                  忽略举报
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleResolve(selectedReport.id, 'warn')}
                  disabled={processing}
                >
                  警告用户
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleResolve(selectedReport.id, 'remove')}
                  disabled={processing}
                >
                  删除内容
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
