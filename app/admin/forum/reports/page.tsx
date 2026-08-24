```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/admin/ui/card';
import { Button } from '@/components/admin/ui/button';
import { Badge } from '@/components/admin/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/admin/ui/dialog';
import { Input } from '@/components/admin/ui/input';
import { Label } from '@/components/admin/ui/label';
import { Textarea } from '@/components/admin/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/admin/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/admin/ui/table';
import { Search, Filter, Settings, Info, Trash2, Eye, MessageSquare, CheckCircle, XCircle, Ban, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/admin/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/admin/ui/tooltip';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/admin/ui/pagination';

interface Report {
  id: string;
  postTitle: string;
  reporterName: string;
  reason: 'spam' | 'offensive' | 'misleading' | 'copyright' | 'other';
  content: string;
  createdAt: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  handledBy?: string;
  handledAt?: string;
  actionTaken?: string;
}

const DEFAULT_REPORTS: Report[] = [
  {
    id: '1',
    postTitle: '为什么我的代码跑不通？',
    reporterName: '愤怒的用户',
    reason: 'misleading',
    content: '这个帖子标题党，内容完全无关，浪费大家时间。',
    createdAt: '2024-01-15T10:30:00Z',
    status: 'pending',
  },
  {
    id: '2',
    postTitle: '免费领iPhone 15！',
    reporterName: '社区管理员',
    reason: 'spam',
    content: '典型的垃圾广告，含诱导链接。',
    createdAt: '2024-01-15T09:15:00Z',
    status: 'reviewing',
  },
];

export { DEFAULT_REPORTS, Report };

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isProcessingDialogOpen, setIsProcessingDialogOpen] = useState(false);
  const [actionTaken, setActionTaken] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchReports = useCallback(async () => {
    try {
      setIsLoading(true);
      // TODO: 替换为实际的API调用
      const response = await fetch('/api/admin/forum/reports');
      if (!response.ok) throw new Error('获取失败');
      const data = await response.json();
      setReports(data.reports || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      toast.error('加载举报记录失败');
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    let filtered = reports;

    if (searchTerm) {
      filtered = filtered.filter(
        (r) =>
          r.postTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.reporterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    setFilteredReports(filtered);
    setCurrentPage(1);
  }, [reports, searchTerm, statusFilter]);

  const handleStatusChange = async (reportId: string, newStatus: Report['status']) => {
    try {
      const response = await fetch(`/api/admin/forum/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, actionTaken }),
      });

      if (!response.ok) throw new Error('处理失败');

      toast.success('举报处理成功');
      setIsProcessingDialogOpen(false);
      setActionTaken('');
      setSelectedReport(null);
      fetchReports();
    } catch (error) {
      console.error('Failed to update report:', error);
      toast.error('处理失败，请重试');
    }
  };

  const getStatusBadge = (status: Report['status']) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            待处理
          </Badge>
        );
      case 'reviewing':
        return (
          <Badge variant="secondary" className="gap-1">
            <Eye className="h-3 w-3" />
            审核中
          </Badge>
        );
      case 'resolved':
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            已处理
          </Badge>
        );
      case 'dismissed':
        return (
          <Badge variant="outline" className="gap-1">
            <XCircle className="h-3 w-3" />
            已驳回
          </Badge>
        );
      default:
        return null;
    }
  };

  const getReasonLabel = (reason: Report['reason']) => {
    const reasons = {
      spam: '垃圾广告',
      offensive: '攻击性内容',
      misleading: '误导内容',
      copyright: '侵权内容',
      other: '其他',
    };
    return reasons[reason] || reason;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">举报管理</h1>
        <p className="text-muted-foreground">管理和处理社区举报内容</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待处理举报</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">需要立即处理</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总举报数</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
            <p className="text-xs text-muted-foreground">所有举报记录</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已处理</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter((r) => r.status === 'resolved').length}
            </div>
            <p className="text-xs text-muted-foreground">已完成处理</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已驳回</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter((r) => r.status === 'dismissed').length}
            </div>
            <p className="text-xs text-muted-foreground">无效举报</p>
          </CardContent>
        </Card>
      </div>

      {pendingCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>注意</AlertTitle>
          <AlertDescription>
            有 {pendingCount} 条举报需要立即处理
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>举报列表</CardTitle>
          <CardDescription>查看和管理所有举报记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索举报内容..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="筛选状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="reviewing">审核中</SelectItem>
                  <SelectItem value="resolved">已处理</SelectItem>
                  <SelectItem value="dismissed">已驳回</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>举报内容</TableHead>
                <TableHead>举报原因</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>举报人</TableHead>
                <TableHead>时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    暂无举报记录
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="max-w-[200px] truncate">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-pointer hover:underline">
                                {report.postTitle}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{report.postTitle}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getReasonLabel(report.reason)}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(report.status)}</TableCell>
                      <TableCell>{report.reporterName}</TableCell>
                      <TableCell>{formatTime(report.createdAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedReport(report)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          查看详情
                        </Button>
                        {report.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedReport(report);
                              setIsProcessingDialogOpen(true);
                            }}
                            className="ml-2"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            处理
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>

          {filteredReports.length > pageSize && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {Array.from({ length: Math.ceil(filteredReports.length / pageSize) }, (_, i) => i + 1)
                  .filter(
                    (page) =>
                      page === 1 ||
                      page === Math.ceil(filteredReports.length / pageSize) ||
                      Math.abs(page - currentPage) <= 1
                  )
                  .map((page, index, arr) => (
                    <PaginationItem key={page}>
                      {index > 0 && arr[index - 1] !== page - 1 && (
                        <span className="px-2">...</span>
                      )}
                      <PaginationLink
                        onClick={() => setCurrentPage(page)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage((p) =>
                        Math.min(Math.ceil(filteredReports.length / pageSize), p + 1)
                      )
                    }
                    className={
                      currentPage === Math.ceil(filteredReports.length / pageSize)
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>举报详情</DialogTitle>
            <DialogDescription>
              举报 ID: {selectedReport?.id}
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div>
                <Label>帖子标题</Label>
                <p className="text-sm mt-1">{selectedReport.postTitle}</p>
              </div>
              <div>
                <Label>举报原因</Label>
                <Badge variant="outline" className="mt-1">
                  {getReasonLabel(selectedReport.reason)}
                </Badge>
              </div>
              <div>
                <Label>举报内容</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{selectedReport.content}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>举报人</Label>
                  <p className="text-sm mt-1">{selectedReport.reporterName}</p>
                </div>
                <div>
                  <Label>举报时间</Label>
                  <p className="text-sm mt-1">{formatTime(selectedReport.createdAt)}</p>
                </div>
              </div>
              <div>
                <Label>处理状态</Label>
                <div className="mt-1">
                  {getStatusBadge(selectedReport.status)}
                </div>
              </div>
              {selectedReport.handledBy && (
                <div>
                  <Label>处理人</Label>
                  <p className="text-sm mt-1">{selectedReport.handledBy}</p>
                </div>
              )}
              {selectedReport.actionTaken && (
                <div>
                  <Label>处理措施</Label>
                  <p className="text-sm mt-1">{selectedReport.actionTaken}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isProcessingDialogOpen}
        onOpenChange={setIsProcessingDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>处理举报</DialogTitle>
            <DialogDescription>
              请描述对举报的处理措施
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>处理措施</Label>
              <Textarea
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                placeholder="请输入处理措施，如：删除违规内容、警告用户等..."
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsProcessingDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={() => {
                if (selectedReport) {
                  handleStatusChange(selectedReport.id, 'resolved');
                }
              }}
              disabled={!actionTaken.trim()}
            >
              确认处理
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { DEFAULT_REPORTS };
```
