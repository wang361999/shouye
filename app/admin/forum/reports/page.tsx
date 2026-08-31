'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Shield,
  Check,
  X,
  Loader2,
  Search,
  Filter,
  ChevronDown,
  User,
  MessageSquare,
  Flag,
  Trash2,
  Eye,
  RefreshCw,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdminProtect } from '@/components/admin/AdminProtect';

interface Report {
  id: string;
  postId: string | null;
  commentId: string | null;
  reason: string;
  description: string;
  reporterId: string;
  reporterName: string;
  targetUserId: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
  updatedAt: string;
  post?: {
    id: string;
    title: string;
    content: string;
    authorName: string;
  };
  comment?: {
    id: string;
    content: string;
    authorName: string;
  };
  reporter?: {
    id: string;
    username: string;
    avatar?: string;
  };
}

const REASON_OPTIONS = [
  'spam',
  'abuse',
  'copyright',
  'misinformation',
  'inappropriate_content',
  'other',
];

const STATUS_OPTIONS = [
  { value: 'pending', label: '待处理' },
  { value: 'reviewed', label: '审核中' },
  { value: 'resolved', label: '已解决' },
  { value: 'dismissed', label: '已忽略' },
];

function getStatusColor(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'reviewed':
      return 'bg-blue-100 text-blue-800';
    case 'resolved':
      return 'bg-green-100 text-green-800';
    case 'dismissed':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'pending':
      return '待处理';
    case 'reviewed':
      return '审核中';
    case 'resolved':
      return '已解决';
    case 'dismissed':
      return '已忽略';
    default:
      return status;
  }
}

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterReason, setFilterReason] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterReason !== 'all') params.append('reason', filterReason);
      if (searchQuery) params.append('search', searchQuery);
      params.append('page', currentPage.toString());
      params.append('pageSize', pageSize.toString());

      const res = await fetch(`/api/forum/reports?${params}`);
      if (!res.ok) throw new Error('获取举报列表失败');

      const data = await res.json();
      setReports(data.reports || []);
    } catch (error) {
      console.error('[REPORTS FETCH ERROR]', error);
      toast.error('获取举报列表失败');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterReason, searchQuery, currentPage]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleStatusChange = async (reportId: string, newStatus: string) => {
    try {
      setActionLoading(reportId);
      const res = await fetch(`/api/forum/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, note: reviewNote }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '操作失败');
      }

      toast.success('操作成功');
      setShowReviewDialog(false);
      setReviewNote('');
      setSelectedReport(null);
      fetchReports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm('确定要删除这条举报记录吗？此操作不可恢复。')) {
      return;
    }

    try {
      setActionLoading(reportId);
      const res = await fetch(`/api/forum/reports/${reportId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '删除失败');
      }

      toast.success('举报记录已删除');
      fetchReports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setActionLoading(null);
    }
  };

  const openReview = (report: Report) => {
    setSelectedReport(report);
    setShowReviewDialog(true);
  };

  const filteredReports = reports.filter((report) => {
    if (filterStatus !== 'all' && report.status !== filterStatus) return false;
    if (filterReason !== 'all' && report.reason !== filterReason) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        report.reporterName.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query) ||
        (report.post?.title || '').toLowerCase().includes(query) ||
        (report.comment?.content || '').toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <AdminProtect>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminProtect>
    );
  }

  return (
    <AdminProtect>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">举报管理</h1>
            <p className="text-muted-foreground">
              管理和处理用户举报内容
            </p>
          </div>
          <Button variant="outline" onClick={fetchReports} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>筛选条件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="搜索举报内容..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <Select
                value={filterStatus}
                onValueChange={(value) => {
                  setFilterStatus(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterReason}
                onValueChange={(value) => {
                  setFilterReason(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="原因" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部原因</SelectItem>
                  {REASON_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              举报列表
              <Badge variant="secondary" className="ml-2">
                {filteredReports.length} 条
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredReports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Flag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>暂无举报记录</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <Avatar>
                        <AvatarImage src={report.reporter?.avatar} />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{report.reporterName}</span>
                        <Badge className={getStatusColor(report.status)}>
                          {getStatusLabel(report.status)}
                        </Badge>
                        <Badge variant="outline">{report.reason}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(report.createdAt).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {report.description}
                      </p>
                      {report.post && (
                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground">帖子:</span>
                          <Link
                            href={`/forum/post/${report.postId}`}
                            className="ml-2 text-primary hover:underline"
                          >
                            {report.post.title}
                          </Link>
                        </div>
                      )}
                      {report.comment && (
                        <div className="mt-1 text-sm">
                          <span className="text-muted-foreground">评论:</span>
                          <span className="ml-2 text-muted-foreground line-clamp-1">
                            {report.comment.content}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReview(report)}
                      >
                        处理
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(report.id)}
                        disabled={actionLoading === report.id}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>处理举报</DialogTitle>
              <DialogDescription>
                查看举报详情并进行处理
              </DialogDescription>
            </DialogHeader>
            {selectedReport && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">举报人:</span>
                    <span className="ml-2 font-medium">{selectedReport.reporterName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">举报原因:</span>
                    <span className="ml-2">
                      <Badge variant="outline">{selectedReport.reason}</Badge>
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">创建时间:</span>
                    <span className="ml-2">
                      {new Date(selectedReport.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">当前状态:</span>
                    <span className="ml-2">
                      <Badge className={getStatusColor(selectedReport.status)}>
                        {getStatusLabel(selectedReport.status)}
                      </Badge>
                    </span>
                  </div>
                </div>

                {selectedReport.post && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4" />
                      <span className="font-medium">相关帖子</span>
                    </div>
                    <Link
                      href={`/forum/post/${selectedReport.postId}`}
                      className="text-primary hover:underline"
                    >
                      {selectedReport.post.title}
                    </Link>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                      {selectedReport.post.content}
                    </p>
                  </div>
                )}

                {selectedReport.comment && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4" />
                      <span className="font-medium">相关评论</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {selectedReport.comment.content}
                    </p>
                  </div>
                )}

                <div className="p-4 bg-muted rounded-lg">
                  <span className="font-medium">举报描述</span>
                  <p className="text-sm text-muted-foreground mt-2">
                    {selectedReport.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">处理意见</label>
                  <Textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="输入处理意见..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Select
                    value={selectedReport.status}
                    onValueChange={(value) => {
                      handleStatusChange(selectedReport.id, value);
                    }}
                    disabled={actionLoading === selectedReport.id}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {actionLoading === selectedReport.id && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowReviewDialog(false)}
              >
                取消
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminProtect>
  );
}
