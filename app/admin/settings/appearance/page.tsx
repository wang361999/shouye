"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import toast from "react-hot-toast";

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
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeKey="settings-appearance">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">&#127912; 外观定制</h1>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* 主题色 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              主题色
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.theme_color}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, theme_color: e.target.value }))
                }
                className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={form.theme_color}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, theme_color: e.target.value }))
                }
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          </div>

          {/* 深色模式 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              深色模式
            </label>
            <Switch
              checked={form.dark_mode}
              onChange={(checked) =>
                setForm((prev) => ({ ...prev, dark_mode: checked }))
              }
            />
          </div>

          {/* Hero标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              Hero标题
            </label>
            <input
              type="text"
              value={form.hero_title}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, hero_title: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入首页Hero区域标题"
            />
          </div>

          {/* Hero副标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              Hero副标题
            </label>
            <input
              type="text"
              value={form.hero_subtitle}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  hero_subtitle: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入首页Hero区域副标题"
            />
          </div>

          {/* 首页工具布局 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              首页工具布局
            </label>
            <select
              value={form.home_layout}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  home_layout: e.target.value as "grid" | "list",
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="grid">网格</option>
              <option value="list">列表</option>
            </select>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}

// ============ Switch 开关组件 ============
function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? "bg-blue-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
