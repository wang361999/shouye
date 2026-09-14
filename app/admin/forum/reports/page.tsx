'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Flag,
  AlertCircle,
  User,
  Calendar,
  RefreshCw,
  Check,
  X,
  Eye,
} from 'lucide-react';

interface Report {
  id: string;
  reportType: string;
  reason: string;
  reporterId: string;
  reporterName: string;
  targetUserId?: string;
  targetUserName?: string;
  targetPostId?: string;
  targetPostTitle?: string;
  targetCommentId?: string;
  targetCommentContent?: string;
  status: 'PENDING' | 'RESOLVED' | 'REJECTED';
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  createdAt: string;
}

export default function ForumReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('admin_token');
    if (stored) setToken(stored);
  }, []);

  const fetchReports = useCallback(async () => {
    if (!token) {
      router.push('/admin/login');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(filterStatus !== 'all' && { status: filterStatus }),
      });

      const res = await fetch(`/api/forum/reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } finally {
      setLoading(false);
    }
  }, [token, filterStatus, router]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleResolve = async (report: Report, action: 'resolve' | 'reject', note: string) => {
    try {
      const res = await fetch(`/api/forum/reports/${report.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: action === 'resolve' ? 'RESOLVED' : 'REJECTED',
          resolutionNote: note,
        }),
      });

      if (res.ok) {
        fetchReports();
        setSelectedReport(null);
      }
    } catch {
      // ignore
    }
  };

  const getReportTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      SPAM: '广告 spam',
      ABUSE: '辱骂 abuse',
      OFF_TOPIC: '跑题 off-topic',
      COPYRIGHT: '侵权 copyright',
      OTHER: '其他 other',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
      PENDING: { label: '待处理', variant: 'destructive' },
      RESOLVED: { label: '已解决', variant: 'default' },
      REJECTED: { label: '已拒绝', variant: 'secondary' },
    };
    const badge = badges[status] || { label: status, variant: 'secondary' };
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">举报管理</h1>
          <p className="text-muted-foreground mt-1">
            处理用户举报
          </p>
        </div>
        <Button variant="outline" onClick={fetchReports}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 筛选 */}
      <div className="flex gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
        >
          <option value="all">全部状态</option>
          <option value="PENDING">待处理</option>
          <option value="RESOLVED">已解决</option>
          <option value="REJECTED">已拒绝</option>
        </select>
      </div>

      {/* 举报列表 */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Flag className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>没有举报记录</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">举报类型：{getReportTypeLabel(report.reportType)}</span>
                      {getStatusBadge(report.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      举报人：<span className="font-medium">{report.reporterName}</span>
                    </p>
                    {report.targetUserName && (
                      <p className="text-sm text-muted-foreground">
                        被举报人：<span className="font-medium">{report.targetUserName}</span>
                      </p>
                    )}
                    {report.targetPostTitle && (
                      <p className="text-sm text-muted-foreground">
                        相关帖子：<span className="font-medium">{report.targetPostTitle}</span>
                      </p>
                    )}
                    <p className="mt-2 text-sm">{report.reason}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(report.createdAt).toLocaleString('zh-CN')}
                      </span>
                      {report.resolvedByName && (
                        <span>处理人：{report.resolvedByName}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedReport(report)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 详情 Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">举报详情</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedReport(null)}
                >
                  ✕
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">举报类型</p>
                  <p className="font-medium">{getReportTypeLabel(selectedReport.reportType)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">举报原因</p>
                  <p className="font-medium">{selectedReport.reason}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">举报人</p>
                  <p className="font-medium">{selectedReport.reporterName}</p>
                </div>
                {selectedReport.targetUserName && (
                  <div>
                    <p className="text-sm text-muted-foreground">被举报人</p>
                    <p className="font-medium">{selectedReport.targetUserName}</p>
                  </div>
                )}
                {selectedReport.targetPostTitle && (
                  <div>
                    <p className="text-sm text-muted-foreground">相关帖子</p>
                    <p className="font-medium">{selectedReport.targetPostTitle}</p>
                  </div>
                )}
                {selectedReport.resolutionNote && (
                  <div>
                    <p className="text-sm text-muted-foreground">处理意见</p>
                    <p className="font-medium">{selectedReport.resolutionNote}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleResolve(selectedReport, 'reject', '')}
                  >
                    <X className="h-4 w-4 mr-2" />
                    拒绝
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      const note = prompt('请输入处理意见：');
                      if (note !== null) {
                        handleResolve(selectedReport, 'resolve', note);
                      }
                    }}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    确认处理
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
