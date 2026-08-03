"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
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
  Spinner,
  Icons,
} from "@/components/admin/ui";

export default function GeneralSettingsPage() {
  const { token } = useAppStore();

  const [form, setForm] = useState({
    site_name: "",
    site_description: "",
    site_logo: "",
    site_favicon: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminFetch("/api/admin/settings");
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setForm({
        site_name: data.site_name || "",
        site_description: data.site_description || "",
        site_logo: data.site_logo || "",
        site_favicon: data.site_favicon || "",
      });
    } catch {
      toast.error("获取设置失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchSettings();
  }, [token, fetchSettings]);

  async function handleSave() {
    try {
      setSaving(true);
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ settings: form }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "保存失败");
        return;
      }
      toast.success("设置已保存");
    } catch {
      toast.error("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout activeKey="settings-general">
        <div className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeKey="settings-general">
      <div className="space-y-6">
        <PageHeader title="基本信息" actions={
          <Icons.Settings className="w-6 h-6 text-gray-400" />
        } />

        <Card>
          <CardHeader title="基本信息" subtitle="配置网站基本资料" />
          <CardBody className="space-y-6">
            {/* 网站名称 */}
            <FormField label="网站名称">
              <Input
                type="text"
                value={form.site_name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, site_name: e.target.value }))
                }
                placeholder="请输入网站名称"
              />
            </FormField>

            {/* 网站描述 */}
            <FormField label="网站描述">
              <Input
                type="text"
                value={form.site_description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    site_description: e.target.value,
                  }))
                }
                placeholder="请输入网站描述"
              />
            </FormField>

            {/* 网站Logo */}
            <FormField label="网站Logo">
              <Input
                type="text"
                value={form.site_logo}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, site_logo: e.target.value }))
                }
                placeholder="请输入Logo图片URL"
              />
              {form.site_logo && (
                <div className="mt-3">
                  <img
                    src={form.site_logo}
                    alt="Logo预览"
                    className="h-12 rounded border border-gray-200 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </FormField>

            {/* 网站图标 */}
            <FormField label="网站图标">
              <Input
                type="text"
                value={form.site_favicon}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    site_favicon: e.target.value,
                  }))
                }
                placeholder="请输入Favicon图片URL"
              />
              {form.site_favicon && (
                <div className="mt-3">
                  <img
                    src={form.site_favicon}
                    alt="Favicon预览"
                    className="h-10 w-10 rounded border border-gray-200 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </FormField>
          </CardBody>
        </Card>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving}>
            {saving ? "保存中..." : "保存设置"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
