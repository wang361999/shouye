"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import toast from "react-hot-toast";

const CATEGORY_OPTIONS = ["开发工具", "AI工具", "效率工具"];
type StatusValue = "online" | "developing" | "offline";

const STATUS_OPTIONS: { value: StatusValue; label: string; desc: string }[] = [
  { value: "online", label: "已上线", desc: "对所有用户可见" },
  { value: "developing", label: "开发中", desc: "仅管理员可见" },
  { value: "offline", label: "已下线", desc: "不对用户展示" },
];

interface ToolData {
  id: string;
  name: string;
  description: string | null;
  url: string;
  icon: string | null;
  category: string | null;
  isActive: boolean;
  isFeatured: boolean;
  needLogin: boolean;
  coverImage: string | null;
  sortOrder: number;
}

export default function EditToolPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { token } = useAppStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<StatusValue>("online");
  const [sortOrder, setSortOrder] = useState(0);
  const [category, setCategory] = useState("");
  // 高级设置
  const [isFeatured, setIsFeatured] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [coverImage, setCoverImage] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token || !id) return;

    async function fetchTool() {
      try {
        setLoading(true);
        const res = await adminFetch(`/api/tools/${id}`);

        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || "获取工具信息失败");
          router.push("/admin/tools");
          return;
        }

        const data: ToolData = await res.json();
        setName(data.name);
        setDescription(data.description || "");
        setUrl(data.url);
        setIcon(data.icon || "");
        setCategory(data.category || "");
        setSortOrder(data.sortOrder || 0);
        setIsFeatured(data.isFeatured);
        setNeedLogin(data.needLogin);
        setCoverImage(data.coverImage || "");
        setStatus(data.isActive ? "online" : "offline");
      } catch {
        toast.error("获取工具信息失败");
        router.push("/admin/tools");
      } finally {
        setLoading(false);
      }
    }

    fetchTool();
  }, [id, token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || !description.trim() || !url.trim()) {
      toast.error("工具名称、描述和链接不能为空");
      return;
    }

    try {
      new URL(url.trim());
    } catch {
      toast.error("请输入有效的链接地址");
      return;
    }

    try {
      setSubmitting(true);
      const res = await adminFetch(`/api/tools/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          url: url.trim(),
          icon: icon.trim() || null,
          category: category || null,
          isActive: status !== "offline",
          isFeatured,
          needLogin,
          coverImage: coverImage.trim() || null,
          sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "更新失败");
        return;
      }

      toast.success("工具更新成功");
      router.push("/admin/tools");
    } catch {
      toast.error("更新失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout activeKey="tools">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-gray-200 rounded" />
            <div className="h-7 w-40 bg-gray-200 rounded" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 animate-pulse space-y-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="h-4 bg-gray-100 rounded w-24 mb-2" />
                <div className="h-10 bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeKey="tools">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 页头 */}
        <div className="flex items-center gap-3">
          <Link
            href="/admin/tools"
            className="p-1.5 -ml-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="返回工具列表"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">✏️ 编辑工具</h1>
        </div>

        {/* 表单卡片 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 工具名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                工具名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：JSON 格式化工具"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* 一句话描述 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                一句话描述 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述工具的功能和用途"
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
              />
            </div>

            {/* 图标 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                图标
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="输入 Emoji 或文字，例如 🔧"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  maxLength={10}
                />
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl border border-gray-200 flex-shrink-0">
                  {icon || "🔧"}
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                支持输入 Emoji 或简短文字，将作为工具图标展示
              </p>
            </div>

            {/* 链接地址 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                链接地址 <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/tool"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* 状态 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                状态
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                      status === opt.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 排序值 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                排序值
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                placeholder="0"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <p className="mt-1 text-xs text-gray-400">
                数值越大越靠前，默认为 0
              </p>
            </div>

            {/* 分类标签 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                分类标签
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
              >
                <option value="">请选择分类</option>
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* 高级设置 */}
            <div className="border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                <span>⚙️ 高级设置</span>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    advancedOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {advancedOpen && (
                <div className="mt-4 space-y-4">
                  {/* 是否在首页推荐 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-700">
                        首页推荐
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        开启后该工具将在首页推荐位展示
                      </div>
                    </div>
                    <Switch checked={isFeatured} onChange={setIsFeatured} />
                  </div>
                  {/* 是否需要登录 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-700">
                        需要登录
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        开启后用户需登录才能使用该工具
                      </div>
                    </div>
                    <Switch checked={needLogin} onChange={setNeedLogin} />
                  </div>
                  {/* 封面图 URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      封面图 URL
                    </label>
                    <input
                      type="url"
                      value={coverImage}
                      onChange={(e) => setCoverImage(e.target.value)}
                      placeholder="https://example.com/cover.jpg"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 提交按钮 */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <Link
                href="/admin/tools"
                className="px-5 py-2.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "保存中..." : "保存修改"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}

// ============ 开关组件 ============
function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
        checked ? "bg-blue-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
