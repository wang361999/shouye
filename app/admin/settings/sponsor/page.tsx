"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const wechatInputRef = useRef<HTMLInputElement>(null);
  const alipayInputRef = useRef<HTMLInputElement>(null);

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

  // ============ 上传图片 ============
  async function handleUpload(file: File, field: "sponsor_wechat_qr" | "sponsor_alipay_qr") {
    if (!token) return;

    // 前端校验
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("仅支持 PNG、JPG、GIF、WebP 格式的图片");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("文件大小不能超过 2MB");
      return;
    }

    setUploadingField(field);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "上传失败");
        return;
      }
      setForm((prev) => ({ ...prev, [field]: data.url }));
      toast.success("图片上传成功");
    } catch {
      toast.error("上传失败，请稍后重试");
    } finally {
      setUploadingField(null);
    }
  }

  // ============ 清除图片 ============
  function handleClearImage(field: "sponsor_wechat_qr" | "sponsor_alipay_qr") {
    setForm((prev) => ({ ...prev, [field]: "" }));
    if (field === "sponsor_wechat_qr" && wechatInputRef.current) {
      wechatInputRef.current.value = "";
    }
    if (field === "sponsor_alipay_qr" && alipayInputRef.current) {
      alipayInputRef.current.value = "";
    }
  }

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

  // ============ 上传区域组件 ============
  function UploadArea({
    field,
    label,
    inputRef,
    value,
  }: {
    field: "sponsor_wechat_qr" | "sponsor_alipay_qr";
    label: string;
    inputRef: React.RefObject<HTMLInputElement>;
    value: string;
  }) {
    const isUploading = uploadingField === field;

    return (
      <div>
        <label className="block text-sm font-medium text-gray-500 mb-1.5">
          {label}
        </label>

        {/* 隐藏的文件输入 */}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file, field);
          }}
        />

        {/* 预览区或上传按钮 */}
        {value ? (
          <div className="flex items-start gap-4">
            <div className="relative">
              <img
                src={value}
                alt={`${label}预览`}
                className="h-40 w-40 rounded-lg border border-gray-200 object-contain bg-white"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              {/* 替换按钮 */}
              <button
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs font-medium rounded-lg opacity-0 hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
              >
                {isUploading ? "上传中..." : "点击替换"}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                {isUploading ? "上传中..." : "重新上传"}
              </button>
              <button
                onClick={() => handleClearImage(field)}
                disabled={isUploading}
                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                删除图片
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="w-full h-40 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <span className="text-sm text-gray-500">上传中...</span>
              </>
            ) : (
              <>
                <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-500">点击上传图片</span>
                <span className="text-xs text-gray-400">支持 PNG / JPG / GIF / WebP，最大 2MB</span>
              </>
            )}
          </button>
        )}
      </div>
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
          <UploadArea
            field="sponsor_wechat_qr"
            label="微信赞助二维码"
            inputRef={wechatInputRef}
            value={form.sponsor_wechat_qr}
          />

          {/* 支付宝赞助二维码 */}
          <UploadArea
            field="sponsor_alipay_qr"
            label="支付宝赞助二维码"
            inputRef={alipayInputRef}
            value={form.sponsor_alipay_qr}
          />
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
