"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

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
      const res = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeKey="settings-general">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">&#9881;&#65039; 基本信息</h1>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* 网站名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              网站名称
            </label>
            <input
              type="text"
              value={form.site_name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, site_name: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入网站名称"
            />
          </div>

          {/* 网站描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              网站描述
            </label>
            <input
              type="text"
              value={form.site_description}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  site_description: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入网站描述"
            />
          </div>

          {/* 网站Logo */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              网站Logo
            </label>
            <input
              type="text"
              value={form.site_logo}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, site_logo: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          </div>

          {/* 网站图标 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              网站图标
            </label>
            <input
              type="text"
              value={form.site_favicon}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  site_favicon: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
