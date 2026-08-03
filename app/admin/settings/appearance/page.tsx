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
  Select,
  FormField,
  Switch,
  Spinner,
  Icons,
} from "@/components/admin/ui";

const PRESET_COLORS = [
  { label: "蓝", value: "#3B82F6" },
  { label: "紫", value: "#8B5CF6" },
  { label: "绿", value: "#10B981" },
  { label: "橙", value: "#F97316" },
  { label: "红", value: "#EF4444" },
];

export default function AppearanceSettingsPage() {
  const { token } = useAppStore();

  const [form, setForm] = useState({
    theme_color: "#3B82F6",
    dark_mode: false,
    hero_title: "",
    hero_subtitle: "",
    home_layout: "grid" as "grid" | "list",
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
        theme_color: data.theme_color || "#3B82F6",
        dark_mode: data.dark_mode === "true",
        hero_title: data.hero_title || "",
        hero_subtitle: data.hero_subtitle || "",
        home_layout: (data.home_layout as "grid" | "list") || "grid",
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
        body: JSON.stringify({
          settings: {
            ...form,
            dark_mode: String(form.dark_mode),
          },
        }),
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
      <AdminLayout activeKey="settings-appearance">
        <div className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeKey="settings-appearance">
      <div className="space-y-6">
        <PageHeader title="外观定制" actions={
          <Icons.Paint className="w-6 h-6 text-gray-400" />
        } />

        <Card>
          <CardHeader title="外观定制" subtitle="配置主题色、首页布局等外观选项" />
          <CardBody className="space-y-6">
            {/* 主题色 */}
            <FormField label="主题色">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.theme_color}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, theme_color: e.target.value }))
                  }
                  className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
                />
                <Input
                  type="text"
                  value={form.theme_color}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, theme_color: e.target.value }))
                  }
                  className="w-32"
                  placeholder="#3B82F6"
                />
              </div>
              {/* 预设色板 */}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-gray-400 mr-1">预设色板：</span>
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() =>
                      setForm((prev) => ({ ...prev, theme_color: color.value }))
                    }
                    title={color.label}
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      form.theme_color === color.value
                        ? "border-gray-800 ring-2 ring-offset-2 ring-gray-300"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.value }}
                  />
                ))}
              </div>
            </FormField>

            {/* 深色模式 */}
            <div className="flex items-center justify-between">
              <div>
                <label className="admin-label">深色模式</label>
              </div>
              <Switch
                checked={form.dark_mode}
                onChange={(checked) =>
                  setForm((prev) => ({ ...prev, dark_mode: checked }))
                }
              />
            </div>

            {/* Hero标题 */}
            <FormField label="Hero标题">
              <Input
                type="text"
                value={form.hero_title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, hero_title: e.target.value }))
                }
                placeholder="请输入首页Hero区域标题"
              />
            </FormField>

            {/* Hero副标题 */}
            <FormField label="Hero副标题">
              <Input
                type="text"
                value={form.hero_subtitle}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    hero_subtitle: e.target.value,
                  }))
                }
                placeholder="请输入首页Hero区域副标题"
              />
            </FormField>

            {/* 首页工具布局 */}
            <FormField label="首页工具布局">
              <Select
                value={form.home_layout}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    home_layout: e.target.value as "grid" | "list",
                  }))
                }
              >
                <option value="grid">网格</option>
                <option value="list">列表</option>
              </Select>
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
