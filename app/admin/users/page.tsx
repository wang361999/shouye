"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

// ============ 类型定义 ============
interface UserItem {
  id: string;
  username: string;
  email: string;
  role: "ADMIN" | "USER";
  avatar: string | null;
  status: string;
  mutedUntil: string | null;
  postCount: number;
  commentCount: number;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type RoleFilter = "all" | "ADMIN" | "USER";
type StatusFilter = "all" | "active" | "muted" | "banned";

const PAGE_SIZE = 20;

// ============ 操作类型 ============
type ActionType = "mute" | "unmute" | "ban" | "unban" | "role" | "resetPassword" | "delete";

// ============ 格式化日期 ============
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

// ============ 页面组件 ============
export default function UsersListPage() {
  const { token, user } = useAppStore();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // 操作面板状态
  const [actionTarget, setActionTarget] = useState<UserItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [muteHours, setMuteHours] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 防抖搜索
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============ 获取用户列表 ============
  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(PAGE_SIZE),
      });
      if (searchKeyword.trim()) params.set("search", searchKeyword.trim());
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        toast.error("登录已过期，请重新登录");
        return;
      }
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setUsers(data.data || []);
      setTotalUsers(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.error("获取用户列表失败");
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, searchKeyword, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 搜索防抖
  function handleSearchChange(value: string) {
    setSearchKeyword(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setCurrentPage(1);
    }, 400);
  }

  // 筛选变化时回到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, statusFilter]);

  // ============ 执行操作 ============
  async function executeAction(action: ActionType, userId: string, extra?: Record<string, unknown>) {
    if (!token) return;
    try {
      setActionLoading(true);
      const body: Record<string, unknown> = { action, userId, ...extra };
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "操作失败");
        return;
      }
      const data = await res.json();
      toast.success(data.message || "操作成功");
      closeActionPanel();
      fetchUsers();
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setActionLoading(false);
    }
  }

  // ============ 操作按钮事件 ============
  function handleMute() {
    if (!actionTarget) return;
    const hours = parseInt(muteHours);
    if (!hours || hours <= 0) {
      toast.error("请输入有效的禁言时长");
      return;
    }
    executeAction("mute", actionTarget.id, { hours });
  }

  function handleUnmute() {
    if (!actionTarget) return;
    executeAction("unmute", actionTarget.id);
  }

  function handleBan() {
    if (!actionTarget) return;
    executeAction("ban", actionTarget.id);
  }

  function handleUnban() {
    if (!actionTarget) return;
    executeAction("unban", actionTarget.id);
  }

  function handleRoleChange() {
    if (!actionTarget) return;
    const newRole = actionTarget.role === "ADMIN" ? "USER" : "ADMIN";
    executeAction("role", actionTarget.id, { role: newRole });
  }

  function handleResetPassword() {
    if (!actionTarget) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error("新密码长度不能少于6位");
      return;
    }
    executeAction("resetPassword", actionTarget.id, { newPassword });
  }

  function handleDelete() {
    if (!actionTarget) return;
    executeAction("delete", actionTarget.id);
  }

  function closeActionPanel() {
    setActionTarget(null);
    setMuteHours("");
    setNewPassword("");
    setConfirmDelete(false);
  }

  const isSelf = actionTarget?.id === user?.id;

  // ============ 状态标签渲染 ============
  function renderStatus(status: string) {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700 border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            正常
          </span>
        );
      case "muted":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-orange-50 text-orange-700 border border-orange-200">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            禁言
          </span>
        );
      case "banned":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            封禁
          </span>
        );
      default:
        return <span className="text-xs text-gray-500">{status}</span>;
    }
  }

  function renderRole(role: string) {
    if (role === "ADMIN") {
      return (
        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200">
          管理员
        </span>
      );
    }
    return (
      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
        用户
      </span>
    );
  }

  return (
    <AdminLayout activeKey="users">
      <div className="space-y-6">
        {/* 页头 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">👥 用户管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理平台注册用户、权限和状态</p>
        </div>

        {/* 搜索筛选栏 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* 搜索框 */}
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
                value={searchKeyword}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="搜索用户名或邮箱..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {/* 角色筛选 */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部角色</option>
              <option value="ADMIN">管理员</option>
              <option value="USER">普通用户</option>
            </select>
            {/* 状态筛选 */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部状态</option>
              <option value="active">正常</option>
              <option value="muted">禁言</option>
              <option value="banned">封禁</option>
            </select>
          </div>
        </div>

        {/* 用户表格 */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="animate-pulse p-6 space-y-4">
              <div className="h-10 bg-gray-100 rounded" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-gray-500 mb-4">
              {searchKeyword || roleFilter !== "all" || statusFilter !== "all"
                ? "没有符合条件的用户"
                : "暂无注册用户"}
            </p>
            {(searchKeyword || roleFilter !== "all" || statusFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchKeyword("");
                  setRoleFilter("all");
                  setStatusFilter("all");
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
                      头像
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      用户名
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      邮箱
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      角色
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      发帖数
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      状态
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      注册时间
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* 头像 */}
                      <td className="px-4 py-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center text-sm font-medium">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                      </td>
                      {/* 用户名 */}
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {u.username}
                      </td>
                      {/* 邮箱 */}
                      <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">
                        {u.email}
                      </td>
                      {/* 角色 */}
                      <td className="px-4 py-3">{renderRole(u.role)}</td>
                      {/* 发帖数 */}
                      <td className="px-4 py-3 text-gray-600">{u.postCount}</td>
                      {/* 状态 */}
                      <td className="px-4 py-3">{renderStatus(u.status)}</td>
                      {/* 注册时间 */}
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(u.createdAt)}
                      </td>
                      {/* 操作 */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setActionTarget(u)}
                          title="管理操作"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
                        >
                          🔧 操作
                        </button>
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
              共 <span className="font-medium text-gray-700">{totalUsers}</span> 个用户
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* ============ 操作面板模态框 ============ */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !actionLoading && closeActionPanel()}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center font-medium">
                  {actionTarget.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {actionTarget.username}
                  </div>
                  <div className="text-xs text-gray-500">{actionTarget.email}</div>
                </div>
              </div>
              <button
                onClick={closeActionPanel}
                disabled={actionLoading}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 操作列表 */}
            <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {/* 禁言操作 */}
              {actionTarget.status === "active" && (
                <div className="border border-orange-200 rounded-lg p-3 bg-orange-50/50">
                  <div className="text-sm font-medium text-orange-800 mb-2">禁言用户</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={muteHours}
                      onChange={(e) => setMuteHours(e.target.value)}
                      placeholder="时长"
                      disabled={isSelf}
                      className="flex-1 px-3 py-1.5 border border-orange-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm text-gray-600 whitespace-nowrap">小时</span>
                    <button
                      onClick={handleMute}
                      disabled={actionLoading || isSelf || !muteHours}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      确认禁言
                    </button>
                  </div>
                </div>
              )}

              {/* 解除禁言 */}
              {actionTarget.status === "muted" && (
                <div className="flex items-center justify-between border border-green-200 rounded-lg p-3 bg-green-50/50">
                  <span className="text-sm text-green-800">解除禁言</span>
                  <button
                    onClick={handleUnmute}
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    解除
                  </button>
                </div>
              )}

              {/* 封禁操作 */}
              {actionTarget.status !== "banned" && (
                <div className="flex items-center justify-between border border-red-200 rounded-lg p-3 bg-red-50/50">
                  <span className="text-sm text-red-800">封禁用户</span>
                  <button
                    onClick={handleBan}
                    disabled={actionLoading || isSelf}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isSelf ? "不能封禁自己" : "封禁用户"}
                  >
                    封禁
                  </button>
                </div>
              )}

              {/* 解除封禁 */}
              {actionTarget.status === "banned" && (
                <div className="flex items-center justify-between border border-green-200 rounded-lg p-3 bg-green-50/50">
                  <span className="text-sm text-green-800">解除封禁</span>
                  <button
                    onClick={handleUnban}
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    解封
                  </button>
                </div>
              )}

              {/* 修改角色 */}
              <div className="flex items-center justify-between border border-purple-200 rounded-lg p-3 bg-purple-50/50">
                <div className="text-sm text-purple-800">
                  修改角色
                  {actionTarget.role === "ADMIN" ? " → 用户" : " → 管理员"}
                  {isSelf && (
                    <span className="ml-1 text-xs text-gray-500">(不能修改自己)</span>
                  )}
                </div>
                <button
                  onClick={handleRoleChange}
                  disabled={actionLoading || isSelf}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  切换
                </button>
              </div>

              {/* 重置密码 */}
              <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/50">
                <div className="text-sm font-medium text-blue-800 mb-2">重置密码</div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="输入新密码（至少6位）"
                    className="flex-1 px-3 py-1.5 border border-blue-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    onClick={handleResetPassword}
                    disabled={actionLoading || !newPassword || newPassword.length < 6}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    确认重置
                  </button>
                </div>
              </div>

              {/* 删除用户 */}
              <div className="border border-red-300 rounded-lg p-3 bg-red-50">
                {!confirmDelete ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-800 font-medium">删除用户</span>
                    <button
                      onClick={() => setConfirmDelete(true)}
                      disabled={actionLoading || isSelf}
                      className="px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={isSelf ? "不能删除自己" : "删除用户"}
                    >
                      {isSelf ? "不可操作" : "删除"}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm text-red-800 mb-3 font-medium">
                      确定要永久删除用户「{actionTarget.username}」吗？此操作不可撤销，该用户的所有帖子将被删除。
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={actionLoading}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? "删除中..." : "确认删除"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
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
