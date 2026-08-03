"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { adminFetch } from "@/lib/admin-fetch";
import toast from "react-hot-toast";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  FormField,
  Icons,
} from "@/components/admin/ui";

export default function ProfilePage() {
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
      const res = await adminFetch("/api/auth/password", {
        method: "POST",
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
        <PageHeader
          title="个人中心"
          subtitle="管理您的账户信息和安全设置"
          actions={
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Icons.Key />
            </div>
          }
        />

        {/* 修改密码卡片 */}
        <Card>
          <CardHeader title="修改密码" subtitle="定期更换密码有助于保护账户安全" />
          <CardBody>
            <form onSubmit={handleSubmit} className="max-w-md space-y-5">
              {/* 当前密码 */}
              <FormField label="当前密码">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="请输入当前密码"
                  required
                />
              </FormField>

              {/* 新密码 */}
              <FormField label="新密码">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="请输入新密码（至少6位）"
                  required
                />
                {newPassword.length > 0 && newPassword.length < 6 && (
                  <p className="mt-1 text-xs text-red-500">密码长度不能少于6位</p>
                )}
              </FormField>

              {/* 确认新密码 */}
              <FormField label="确认新密码">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  required
                />
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">两次输入的密码不一致</p>
                )}
              </FormField>

              {/* 提交按钮 */}
              <div className="pt-2">
                <Button type="submit" loading={loading}>
                  {loading ? "提交中..." : "确认修改"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
}
