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
import { Search, Trash2, Eye, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Report {
  id: string;
  reporterId: string;
  targetId: string;
  targetType: 'post' | 'comment' | 'user';
  reason: string;
  description: string;
  status: 'pending' | 'processed' | 'dismissed';
  processedBy?: string;
  processedAt?: string;
  createdAt: string;
  reporter: {
    id: string;
    username: string;
    avatar: string;
  };
  target: any;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [processingReport, setProcessingReport] = useState<Report | null>(null);
  const [processNote, setProcessNote] = useState('');
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // 获取举报列表
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/forum/reports');
      if (!response.ok) throw new Error('获取举报列表失败');
      const data = await response.json();
      setReports(data.reports || []);
    } catch (error) {
      console.error('获取举报失败:', error);
      toast.error('获取举报列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // 获取 token
  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) {
      setToken(stored);
    }
  }, []);

  // 处理举报
  const handleProcess = async (reportId: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`/api/forum/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action === 'approve' ? 'processed' : 'dismissed',
          note: processNote,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '处理失败');
      }

      toast.success('举报已处理');
      setShowProcessDialog(false);
      setProcessingReport(null);
      setProcessNote('');
      fetchReports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '处理失败');
    }
  };

  // 删除举报
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条举报记录吗？')) return;

    try {
      const response = await fetch(`/api/forum/reports/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '删除失败');
      }

      toast.success('举报记录已删除');
      fetchReports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  // 搜索举报
  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reporter.username.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'pending' && report.status === 'pending') ||
      (filterStatus === 'processed' && report.status === 'processed') ||
      (filterStatus === 'dismissed' && report.status === 'dismissed');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">举报管理</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>举报列表</CardTitle>
          <CardDescription>管理用户的举报记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索举报..."
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
                <SelectItem value="pending">待处理</SelectItem>
                <SelectItem value="processed">已处理</SelectItem>
                <SelectItem value="dismissed">已忽略</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无举报记录
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>举报人</TableHead>
                  <TableHead>举报类型</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {report.reporter.avatar ? (
                          <img
                            src={report.reporter.avatar}
                            alt={report.reporter.username}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            {report.reporter.username[0].toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium">{report.reporter.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {report.targetType === 'post' ? '帖子' :
                         report.targetType === 'comment' ? '评论' : '用户'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">{report.reason}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="line-clamp-2">{report.description}</div>
                    </TableCell>
                    <TableCell>
                      {report.status === 'pending' ? (
                        <Badge variant="warning">待处理</Badge>
                      ) : report.status === 'processed' ? (
                        <Badge variant="default">已处理</Badge>
                      ) : (
                        <Badge variant="secondary">已忽略</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(report.createdAt).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href={report.target?.url || '#'} target="_blank" rel="noopener noreferrer">
                            <Eye className="w-4 h-4" />
                          </a>
                        </Button>
                        {report.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setProcessingReport(report);
                              setShowProcessDialog(true);
                            }}
                          >
                            <Check className="w-4 h-4 text-green-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(report.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
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

      {/* 处理举报对话框 */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>处理举报</DialogTitle>
            <DialogDescription>
              选择处理方式并添加备注
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="note">处理备注</Label>
              <Textarea
                id="note"
                value={processNote}
                onChange={(e) => setProcessNote(e.target.value)}
                rows={3}
                placeholder="添加处理备注（可选）"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleProcess(processingReport!.id, 'reject')}
            >
              <X className="w-4 h-4 mr-2" />
              忽略举报
            </Button>
            <Button
              variant="default"
              onClick={() => handleProcess(processingReport!.id, 'approve')}
            >
              <Check className="w-4 h-4 mr-2" />
              确认处理
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
