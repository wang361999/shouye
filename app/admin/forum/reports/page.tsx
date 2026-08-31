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
  CheckCircle,
  XCircle,
  Loader2,
  Filter,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Report {
  id: string;
  reason: string;
  description: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  reporterId: string;
  reporterName: string;
  reportedPostId: string;
  reportedPostTitle: string;
  reportedUserId: string;
  reportedUserName: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const { admin, loading: authLoading } = useAdminAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isResolving, setIsResolving] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setToken(localStorage.getItem('token'));
    }
  }, []);

  const loadReports = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch('/api/forum/reports', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && !admin) {
      router.push('/admin/login');
    }
  }, [admin, authLoading, router]);

  useEffect(() => {
    if (admin) {
      loadReports();
    }
  }, [admin, loadReports]);

  const handleResolve = async (reportId: string, action: 'resolve' | 'dismiss') => {
    if (!token) return;
    if (!confirm(`确定要${action === 'resolve' ? '处理' : '驳回'}这个举报吗？`)) return;

    setIsResolving(reportId);
    try {
      const response = await fetch(`/api/forum/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: action === 'resolve' ? 'RESOLVED' : 'DISMISSED',
          resolvedBy: admin?.username,
        }),
      });

      if (response.ok) {
        toast({
          title: action === 'resolve' ? '举报已处理' : '举报已驳回',
          description: action === 'resolve' ? '举报已标记为已处理' : '举报已标记为已驳回',
        });
        loadReports();
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
    } finally {
      setIsResolving(null);
    }
  };

  const handleView = (report: Report) => {
    setSelectedReport(report);
    setIsViewDialogOpen(true);
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch =
      report.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reporterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reportedUserName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reportedPostTitle.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'pending' && report.status === 'PENDING') ||
      (filterStatus === 'resolved' && report.status === 'RESOLVED') ||
      (filterStatus === 'dismissed' && report.status === 'DISMISSED');

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
          <h1 className="text-3xl font-bold">举报管理</h1>
          <p className="text-muted-foreground mt-1">处理用户举报，维护社区秩序</p>
        </div>
        <Button onClick={() => router.push('/admin')}>
          返回后台
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>举报列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索举报..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select
                value={filterStatus}
                onValueChange={(value: 'all' | 'pending' | 'resolved' | 'dismissed') => setFilterStatus(value)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="resolved">已处理</SelectItem>
                  <SelectItem value="dismissed">已驳回</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={loadReports} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无举报数据
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>举报原因</TableHead>
                  <TableHead>举报人</TableHead>
                  <TableHead>被举报人</TableHead>
                  <TableHead>相关帖子</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>举报时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        <span className="font-medium">{report.reason}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {report.description}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {report.reporterName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-medium">{report.reporterName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-sm font-medium">
                          {report.reportedUserName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-medium">{report.reportedUserName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <div className="font-medium text-sm">{report.reportedPostTitle}</div>
                        <div className="text-xs text-muted-foreground">ID: {report.reportedPostId}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {report.status === 'PENDING' ? (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          待处理
                        </Badge>
                      ) : report.status === 'RESOLVED' ? (
                        <Badge variant="outline" className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          已处理
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3 mr-1" />
                          已驳回
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(report.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(report)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {report.status === 'PENDING' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResolve(report.id, 'resolve')}
                              disabled={isResolving === report.id}
                            >
                              {isResolving === report.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-green-500" />
                              ) : (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
