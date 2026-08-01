"use client";

import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/utils";
import UserAvatar from "@/components/common/UserAvatar";
import toast from "react-hot-toast";
import Link from "next/link";

interface Report {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
  reporter: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

const REASON_MAP: Record<string, { label: string; icon: string; color: string }> = {
  spam: { label: "垃圾广告", icon: "📢", color: "bg-orange-50 text-orange-600 border-orange-200" },
  abuse: { label: "辱骂攻击", icon: "💢", color: "bg-red-50 text-red-600 border-red-200" },
  inappropriate: { label: "不当内容", icon: "⚠️", color: "bg-yellow-50 text-yellow-600 border-yellow-200" },
  other: { label: "其他", icon: "📋", color: "bg-gray-50 text-gray-600 border-gray-200" },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "待处理", color: "bg-yellow-50 text-yellow-600 border-yellow-200" },
  resolved: { label: "已处理", color: "bg-green-50 text-green-600 border-green-200" },
  dismissed: { label: "已驳回", color: "bg-gray-50 text-gray-500 border-gray-200" },
};

export default function AdminReportsPage() {
  const { token } = useAppStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
      });
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      const res = await fetch(`/api/forum/reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.data || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('获取举报列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleUpdateStatus = async (reportId: string, status: 'resolved' | 'dismissed') => {
    setActionLoading(reportId);
    try {
      const res = await fetch(`/api/forum/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(status === 'resolved' ? '举报已处理' : '举报已驳回');
        await fetchReports();
      } else {
        const data = await res.json();
        toast.error(data.error || '操作失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setActionLoading(null);
    }
  };

  const statusTabs = [
    { value: 'pending', label: '待处理' },
    { value: 'resolved', label: '已处理' },
    { value: 'dismissed', label: '已驳回' },
    { value: 'all', label: '全部' },
  ];

  return (
    <AdminLayout activeKey="forum-reports">
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🚩 举报管理</h1>
          <p className="text-sm text-gray-500 mt-1">处理用户举报的帖子和评论</p>
        </div>

        {/* 状态筛选 */}
        <div className="flex items-center gap-2">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setCurrentPage(1);
              }}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg border transition-colors",
                statusFilter === tab.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              )}
            >
              {tab.label}
              {tab.value === 'pending' && total > 0 && statusFilter === 'pending' && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-blue-500/30 rounded-full">
                  {total}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 举报列表 */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-4xl mb-3 opacity-40">✅</p>
            <p className="text-sm text-gray-500">暂无举报记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const reasonConfig = REASON_MAP[report.reason] || REASON_MAP.other;
              const statusConfig = STATUS_MAP[report.status] || STATUS_MAP.pending;
              const targetLink = report.targetType === 'post'
                ? `/forum/post/${report.targetId}`
                : `/forum`;

              return (
                <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  {/* 顶部：举报人信息 + 状态 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar username={report.reporter.username} avatar={report.reporter.avatar} size="sm" />
                      <div>
                        <span className="text-sm font-medium text-gray-700">{report.reporter.username}</span>
                        <span className="text-xs text-gray-400 ml-2">{formatTimeAgo(report.createdAt)}</span>
                      </div>
                    </div>
                    <span className={cn("inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border", statusConfig.color)}>
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* 举报内容 */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border", reasonConfig.color)}>
                        {reasonConfig.icon} {reasonConfig.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        举报对象: {report.targetType === 'post' ? '帖子' : '评论'}
                      </span>
                      <Link
                        href={targetLink}
                        target="_blank"
                        className="text-xs text-blue-500 hover:text-blue-600"
                      >
                        查看内容 →
                      </Link>
                    </div>
                    {report.description && (
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                        {report.description}
                      </p>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  {report.status === 'pending' && (
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handleUpdateStatus(report.id, 'resolved')}
                        disabled={actionLoading === report.id}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                      >
                        ✓ 标记已处理
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(report.id, 'dismissed')}
                        disabled={actionLoading === report.id}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        ✕ 驳回举报
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-md border transition-colors",
                    currentPage <= 1
                      ? "text-gray-300 border-gray-200 cursor-not-allowed"
                      : "text-gray-600 border-gray-300 hover:bg-gray-50"
                  )}
                >
                  上一页
                </button>
                <span className="text-sm text-gray-500">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-md border transition-colors",
                    currentPage >= totalPages
                      ? "text-gray-300 border-gray-200 cursor-not-allowed"
                      : "text-gray-600 border-gray-300 hover:bg-gray-50"
                  )}
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
