'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  User,
  MessageSquare,
  Calendar,
  Loader2,
  Flag,
} from 'lucide-react';
import Link from 'next/link';

interface Report {
  id: string;
  reason: string;
  content?: string;
  status: 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'REJECTED';
  reporterId: string;
  targetPostId?: string;
  targetCommentId?: string;
  processedBy?: string;
  processedAt?: string;
  processNote?: string;
  createdAt: string;
  updatedAt: string;
  reporter?: {
    id: string;
    username: string;
    email: string;
    avatar?: string;
  };
  targetPost?: {
    id: string;
    title: string;
    slug: string;
  };
  targetComment?: {
    id: string;
    content: string;
  };
}

interface PageState {
  reports: Report[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface Filters {
  status?: 'all' | 'pending' | 'processing' | 'resolved' | 'rejected';
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export default function ForumReportsAdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [processNote, setProcessNote] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '50',
        sort: filters.sortBy || 'createdAt',
        order: filters.sortOrder || 'desc',
      });

      if (filters.status && filters.status !== 'all') {
        params.append('status', filters.status);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/forum/reports?${params.toString()}`);
      if (response.ok) {
        const data: PageState = await response.json();
        setReports(data.reports);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, searchTerm]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleProcess = async (report: Report) => {
    if (!processNote.trim()) {
      alert('请填写处理说明');
      return;
    }

    try {
      const response = await fetch(`/api/forum/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RESOLVED',
          processNote: processNote,
        }),
      });

      if (response.ok) {
        setIsViewDialogOpen(false);
        setProcessNote('');
        fetchReports();
      } else {
        const data = await response.json();
        alert(data.error || '处理失败');
      }
    } catch (error) {
      console.error('Process report error:', error);
      alert('处理失败');
    }
  };

  const handleReject = async (report: Report) => {
    if (!processNote.trim()) {
      alert('请填写拒绝原因');
      return;
    }

    try {
      const response = await fetch(`/api/forum/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'REJECTED',
          processNote: processNote,
        }),
      });

      if (response.ok) {
        setIsViewDialogOpen(false);
        setProcessNote('');
        fetchReports();
      } else {
        const data = await response.json();
        alert(data.error || '操作失败');
      }
    } catch (error) {
      console.error('Reject report error:', error);
      alert('操作失败');
    }
  };

  const handleView = (report: Report) => {
    setSelectedReport(report);
    setProcessNote('');
    setIsViewDialogOpen(true);
  };

  const getStatusBadge = (status: Report['status']) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="destructive">待处理</Badge>;
      case 'PROCESSING':
        return <Badge variant="default">处理中</Badge>;
      case 'RESOLVED':
        return <Badge variant="default">已解决</Badge>;
      case 'REJECTED':
        return <Badge variant="secondary">已拒绝</Badge>;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">举报管理</h1>
          <p className="text-muted-foreground">
            处理和管理用户举报
          </p>
        </div>
        <Button onClick={fetchReports} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">搜索</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索举报内容..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">状态</label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value as Filters['status'] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="processing">处理中</SelectItem>
                  <SelectItem value="resolved">已解决</SelectItem>
                  <SelectItem value="rejected">已拒绝</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">排序</label>
              <Select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onValueChange={(value) => {
                  const [sortBy, sortOrder] = value.split('-') as [
                    Filters['sortBy'],
                    Filters['sortOrder'],
                  ];
                  setFilters({ ...filters, sortBy, sortOrder });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">创建时间（新→旧）</SelectItem>
                  <SelectItem value="createdAt-asc">创建时间（旧→新）</SelectItem>
                  <SelectItem value="updatedAt-desc">更新时间（新→旧）</SelectItem>
                  <SelectItem value="updatedAt-asc">更新时间（旧→新）</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>举报列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无举报
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>举报人</TableHead>
                    <TableHead>举报原因</TableHead>
                    <TableHead>举报目标</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>举报时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {report.reporter?.username || '未知用户'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-red-500 flex-shrink-0" />
                          <span className="line-clamp-1">
                            {report.reason}
                          </span>
                        </div>
                        {report.content && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {report.content}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {report.targetPost ? (
                          <Link
                            href={`/forum/post/${report.targetPost.slug}`}
