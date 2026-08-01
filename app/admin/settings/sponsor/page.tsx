"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

export default function SponsorSettingsPage() {
  const { token } = useAppStore();

  const [form, setForm] = useState({
    sponsor_wechat_qr: "",
    sponsor_alipay_qr: "",
    sponsor_text: "",
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
        sponsor_wechat_qr: data.sponsor_wechat_qr || "",
        sponsor_alipay_qr: data.sponsor_alipay_qr || "",
        sponsor_text: data.sponsor_text || "",
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
      toast.success("赞助设置已保存");
    } catch {
      toast.error("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout activeKey="settings-sponsor">
        <div className="flex items-center justify-center py-20">
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeKey="settings-sponsor">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">❤️ 赞助设置</h1>
          <p className="text-sm text-gray-500 mt-1">
            上传微信、支付宝收款二维码，用户可在赞助页面扫码赞助
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* 赞助说明文字 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              赞助说明文字
            </label>
            <input
              type="text"
              value={form.sponsor_text}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sponsor_text: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例如：如果我们的项目对您有帮助，欢迎赞助支持"
            />
          </div>

          {/* 微信赞助二维码 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              微信赞助二维码
            </label>
            <input
              type="text"
              value={form.sponsor_wechat_qr}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sponsor_wechat_qr: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入微信收款二维码图片URL"
            />
            {form.sponsor_wechat_qr && (
              <div className="mt-3">
                <img
                  src={form.sponsor_wechat_qr}
                  alt="微信二维码预览"
                  className="h-40 w-40 rounded-lg border border-gray-200 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          {/* 支付宝赞助二维码 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              支付宝赞助二维码
            </label>
            <input
              type="text"
              value={form.sponsor_alipay_qr}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sponsor_alipay_qr: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入支付宝收款二维码图片URL"
            />
            {form.sponsor_alipay_qr && (
              <div className="mt-3">
                <img
                  src={form.sponsor_alipay_qr}
                  alt="支付宝二维码预览"
                  className="h-40 w-40 rounded-lg border border-gray-200 object-contain"
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
