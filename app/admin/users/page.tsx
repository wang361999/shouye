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
  StatusBadge,
  DataTable,
  IconButton,
  SearchInput,
  Select,
  Modal,
  Input,
  EmptyState,
  TableLoading,
  Pagination,
  Icons,
} from "@/components/admin/ui";

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

// ============ 状态 / 角色映射 ============
const STATUS_MAP = {
  active: { label: "正常", color: "green" as const },
  muted: { label: "禁言", color: "yellow" as const },
  banned: { label: "封禁", color: "red" as const },
};

const ROLE_MAP = {
  ADMIN: { label: "管理员", color: "purple" as const },
  USER: { label: "用户", color: "blue" as const },
};

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

      const res = await adminFetch(`/api/admin/users?${params}`);
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
      const res = await adminFetch("/api/admin/users", {
        method: "POST",
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

  return (
    <AdminLayout activeKey="users">
      <div className="space-y-6">
        {/* 页头 */}
        <PageHeader title="用户管理" subtitle="管理平台注册用户、权限和状态" />

        {/* 搜索筛选栏 */}
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-3">
              {/* 搜索框 */}
              <SearchInput
                value={searchKeyword}
                onChange={handleSearchChange}
                placeholder="搜索用户名或邮箱..."
              />
              {/* 角色筛选 */}
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              >
                <option value="all">全部角色</option>
                <option value="ADMIN">管理员</option>
                <option value="USER">普通用户</option>
              </Select>
              {/* 状态筛选 */}
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">全部状态</option>
                <option value="active">正常</option>
                <option value="muted">禁言</option>
                <option value="banned">封禁</option>
              </Select>
            </div>
          </CardBody>
        </Card>

        {/* 用户表格 */}
        {loading ? (
          <Card>
            <DataTable headers={["头像", "用户名", "邮箱", "角色", "发帖数", "状态", "注册时间", "操作"]}>
              <TableLoading cols={8} rows={6} />
            </DataTable>
          </Card>
        ) : users.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icons.Users className="w-12 h-12" />}
              title={
                searchKeyword || roleFilter !== "all" || statusFilter !== "all"
                  ? "没有符合条件的用户"
                  : "暂无注册用户"
              }
              action={
                searchKeyword || roleFilter !== "all" || statusFilter !== "all" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearchKeyword("");
                      setRoleFilter("all");
                      setStatusFilter("all");
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
            <DataTable headers={["头像", "用户名", "邮箱", "角色", "发帖数", "状态", "注册时间", "操作"]}>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  {/* 头像 */}
                  <td className="px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center text-sm font-medium">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                  </td>
                  {/* 用户名 */}
                  <td className="px-4 py-3 font-medium text-gray-900">{u.username}</td>
                  {/* 邮箱 */}
                  <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">
                    {u.email}
                  </td>
                  {/* 角色 */}
                  <td className="px-4 py-3">
                    <StatusBadge status={u.role} map={ROLE_MAP} />
                  </td>
                  {/* 发帖数 */}
                  <td className="px-4 py-3 text-gray-600">{u.postCount}</td>
                  {/* 状态 */}
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} map={STATUS_MAP} />
                  </td>
                  {/* 注册时间 */}
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDateTime(u.createdAt)}
                  </td>
                  {/* 操作 */}
                  <td className="px-4 py-3 text-right">
                    <IconButton
                      icon={<Icons.Tool />}
                      onClick={() => setActionTarget(u)}
                      title="管理操作"
                    />
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
              共 <span className="font-medium text-gray-700">{totalUsers}</span> 个用户
            </div>
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* ============ 操作面板模态框 ============ */}
      <Modal
        open={!!actionTarget}
        onClose={() => {
          if (!actionLoading) closeActionPanel();
        }}
        title="管理操作"
      >
        {actionTarget && (
          <div className="space-y-3">
            {/* 用户信息 */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center font-medium">
                {actionTarget.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-gray-900">{actionTarget.username}</div>
                <div className="text-xs text-gray-500">{actionTarget.email}</div>
              </div>
            </div>

            {/* 禁言操作 */}
            {actionTarget.status === "active" && (
              <div className="border border-orange-200 rounded-lg p-3 bg-orange-50/50">
                <div className="text-sm font-medium text-orange-800 mb-2">禁言用户</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={muteHours}
                    onChange={(e) => setMuteHours(e.target.value)}
                    placeholder="时长"
                    disabled={isSelf}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-600 whitespace-nowrap">小时</span>
                  <Button
                    size="sm"
                    onClick={handleMute}
                    disabled={actionLoading || isSelf || !muteHours}
                  >
                    确认禁言
                  </Button>
                </div>
              </div>
            )}

            {/* 解除禁言 */}
            {actionTarget.status === "muted" && (
              <div className="flex items-center justify-between border border-green-200 rounded-lg p-3 bg-green-50/50">
                <span className="text-sm text-green-800">解除禁言</span>
                <Button size="sm" onClick={handleUnmute} disabled={actionLoading}>
                  解除
                </Button>
              </div>
            )}

            {/* 封禁操作 */}
            {actionTarget.status !== "banned" && (
              <div className="flex items-center justify-between border border-red-200 rounded-lg p-3 bg-red-50/50">
                <span className="text-sm text-red-800">封禁用户</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleBan}
                  disabled={actionLoading || isSelf}
                >
                  封禁
                </Button>
              </div>
            )}

            {/* 解除封禁 */}
            {actionTarget.status === "banned" && (
              <div className="flex items-center justify-between border border-green-200 rounded-lg p-3 bg-green-50/50">
                <span className="text-sm text-green-800">解除封禁</span>
                <Button size="sm" onClick={handleUnban} disabled={actionLoading}>
                  解封
                </Button>
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
              <Button
                size="sm"
                onClick={handleRoleChange}
                disabled={actionLoading || isSelf}
              >
                切换
              </Button>
            </div>

            {/* 重置密码 */}
            <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/50">
              <div className="text-sm font-medium text-blue-800 mb-2">重置密码</div>
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="输入新密码（至少6位）"
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleResetPassword}
                  disabled={actionLoading || !newPassword || newPassword.length < 6}
                >
                  确认重置
                </Button>
              </div>
            </div>

            {/* 删除用户 */}
            <div className="border border-red-300 rounded-lg p-3 bg-red-50">
              {!confirmDelete ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-800 font-medium">删除用户</span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    disabled={actionLoading || isSelf}
                  >
                    {isSelf ? "不可操作" : "删除"}
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-red-800 mb-3 font-medium">
                    确定要永久删除用户「{actionTarget.username}」吗？此操作不可撤销，该用户的所有帖子将被删除。
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                      disabled={actionLoading}
                    >
                      取消
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleDelete}
                      loading={actionLoading}
                    >
                      确认删除
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
