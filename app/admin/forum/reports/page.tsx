"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import { formatDateTime } from "@/lib/admin-utils";
import UserAvatar from "@/components/common/UserAvatar";
import toast from "react-hot-toast";
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Badge,
  StatusBadge,
  Pagination,
  EmptyState,
  LoadingState,
  Icons,
} from "@/components/admin/ui";

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

const REASON_MAP = {
  spam: { label: "垃圾广告", color: "yellow" as const },
  abuse: { label: "辱骂攻击", color: "red" as const },
  inappropriate: { label: "不当内容", color: "purple" as const },
  other: { label: "其他", color: "gray" as const },
};

const STATUS_MAP = {
  pending: { label: "待处理", color: "yellow" as const },
  resolved: { label: "已处理", color: "green" as const },
  dismissed: { label: "已驳回", color: "gray" as const },
};

const statusTabs = [
  { value: "pending", label: "待处理" },
  { value: "resolved", label: "已处理" },
  { value: "dismissed", label: "已驳回" },
  { value: "all", label: "全部" },
];

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
        limit: "20",
      });
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      const res = await adminFetch(`/api/forum/reports?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.data || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error("获取举报列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleUpdateStatus = async (reportId: string, status: "resolved" | "dismissed") => {
    if (actionLoading) return;
    setActionLoading(reportId);
    try {
      const res = await adminFetch(`/api/forum/reports/${reportId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(status === "resolved" ? "举报已处理" : "举报已驳回");
        await fetchReports();
      } else {
        const data = await res.json();
        toast.error(data.error || "操作失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <AdminLayout activeKey="forum-reports">
      <div className="space-y-6">
        {/* 页面标题 */}
        <PageHeader title="举报管理" subtitle="处理用户举报的帖子和评论" />

        {/* 状态筛选 */}
        <div className="flex items-center gap-2">
          {statusTabs.map((tab) => (
            <Button
              key={tab.value}
              variant={statusFilter === tab.value ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setStatusFilter(tab.value);
                setCurrentPage(1);
              }}
            >
              {tab.label}
              {tab.value === "pending" &&
                total > 0 &&
                statusFilter === "pending" && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-white/30 rounded-full">
                    {total}
                  </span>
                )}
            </Button>
          ))}
        </div>

        {/* 举报列表 */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardBody>
                  <LoadingState rows={3} />
                </CardBody>
              </Card>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icons.Check className="w-12 h-12" />}
              title="暂无举报记录"
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const reasonConfig = REASON_MAP[report.reason as keyof typeof REASON_MAP] || REASON_MAP.other;
              const targetLink =
                report.targetType === "post"
                  ? `/forum/post/${report.targetId}`
                  : `/forum`;

              return (
                <Card key={report.id}>
                  <CardBody>
                    {/* 顶部：举报人信息 + 状态 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          username={report.reporter.username}
                          avatar={report.reporter.avatar}
                          size="sm"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-700">
                            {report.reporter.username}
                          </span>
                          <span className="text-xs text-gray-400 ml-2">
                            {formatDateTime(report.createdAt)}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={report.status} map={STATUS_MAP} />
                    </div>

                    {/* 举报内容 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge color={reasonConfig.color}>{reasonConfig.label}</Badge>
                        <span className="text-xs text-gray-400">
                          举报对象: {report.targetType === "post" ? "帖子" : "评论"}
                        </span>
                        <Link
                          href={targetLink}
                          target="_blank"
                          className="text-xs text-blue-500 hover:text-blue-600 inline-flex items-center gap-0.5"
                        >
                          查看内容
                          <Icons.ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      {report.description && (
                        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                          {report.description}
                        </p>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    {report.status === "pending" && (
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleUpdateStatus(report.id, "resolved")}
                          disabled={actionLoading === report.id}
                        >
                          <Icons.Check className="w-3 h-3 mr-1 inline" />
                          标记已处理
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleUpdateStatus(report.id, "dismissed")}
                          disabled={actionLoading === report.id}
                        >
                          <Icons.Close className="w-3 h-3 mr-1 inline" />
                          驳回举报
                        </Button>
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}

            {/* 分页 */}
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
