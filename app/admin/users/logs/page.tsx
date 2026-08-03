"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import { formatDateTime } from "@/lib/admin-utils";
import toast from "react-hot-toast";
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Badge,
  DataTable,
  SearchInput,
  Select,
  EmptyState,
  TableLoading,
  Pagination,
  Icons,
} from "@/components/admin/ui";

// ============ 类型定义 ============
interface OperationLogItem {
  id: string;
  userId: string | null;
  username: string | null;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
  createdAt: string;
}

// ============ 操作类型映射 ============
const ACTION_MAP = {
  create_tool: { label: "创建工具", color: "green" as const },
  delete_tool: { label: "删除工具", color: "red" as const },
  create_post: { label: "创建帖子", color: "green" as const },
  delete_post: { label: "删除帖子", color: "red" as const },
  ban_user: { label: "封禁用户", color: "red" as const },
  unban_user: { label: "解封用户", color: "green" as const },
  mute_user: { label: "禁言用户", color: "yellow" as const },
  unmute_user: { label: "解除禁言", color: "green" as const },
  change_role: { label: "修改角色", color: "purple" as const },
  reset_password: { label: "重置密码", color: "blue" as const },
  delete_user: { label: "删除用户", color: "red" as const },
  system_setting: { label: "系统设置", color: "gray" as const },
};

// 操作类型筛选项
const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "全部操作类型" },
  { value: "create_tool", label: "创建工具" },
  { value: "delete_tool", label: "删除工具" },
  { value: "create_post", label: "创建帖子" },
  { value: "delete_post", label: "删除帖子" },
  { value: "ban_user", label: "封禁用户" },
  { value: "unban_user", label: "解封用户" },
  { value: "mute_user", label: "禁言用户" },
  { value: "unmute_user", label: "解除禁言" },
  { value: "change_role", label: "修改角色" },
  { value: "reset_password", label: "重置密码" },
  { value: "delete_user", label: "删除用户" },
  { value: "system_setting", label: "系统设置" },
];

const PAGE_SIZE = 20;

// ============ 页面组件 ============
export default function OperationLogsPage() {
  const { token } = useAppStore();

  const [logs, setLogs] = useState<OperationLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [usernameKeyword, setUsernameKeyword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // 防抖搜索
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============ 获取日志列表 ============
  const fetchLogs = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        type: "logs",
        page: String(currentPage),
        limit: String(PAGE_SIZE),
      });
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (usernameKeyword.trim()) params.set("username", usernameKeyword.trim());

      const res = await adminFetch(`/api/admin/users?${params}`);
      if (res.status === 401) {
        toast.error("登录已过期，请重新登录");
        return;
      }
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setLogs(data.data || []);
      setTotalLogs(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.error("获取操作日志失败");
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, actionFilter, usernameKeyword]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 搜索防抖
  function handleUsernameChange(value: string) {
    setUsernameKeyword(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setCurrentPage(1);
    }, 400);
  }

  // 筛选变化时回到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [actionFilter]);

  // ============ 渲染操作类型标签 ============
  function renderActionTag(action: string) {
    const meta = ACTION_MAP[action as keyof typeof ACTION_MAP];
    if (meta) {
      return <Badge color={meta.color}>{meta.label}</Badge>;
    }
    return <Badge color="gray">{action}</Badge>;
  }

  return (
    <AdminLayout activeKey="users-logs">
      <div className="space-y-6">
        {/* 页头 */}
        <PageHeader title="操作日志" subtitle="查看管理员的操作记录和系统活动" />

        {/* 搜索筛选栏 */}
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-3">
              {/* 操作类型筛选 */}
              <Select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              {/* 操作人搜索框 */}
              <SearchInput
                value={usernameKeyword}
                onChange={handleUsernameChange}
                placeholder="搜索操作人..."
              />
            </div>
          </CardBody>
        </Card>

        {/* 日志表格 */}
        {loading ? (
          <Card>
            <DataTable headers={["时间", "操作人", "操作类型", "操作对象", "详情", "IP地址"]}>
              <TableLoading cols={6} rows={7} />
            </DataTable>
          </Card>
        ) : logs.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icons.Scroll className="w-12 h-12" />}
              title={
                actionFilter !== "all" || usernameKeyword
                  ? "没有符合条件的日志"
                  : "暂无操作日志"
              }
              action={
                actionFilter !== "all" || usernameKeyword ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setActionFilter("all");
                      setUsernameKeyword("");
                    }}
                  >
                    清空筛选条件
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card>
            <DataTable headers={["时间", "操作人", "操作类型", "操作对象", "详情", "IP地址"]}>
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  {/* 时间 */}
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                  {/* 操作人 */}
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {log.username || <span className="text-gray-400">未知用户</span>}
                  </td>
                  {/* 操作类型 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {renderActionTag(log.action)}
                  </td>
                  {/* 操作对象 */}
                  <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">
                    {log.target || <span className="text-gray-400">-</span>}
                  </td>
                  {/* 详情 */}
                  <td className="px-4 py-3 text-gray-600 max-w-[280px]">
                    {log.detail ? (
                      <span className="block truncate" title={log.detail}>
                        {log.detail}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  {/* IP地址 */}
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                    {log.ip || <span className="text-gray-400">-</span>}
                  </td>
                </tr>
              ))}
            </DataTable>
          </Card>
        )}

        {/* 底部：总数 + 分页 */}
        {!loading && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-gray-500">
              共 <span className="font-medium text-gray-700">{totalLogs}</span> 条日志
            </div>
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
