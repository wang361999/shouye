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
  Textarea,
  FormField,
  Spinner,
  Icons,
} from "@/components/admin/ui";

export default function SeoSettingsPage() {
  const { token } = useAppStore();

  const [form, setForm] = useState({
    seo_title: "",
    seo_keywords: "",
    seo_description: "",
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
        seo_title: data.seo_title || "",
        seo_keywords: data.seo_keywords || "",
        seo_description: data.seo_description || "",
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
      <AdminLayout activeKey="settings-seo">
        <div className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeKey="settings-seo">
      <div className="space-y-6">
        <PageHeader title="SEO设置" actions={
          <Icons.Globe className="w-6 h-6 text-gray-400" />
        } />

        <Card>
          <CardHeader title="SEO设置" subtitle="配置页面标题、关键词与描述" />
          <CardBody className="space-y-6">
            {/* 页面标题 */}
            <FormField label="页面标题">
              <Input
                type="text"
                value={form.seo_title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, seo_title: e.target.value }))
                }
                placeholder="请输入页面标题"
              />
            </FormField>

            {/* 关键词 */}
            <FormField label="关键词" hint="多个关键词请用英文逗号分隔">
              <Input
                type="text"
                value={form.seo_keywords}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    seo_keywords: e.target.value,
                  }))
                }
                placeholder="请输入关键词，逗号分隔"
              />
            </FormField>

            {/* 描述 */}
            <FormField
              label="描述"
              hint="建议控制在 150 字符以内，有助于搜索引擎展示"
            >
              <Textarea
                value={form.seo_description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    seo_description: e.target.value,
                  }))
                }
                rows={4}
                placeholder="请输入页面描述"
              />
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
