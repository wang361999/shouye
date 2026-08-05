"use client";

import { useState } from "react";
import toast from "react-hot-toast";

interface ChangePasswordFormProps {
  token: string;
}

export default function ChangePasswordForm({ token }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // 新密码长度不足提示
  const showNewPasswordError =
    newPassword.length > 0 && newPassword.length < 6;
  // 两次密码不一致提示
  const showConfirmError =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  function resetFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    // 校验所有字段已填写
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("请填写所有密码字段");
      return;
    }
    // 校验新密码长度
    if (newPassword.length < 6) {
      toast.error("新密码长度不能少于 6 位");
      return;
    }
    // 校验两次密码一致
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "修改失败");
      }

      toast.success(data.message || "密码修改成功");
      resetFields();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "修改失败，请稍后重试";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* 标题行 */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">🔑</span>
        <h2 className="text-lg font-semibold text-gray-900">修改密码</h2>
      </div>
      <p className="text-[11px] sm:text-sm text-gray-500 mb-6">
        定期更换密码有助于保护账户安全
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 当前密码 */}
        <div>
          <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
            当前密码
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="请输入当前密码"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 新密码 */}
        <div>
          <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
            新密码
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="请输入新密码（至少 6 位）"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {showNewPasswordError && (
            <p className="mt-1 text-xs text-red-500">
              密码长度不能少于 6 位
            </p>
          )}
        </div>

        {/* 确认新密码 */}
        <div>
          <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
            确认新密码
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="请再次输入新密码"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {showConfirmError && (
            <p className="mt-1 text-xs text-red-500">
              两次输入的密码不一致
            </p>
          )}
        </div>

        {/* 提交按钮 */}
        <div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-[13px] sm:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "提交中..." : "确认修改"}
          </button>
        </div>
      </form>
    </div>
  );
}
