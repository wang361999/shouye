"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import { formatDateTime } from "@/lib/admin-utils";
import toast from "react-hot-toast";

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
interface ActionMeta {
  label: string;
  color: string;
}

const ACTION_MAP: Record<string, ActionMeta> = {
  create_tool: { label: "创建工具", color: "bg-green-50 text-green-700 border-green-200" },
  delete_tool: { label: "删除工具", color: "bg-red-50 text-red-700 border-red-200" },
  create_post: { label: "创建帖子", color: "bg-green-50 text-green-700 border-green-200" },
  delete_post: { label: "删除帖子", color: "bg-red-50 text-red-700 border-red-200" },
  ban_user: { label: "封禁用户", color: "bg-red-50 text-red-700 border-red-200" },
  unban_user: { label: "解封用户", color: "bg-green-50 text-green-700 border-green-200" },
  mute_user: { label: "禁言用户", color: "bg-orange-50 text-orange-700 border-orange-200" },
  unmute_user: { label: "解除禁言", color: "bg-green-50 text-green-700 border-green-200" },
  change_role: { label: "修改角色", color: "bg-purple-50 text-purple-700 border-purple-200" },
  reset_password: { label: "重置密码", color: "bg-blue-50 text-blue-700 border-blue-200" },
  delete_user: { label: "删除用户", color: "bg-red-50 text-red-700 border-red-200" },
  system_setting: { label: "系统设置", color: "bg-gray-50 text-gray-700 border-gray-200" },
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
    const meta = ACTION_MAP[action];
    if (meta) {
      return (
        <span
          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${meta.color}`}
        >
          {meta.label}
        </span>
      );
    }
    return (
      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-50 text-gray-700 border border-gray-200">
        {action}
      </span>
    );
  }

  return (
    <AdminLayout activeKey="users-logs">
      <div className="space-y-6">
        {/* 页头 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 操作日志</h1>
          <p className="text-sm text-gray-500 mt-1">查看管理员的操作记录和系统活动</p>
        </div>

        {/* 搜索筛选栏 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* 操作类型筛选 */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {/* 操作人搜索框 */}
            <div className="relative flex-1 min-w-[200px]">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={usernameKeyword}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="搜索操作人..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* 日志表格 */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="animate-pulse p-6 space-y-4">
              <div className="h-10 bg-gray-100 rounded" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-gray-500 mb-4">
              {actionFilter !== "all" || usernameKeyword
                ? "没有符合条件的日志"
                : "暂无操作日志"}
            </p>
            {(actionFilter !== "all" || usernameKeyword) && (
              <button
                onClick={() => {
                  setActionFilter("all");
                  setUsernameKeyword("");
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                清空筛选条件
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      时间
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      操作人
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      操作类型
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      操作对象
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      详情
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      IP地址
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* 时间 */}
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      {/* 操作人 */}
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {log.username || (
                          <span className="text-gray-400">未知用户</span>
                        )}
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
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 底部：总数 + 分页 */}
        {!loading && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-gray-500">
              共 <span className="font-medium text-gray-700">{totalLogs}</span> 条日志
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

// ============ 分页器组件 ============
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | string)[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        上一页
      </button>
      {pages.map((p, i) =>
        typeof p === "number" ? (
          <button
            key={i}
            onClick={() => onPageChange(p)}
            className={`min-w-[32px] px-2 py-1.5 text-sm rounded-lg border transition-colors ${
              p === currentPage
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {p}
          </button>
        ) : (
          <span key={i} className="px-2 text-gray-400">
            {p}
          </span>
        )
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        下一页
      </button>
    </div>
  );
}
