"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const { token } = useAppStore();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // ---- 前端校验 ----
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("请填写所有密码字段");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("新密码长度不能少于6位");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "修改失败");
        return;
      }

      toast.success(data.message || "密码修改成功");
      // 清空表单
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("修改失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminLayout activeKey="profile">
      <div className="space-y-6">
        {/* 页头 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            &#128273; 个人中心
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理您的账户信息和安全设置</p>
        </div>

        {/* 修改密码卡片 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">修改密码</h2>
          <p className="text-sm text-gray-500 mb-6">定期更换密码有助于保护账户安全</p>

          <form onSubmit={handleSubmit} className="max-w-md space-y-5">
            {/* 当前密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                当前密码
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="请输入当前密码"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 新密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                新密码
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入新密码（至少6位）"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {newPassword.length > 0 && newPassword.length < 6 && (
                <p className="mt-1 text-xs text-red-500">密码长度不能少于6位</p>
              )}
            </div>

            {/* 确认新密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                确认新密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入新密码"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-red-500">两次输入的密码不一致</p>
              )}
            </div>

            {/* 提交按钮 */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "提交中..." : "确认修改"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
