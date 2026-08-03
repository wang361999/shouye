"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Tabs,
  Icons,
} from "@/components/admin/ui";

type TabKey = "basic" | "seo" | "sponsor";

export default function SiteSettingsPage() {
  const { token } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabKey>("basic");

  const [form, setForm] = useState({
    site_name: "",
    site_description: "",
    site_logo: "",
    site_favicon: "",
    seo_title: "",
    seo_keywords: "",
    seo_description: "",
    sponsor_text: "",
    sponsor_wechat_qr: "",
    sponsor_alipay_qr: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const wechatInputRef = useRef<HTMLInputElement>(null);
  const alipayInputRef = useRef<HTMLInputElement>(null);

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
        seo_title: data.seo_title || "",
        seo_keywords: data.seo_keywords || "",
        seo_description: data.seo_description || "",
        sponsor_text: data.sponsor_text || "",
        sponsor_wechat_qr: data.sponsor_wechat_qr || "",
        sponsor_alipay_qr: data.sponsor_alipay_qr || "",
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

  async function handleUpload(file: File, field: "sponsor_wechat_qr" | "sponsor_alipay_qr") {
    if (!token) return;
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("仅支持 PNG、JPG、GIF、WebP 格式");
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

  function handleClearImage(field: "sponsor_wechat_qr" | "sponsor_alipay_qr") {
    setForm((prev) => ({ ...prev, [field]: "" }));
    if (field === "sponsor_wechat_qr" && wechatInputRef.current) wechatInputRef.current.value = "";
    if (field === "sponsor_alipay_qr" && alipayInputRef.current) alipayInputRef.current.value = "";
  }

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
        <label className="admin-label">{label}</label>
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
        {value ? (
          <div className="flex items-start gap-4">
            <div className="relative">
              <img
                src={value}
                alt={`${label}预览`}
                className="h-40 w-40 rounded-lg border border-gray-200 object-contain bg-white"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <button
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs font-medium rounded-lg opacity-0 hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
              >
                {isUploading ? "上传中..." : "点击替换"}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={isUploading}>
                {isUploading ? "上传中..." : "重新上传"}
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleClearImage(field)} disabled={isUploading}>
                删除图片
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="w-full h-40 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand-400 hover:bg-brand-50/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Spinner className="w-8 h-8" />
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

  if (loading) {
    return (
      <AdminLayout activeKey="settings-site">
        <div className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeKey="settings-site">
      <div className="space-y-6">
        <PageHeader title="站点设置" subtitle="基本信息、SEO 优化、赞助配置" />

        <Tabs
          tabs={[
            { key: "basic", label: "基本信息" },
            { key: "seo", label: "SEO 优化" },
            { key: "sponsor", label: "赞助设置" },
          ]}
          active={activeTab}
          onChange={(k) => setActiveTab(k as TabKey)}
        />

        {/* 基本信息 */}
        {activeTab === "basic" && (
          <Card>
            <CardHeader title="基本信息" subtitle="网站名称、描述、Logo 与图标" />
            <CardBody className="space-y-6">
              <FormField label="网站名称">
                <Input
                  value={form.site_name}
                  onChange={(e) => setForm((p) => ({ ...p, site_name: e.target.value }))}
                  placeholder="请输入网站名称"
                />
              </FormField>
              <FormField label="网站描述">
                <Input
                  value={form.site_description}
                  onChange={(e) => setForm((p) => ({ ...p, site_description: e.target.value }))}
                  placeholder="请输入网站描述"
                />
              </FormField>
              <FormField label="网站Logo">
                <Input
                  value={form.site_logo}
                  onChange={(e) => setForm((p) => ({ ...p, site_logo: e.target.value }))}
                  placeholder="请输入Logo图片URL"
                />
                {form.site_logo && (
                  <div className="mt-3">
                    <img
                      src={form.site_logo}
                      alt="Logo预览"
                      className="h-12 rounded border border-gray-200 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
              </FormField>
              <FormField label="网站图标 (Favicon)">
                <Input
                  value={form.site_favicon}
                  onChange={(e) => setForm((p) => ({ ...p, site_favicon: e.target.value }))}
                  placeholder="请输入Favicon图片URL"
                />
                {form.site_favicon && (
                  <div className="mt-3">
                    <img
                      src={form.site_favicon}
                      alt="Favicon预览"
                      className="h-10 w-10 rounded border border-gray-200 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
              </FormField>
            </CardBody>
          </Card>
        )}

        {/* SEO 优化 */}
        {activeTab === "seo" && (
          <Card>
            <CardHeader title="SEO 优化" subtitle="搜索引擎优化配置" />
            <CardBody className="space-y-6">
              <FormField label="页面标题">
                <Input
                  value={form.seo_title}
                  onChange={(e) => setForm((p) => ({ ...p, seo_title: e.target.value }))}
                  placeholder="浏览器标签页显示的标题"
                />
              </FormField>
              <FormField label="关键词">
                <Input
                  value={form.seo_keywords}
                  onChange={(e) => setForm((p) => ({ ...p, seo_keywords: e.target.value }))}
                  placeholder="多个关键词用英文逗号分隔"
                />
              </FormField>
              <FormField label="页面描述" hint="建议不超过 150 个字符">
                <Textarea
                  value={form.seo_description}
                  onChange={(e) => setForm((p) => ({ ...p, seo_description: e.target.value }))}
                  placeholder="搜索引擎结果中显示的网站描述"
                  rows={4}
                />
              </FormField>
            </CardBody>
          </Card>
        )}

        {/* 赞助设置 */}
        {activeTab === "sponsor" && (
          <Card>
            <CardHeader title="赞助设置" subtitle="收款二维码与赞助说明" />
            <CardBody className="space-y-6">
              <FormField label="赞助说明文字">
                <Input
                  value={form.sponsor_text}
                  onChange={(e) => setForm((p) => ({ ...p, sponsor_text: e.target.value }))}
                  placeholder="例如：如果我们的项目对您有帮助，欢迎赞助支持"
                />
              </FormField>
              <UploadArea
                field="sponsor_wechat_qr"
                label="微信赞助二维码"
                inputRef={wechatInputRef}
                value={form.sponsor_wechat_qr}
              />
              <UploadArea
                field="sponsor_alipay_qr"
                label="支付宝赞助二维码"
                inputRef={alipayInputRef}
                value={form.sponsor_alipay_qr}
              />
            </CardBody>
          </Card>
        )}

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving}>
            <Icons.Check className="w-4 h-4" />
            保存设置
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
