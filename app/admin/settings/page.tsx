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

type TabKey = "basic" | "seo" | "sponsor" | "wechat";

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
    wechat_app_id: "",
    wechat_app_secret: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [testingWechat, setTestingWechat] = useState(false);

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
        wechat_app_id: data.wechat_app_id || "",
        wechat_app_secret: data.wechat_app_secret || "",
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

  // 测试微信公众号连接
  async function handleTestWechat() {
    if (testingWechat) return;
    // 先保存当前配置
    try {
      setTestingWechat(true);
      const saveRes = await adminFetch("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({
          settings: {
            wechat_app_id: form.wechat_app_id,
            wechat_app_secret: form.wechat_app_secret,
          },
        }),
      });
      if (!saveRes.ok) {
        toast.error("保存配置失败，无法测试连接");
        return;
      }

      // 调用测试接口（带 test=1 参数实际请求微信 API）
      const res = await adminFetch("/api/wechat/config?test=1");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "连接测试失败");
        return;
      }
      if (data.error) {
        toast.error(`连接失败：${data.error}`);
        return;
      }
      if (data.configured) {
        toast.success(data.message || "连接成功！");
      } else {
        toast.error("未检测到有效配置，请检查 AppID 和 AppSecret");
      }
    } catch {
      toast.error("连接测试失败，请稍后重试");
    } finally {
      setTestingWechat(false);
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
            { key: "wechat", label: "微信同步" },
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

        {/* 微信同步设置 */}
        {activeTab === "wechat" && (
          <Card>
            <CardHeader
              title="微信公众号配置"
              subtitle="配置公众号 AppID 与 AppSecret，用于帖子同步与发布"
            />
            <CardBody className="space-y-6">
              {/* 配置说明 */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <div className="text-sm text-blue-800 space-y-1.5">
                    <p className="font-medium">配置说明</p>
                    <p>1. 登录 <a href="https://mp.weixin.qq.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">微信公众平台</a>，在「设置与开发 - 基本配置」中获取 AppID 和 AppSecret。</p>
                    <p>2. 需在公众号后台配置服务器 IP 白名单，将本服务器出口 IP 加入白名单。</p>
                    <p>3. AppSecret 仅在配置时显示一次，请妥善保管。如需修改直接填写新值即可。</p>
                    <p>4. 认证订阅号/服务号可使用草稿+发布接口；个人订阅号部分接口受限，可能仅支持手动发布。</p>
                  </div>
                </div>
              </div>

              <FormField label="AppID" hint="公众号的唯一凭证">
                <Input
                  value={form.wechat_app_id}
                  onChange={(e) => setForm((p) => ({ ...p, wechat_app_id: e.target.value }))}
                  placeholder="例如：wx1234567890abcdef"
                  className="font-mono"
                />
              </FormField>

              <FormField label="AppSecret" hint="公众号的密钥，用于获取 Access Token">
                <Input
                  type="password"
                  value={form.wechat_app_secret}
                  onChange={(e) => setForm((p) => ({ ...p, wechat_app_secret: e.target.value }))}
                  placeholder={form.wechat_app_secret === "••••••••" ? "已配置，输入新值可修改" : "请输入 AppSecret"}
                  className="font-mono"
                />
              </FormField>

              {/* 配置状态 */}
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${form.wechat_app_id && form.wechat_app_secret ? "bg-green-500" : "bg-gray-300"}`} />
                <span className="text-sm text-gray-700">
                  {form.wechat_app_id && form.wechat_app_secret
                    ? "已配置，可前往「公众号同步」页面进行帖子同步"
                    : "未配置，请填写 AppID 和 AppSecret 后保存"}
                </span>
                {form.wechat_app_id && form.wechat_app_secret && (
                  <a
                    href="/admin/wechat"
                    className="ml-auto text-sm text-brand-600 hover:text-brand-700 hover:underline font-medium"
                  >
                    前往同步管理 →
                  </a>
                )}
              </div>

              {/* 测试连接按钮 */}
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={handleTestWechat}
                  loading={testingWechat}
                  disabled={!form.wechat_app_id || !form.wechat_app_secret}
                >
                  <Icons.Search className="w-4 h-4" />
                  测试连接
                </Button>
                <span className="text-xs text-gray-500">
                  点击后会先保存配置，然后实际请求微信 API 验证 Access Token 是否可正常获取
                </span>
              </div>
            </CardBody>
          </Card>
        )}

        {/* 保存按钮 */}
        <div className="flex justify-end gap-3">
          {activeTab === "wechat" && (
            <a
              href="/admin/wechat"
              className="admin-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
            >
              <Icons.Chat className="w-4 h-4" />
              同步管理
            </a>
          )}
          <Button onClick={handleSave} loading={saving}>
            <Icons.Check className="w-4 h-4" />
            保存设置
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
