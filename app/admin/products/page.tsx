"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

// ============ 类型定义 ============
interface Product {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  icon: string | null;
  coverImage: string | null;
  features: string | null;
  techStack: string | null;
  screenshots: string | null;
  demoUrl: string | null;
  docsUrl: string | null;
  downloadUrl: string | null;
  status: string; // active | draft | retired
  sortOrder: number;
  priceBasic: number; // 分
  priceStandard: number;
  pricePremium: number;
  priceEnterprise: number;
  validDays: number;
  orderCount: number;
  licenseCount: number;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ProductVersion {
  id: string;
  productId: string;
  version: string;
  title: string;
  changelog: string;
  downloadUrl: string;
  downloadPassword: string | null;
  fileSize: string | null;
  isLatest: boolean;
  isPublished: boolean;
  createdAt: string;
}

// ============ 状态映射 ============
interface StatusMeta {
  label: string;
  color: string;
  dot: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  active: {
    label: "上架",
    color: "bg-green-50 text-green-700 border-green-200",
    dot: "bg-green-500",
  },
  draft: {
    label: "草稿",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  retired: {
    label: "已下架",
    color: "bg-gray-100 text-gray-600 border-gray-200",
    dot: "bg-gray-400",
  },
};

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "上架" },
  { value: "draft", label: "草稿" },
  { value: "retired", label: "已下架" },
];

const STATUS_EDIT_OPTIONS = [
  { value: "active", label: "上架 (active)" },
  { value: "draft", label: "草稿 (draft)" },
  { value: "retired", label: "已下架 (retired)" },
];

const INPUT_CLS =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

// ============ 工具函数 ============
function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2);
}

function yuanToCents(yuan: string): number {
  const n = parseFloat(yuan);
  if (isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function getStatusMeta(status: string): StatusMeta {
  return (
    STATUS_META[status] || {
      label: status,
      color: "bg-gray-100 text-gray-600 border-gray-200",
      dot: "bg-gray-400",
    }
  );
}

/** 将数据库中的 features JSON 字符串转为 textarea 文本（每行一个） */
function featuresToText(features: string | null): string {
  if (!features) return "";
  try {
    const arr = JSON.parse(features);
    if (Array.isArray(arr)) return arr.map((s) => String(s)).filter(Boolean).join("\n");
    return String(features);
  } catch {
    return String(features);
  }
}

/** 将 textarea 文本转为 JSON 数组字符串 */
function textToFeaturesString(text: string): string {
  const arr = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return JSON.stringify(arr);
}

// ============ 表单类型 ============
interface ProductForm {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  icon: string;
  coverImage: string;
  features: string;
  demoUrl: string;
  docsUrl: string;
  downloadUrl: string;
  status: string;
  sortOrder: number;
  priceBasic: string;
  priceStandard: string;
  pricePremium: string;
  priceEnterprise: string;
  validDays: number;
}

const EMPTY_FORM: ProductForm = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  icon: "",
  coverImage: "",
  features: "",
  demoUrl: "",
  docsUrl: "",
  downloadUrl: "",
  status: "active",
  sortOrder: 0,
  priceBasic: "0",
  priceStandard: "0",
  pricePremium: "0",
  priceEnterprise: "0",
  validDays: 365,
};

interface VersionForm {
  version: string;
  title: string;
  changelog: string;
  downloadUrl: string;
  downloadPassword: string;
  fileSize: string;
  isLatest: boolean;
  isPublished: boolean;
}

const EMPTY_VERSION_FORM: VersionForm = {
  version: "",
  title: "",
  changelog: "",
  downloadUrl: "",
  downloadPassword: "",
  fileSize: "",
  isLatest: false,
  isPublished: true,
};

// ============ 主页面组件 ============
export default function ProductsAdminPage() {
  const { token } = useAppStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState("");

  // 产品表单（创建/编辑）
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // 删除产品
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 版本管理
  const [versionProduct, setVersionProduct] = useState<Product | null>(null);
  const [versions, setVersions] = useState<ProductVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionForm, setVersionForm] = useState<VersionForm>(EMPTY_VERSION_FORM);
  const [versionSaving, setVersionSaving] = useState(false);
  const [deleteVersionTarget, setDeleteVersionTarget] =
    useState<ProductVersion | null>(null);
  const [deletingVersion, setDeletingVersion] = useState(false);
  const [togglingVersionId, setTogglingVersionId] = useState<string | null>(null);

  // 封面图上传
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  // ============ 获取产品列表 ============
  const fetchProducts = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch("/api/admin/products", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        toast.error("登录已过期，请重新登录");
        return;
      }
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      toast.error("获取产品列表失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchProducts();
  }, [token, fetchProducts]);

  // ============ 客户端筛选 ============
  const filteredProducts = useMemo(() => {
    let list = products;
    if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }
    const kw = keyword.trim().toLowerCase();
    if (kw) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(kw) ||
          p.slug.toLowerCase().includes(kw) ||
          p.tagline.toLowerCase().includes(kw)
      );
    }
    return list;
  }, [products, statusFilter, keyword]);

  // ============ 统计 ============
  const stats = useMemo(
    () => ({
      total: products.length,
      active: products.filter((p) => p.status === "active").length,
      draft: products.filter((p) => p.status === "draft").length,
      retired: products.filter((p) => p.status === "retired").length,
    }),
    [products]
  );

  // ============ 上传封面图 ============
  async function handleUploadCover(file: File) {
    if (!token) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("仅支持 PNG、JPG、GIF、WebP 格式的图片");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("文件大小不能超过 2MB");
      return;
    }

    setUploadingCover(true);
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
      setForm((prev) => ({ ...prev, coverImage: data.url }));
      toast.success("封面上传成功");
    } catch {
      toast.error("上传失败，请稍后重试");
    } finally {
      setUploadingCover(false);
    }
  }

  // ============ 复制 ============
  async function handleCopy(text: string, label = "内容") {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label}已复制`);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  }

  // ============ 打开创建/编辑 ============
  function openCreateModal() {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      slug: product.slug,
      tagline: product.tagline,
      description: product.description,
      icon: product.icon || "",
      coverImage: product.coverImage || "",
      features: featuresToText(product.features),
      demoUrl: product.demoUrl || "",
      docsUrl: product.docsUrl || "",
      downloadUrl: product.downloadUrl || "",
      status: product.status,
      sortOrder: product.sortOrder,
      priceBasic: centsToYuan(product.priceBasic),
      priceStandard: centsToYuan(product.priceStandard),
      pricePremium: centsToYuan(product.pricePremium),
      priceEnterprise: centsToYuan(product.priceEnterprise),
      validDays: product.validDays,
    });
    setFormOpen(true);
  }

  function closeFormModal() {
    if (saving) return;
    setFormOpen(false);
  }

  // ============ 保存产品（创建/更新） ============
  async function handleSave() {
    if (!token) return;
    const name = form.name.trim();
    if (!name) {
      toast.error("请输入产品名称");
      return;
    }
    const tagline = form.tagline.trim();
    if (!tagline) {
      toast.error("请输入一句话描述");
      return;
    }
    const description = form.description.trim();
    if (!description) {
      toast.error("请输入产品详细介绍");
      return;
    }

    const payload = {
      name,
      slug: form.slug.trim(),
      tagline,
      description,
      icon: form.icon.trim(),
      coverImage: form.coverImage.trim(),
      features: textToFeaturesString(form.features),
      demoUrl: form.demoUrl.trim(),
      docsUrl: form.docsUrl.trim(),
      downloadUrl: form.downloadUrl.trim(),
      status: form.status,
      sortOrder: Number(form.sortOrder) || 0,
      priceBasic: yuanToCents(form.priceBasic),
      priceStandard: yuanToCents(form.priceStandard),
      pricePremium: yuanToCents(form.pricePremium),
      priceEnterprise: yuanToCents(form.priceEnterprise),
      validDays: Number(form.validDays) || 365,
    };

    try {
      setSaving(true);
      const isEdit = !!editingProduct;
      const res = await fetch("/api/admin/products", {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          isEdit ? { id: editingProduct!.id, ...payload } : payload
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || (isEdit ? "更新失败" : "创建失败"));
        return;
      }
      toast.success(isEdit ? "产品已更新" : "产品创建成功");
      setFormOpen(false);
      fetchProducts();
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  // ============ 删除产品 ============
  async function handleDelete() {
    if (!token || !deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/admin/products?id=${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "删除失败");
        return;
      }
      toast.success("产品已删除");
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      toast.error("删除失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  }

  // ============ 版本管理 ============
  function openVersionModal(product: Product) {
    setVersionProduct(product);
    setVersionForm(EMPTY_VERSION_FORM);
    setVersions([]);
    setDeleteVersionTarget(null);
    fetchVersions(product.id);
  }

  function closeVersionModal() {
    if (versionSaving || deletingVersion) return;
    setVersionProduct(null);
    setVersions([]);
    setDeleteVersionTarget(null);
  }

  const fetchVersions = useCallback(
    async (productId: string) => {
      if (!token) return;
      try {
        setVersionsLoading(true);
        const res = await fetch(
          `/api/admin/products/versions?productId=${productId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) throw new Error("获取失败");
        const data = await res.json();
        setVersions(Array.isArray(data) ? data : []);
      } catch {
        toast.error("获取版本列表失败");
      } finally {
        setVersionsLoading(false);
      }
    },
    [token]
  );

  // 创建版本
  async function handleCreateVersion() {
    if (!token || !versionProduct) return;
    const version = versionForm.version.trim();
    if (!version) {
      toast.error("请输入版本号");
      return;
    }
    const title = versionForm.title.trim();
    if (!title) {
      toast.error("请输入版本标题");
      return;
    }
    const changelog = versionForm.changelog.trim();
    if (!changelog) {
      toast.error("请输入更新日志");
      return;
    }
    const downloadUrl = versionForm.downloadUrl.trim();
    if (!downloadUrl) {
      toast.error("请输入下载链接");
      return;
    }
    try {
      setVersionSaving(true);
      const res = await fetch("/api/admin/products/versions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: versionProduct.id,
          version,
          title,
          changelog,
          downloadUrl,
          downloadPassword: versionForm.downloadPassword.trim(),
          fileSize: versionForm.fileSize.trim(),
          isLatest: versionForm.isLatest,
          isPublished: versionForm.isPublished,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "创建版本失败");
        return;
      }
      toast.success("版本创建成功");
      setVersionForm(EMPTY_VERSION_FORM);
      fetchVersions(versionProduct.id);
      // 同步产品列表中的版本计数
      setProducts((prev) =>
        prev.map((p) =>
          p.id === versionProduct.id ? { ...p, versionCount: p.versionCount + 1 } : p
        )
      );
    } catch {
      toast.error("创建版本失败，请稍后重试");
    } finally {
      setVersionSaving(false);
    }
  }

  // 切换版本 isLatest / isPublished
  async function handleToggleVersion(
    v: ProductVersion,
    field: "isLatest" | "isPublished"
  ) {
    if (!token || !versionProduct) return;
    const newValue = !v[field];
    try {
      setTogglingVersionId(v.id);
      const res = await fetch("/api/admin/products/versions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: v.id, [field]: newValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "操作失败");
        return;
      }
      toast.success(
        newValue
          ? field === "isLatest"
            ? "已设为最新版本"
            : "已发布"
          : field === "isLatest"
          ? "已取消最新版本"
          : "已取消发布"
      );
      setVersions((prev) =>
        prev.map((x) => {
          if (x.id === v.id) return { ...x, [field]: newValue };
          if (field === "isLatest" && newValue) return { ...x, isLatest: false };
          return x;
        })
      );
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setTogglingVersionId(null);
    }
  }

  // 删除版本
  async function handleDeleteVersion() {
    if (!token || !versionProduct || !deleteVersionTarget) return;
    try {
      setDeletingVersion(true);
      const res = await fetch(
        `/api/admin/products/versions?id=${deleteVersionTarget.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "删除版本失败");
        return;
      }
      toast.success("版本已删除");
      setVersions((prev) => prev.filter((v) => v.id !== deleteVersionTarget.id));
      setProducts((prev) =>
        prev.map((p) =>
          p.id === versionProduct.id
            ? { ...p, versionCount: Math.max(0, p.versionCount - 1) }
            : p
        )
      );
      setDeleteVersionTarget(null);
    } catch {
      toast.error("删除版本失败，请稍后重试");
    } finally {
      setDeletingVersion(false);
    }
  }

  // ============ 渲染 ============
  return (
    <AdminLayout activeKey="products">
      <div className="space-y-6">
        {/* 页头 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📦 产品管理</h1>
            <p className="text-sm text-gray-500 mt-1">
              管理数字产品、定价、版本与下载发布
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            新建产品
          </button>
        </div>

        {/* 统计概览 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="产品总数" value={stats.total} icon="📦" loading={loading} />
          <StatBox
            label="上架中"
            value={stats.active}
            icon="🟢"
            loading={loading}
          />
          <StatBox label="草稿" value={stats.draft} icon="📝" loading={loading} />
          <StatBox
            label="已下架"
            value={stats.retired}
            icon="🗃️"
            loading={loading}
          />
        </div>

        {/* 搜索筛选栏 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索产品名称、slug 或描述..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 产品列表 */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse"
              >
                <div className="flex gap-4">
                  <div className="w-14 h-14 bg-gray-100 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-gray-100 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-3">📦</div>
            <p className="text-gray-500 mb-1">
              {keyword || statusFilter !== "all"
                ? "没有符合条件的产品"
                : "暂无产品"}
            </p>
            <p className="text-sm text-gray-400 mb-4">
              {keyword || statusFilter !== "all"
                ? "尝试调整搜索或筛选条件"
                : "点击上方按钮创建第一个产品"}
            </p>
            {keyword || statusFilter !== "all" ? (
              <button
                onClick={() => {
                  setKeyword("");
                  setStatusFilter("all");
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                清空筛选条件
              </button>
            ) : (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                新建产品
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={() => openEditModal(product)}
                onDelete={() => setDeleteTarget(product)}
                onManageVersions={() => openVersionModal(product)}
              />
            ))}
          </div>
        )}

        {/* 底部总数 */}
        {!loading && filteredProducts.length > 0 && (
          <div className="text-sm text-gray-500">
            共 <span className="font-medium text-gray-700">{filteredProducts.length}</span>{" "}
            个产品
          </div>
        )}
      </div>

      {/* ============ 产品表单模态框 ============ */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeFormModal} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {editingProduct ? "编辑产品" : "新建产品"}
              </h3>
              <button
                onClick={closeFormModal}
                disabled={saving}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* 表单内容 */}
            <div className="px-6 py-5 space-y-6 overflow-y-auto">
              {/* 基本信息 */}
              <section>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <span className="text-blue-500">①</span> 基本信息
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 产品名称 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      产品名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, name: e.target.value }))
                      }
                      className={INPUT_CLS}
                      placeholder="如：极速后台管理系统"
                    />
                  </div>
                  {/* Slug */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Slug（URL 标识）
                    </label>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, slug: e.target.value }))
                      }
                      className={INPUT_CLS}
                      placeholder="留空将根据名称自动生成"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      仅限小写字母、数字、连字符，需全局唯一
                    </p>
                  </div>
                  {/* 一句话描述 */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      一句话描述 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.tagline}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, tagline: e.target.value }))
                      }
                      className={INPUT_CLS}
                      placeholder="如：开箱即用的全栈后台脚手架"
                    />
                  </div>
                  {/* 图标 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      图标（emoji）
                    </label>
                    <input
                      type="text"
                      value={form.icon}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, icon: e.target.value }))
                      }
                      className={INPUT_CLS}
                      placeholder="🚀"
                    />
                  </div>
                  {/* 状态 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      状态
                    </label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, status: e.target.value }))
                      }
                      className={INPUT_CLS}
                    >
                      {STATUS_EDIT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* 排序值 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      排序值
                    </label>
                    <input
                      type="number"
                      value={form.sortOrder}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          sortOrder: Number(e.target.value) || 0,
                        }))
                      }
                      className={INPUT_CLS}
                      placeholder="0"
                    />
                    <p className="mt-1 text-xs text-gray-400">数值越大越靠前</p>
                  </div>
                  {/* 封面图上传 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      封面图
                    </label>
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadCover(file);
                      }}
                    />
                    {form.coverImage ? (
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <img
                            src={form.coverImage}
                            alt="封面预览"
                            className="h-24 w-40 rounded-lg border border-gray-200 object-cover bg-white"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                          <button
                            onClick={() => coverInputRef.current?.click()}
                            disabled={uploadingCover}
                            className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs font-medium rounded-lg opacity-0 hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
                          >
                            {uploadingCover ? "上传中..." : "点击替换"}
                          </button>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => coverInputRef.current?.click()}
                            disabled={uploadingCover}
                            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                          >
                            {uploadingCover ? "上传中..." : "重新上传"}
                          </button>
                          <button
                            onClick={() => {
                              setForm((p) => ({ ...p, coverImage: "" }));
                              if (coverInputRef.current) coverInputRef.current.value = "";
                            }}
                            disabled={uploadingCover}
                            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            删除图片
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => coverInputRef.current?.click()}
                        disabled={uploadingCover}
                        className="w-full h-24 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploadingCover ? (
                          <>
                            <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                            <span className="text-xs text-gray-500">上传中...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs text-gray-500">点击上传封面图</span>
                            <span className="text-[10px] text-gray-400">PNG/JPG/GIF/WebP，最大 2MB</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* 描述与特性 */}
              <section>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <span className="text-blue-500">②</span> 描述与功能特性
                </h4>
                <div className="space-y-4">
                  {/* 详细介绍 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      详细介绍（Markdown） <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, description: e.target.value }))
                      }
                      rows={6}
                      className={`${INPUT_CLS} resize-y font-mono`}
                      placeholder="支持 Markdown 语法，详细介绍产品..."
                    />
                  </div>
                  {/* 功能特性 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      功能特性
                    </label>
                    <textarea
                      value={form.features}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, features: e.target.value }))
                      }
                      rows={5}
                      className={`${INPUT_CLS} resize-y`}
                      placeholder={"每行一个功能特性，例如：\n响应式布局\n权限管理\n数据可视化"}
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      每行一个特性，提交时将自动转为 JSON 数组
                    </p>
                  </div>
                </div>
              </section>

              {/* 链接 */}
              <section>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <span className="text-blue-500">③</span> 链接
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      演示地址
                    </label>
                    <input
                      type="text"
                      value={form.demoUrl}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, demoUrl: e.target.value }))
                      }
                      className={INPUT_CLS}
                      placeholder="https://demo.example.com（可选）"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      文档地址
                    </label>
                    <input
                      type="text"
                      value={form.docsUrl}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, docsUrl: e.target.value }))
                      }
                      className={INPUT_CLS}
                      placeholder="https://docs.example.com（可选）"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    下载链接
                    <span className="ml-1 text-xs font-normal text-gray-400">
                      （用户购买审核通过后显示）
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.downloadUrl}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, downloadUrl: e.target.value }))
                    }
                    className={INPUT_CLS}
                    placeholder="https://download.example.com/product.zip（可选）"
                  />
                </div>
              </section>

              {/* 定价 */}
              <section>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <span className="text-blue-500">④</span> 定价（单位：元）
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      价格
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                        ¥
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.priceStandard}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            priceStandard: e.target.value,
                          }))
                        }
                        className={`${INPUT_CLS} pl-7`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      授权有效期（天）
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.validDays}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          validDays: Number(e.target.value) || 365,
                        }))
                      }
                      className={INPUT_CLS}
                      placeholder="365"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      购买后默认授权有效天数
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={closeFormModal}
                disabled={saving}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? "保存中..."
                  : editingProduct
                  ? "保存修改"
                  : "创建产品"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 版本管理模态框 ============ */}
      {versionProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeVersionModal} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-xl">{versionProduct.icon || "📦"}</span>
                  <span className="truncate">版本管理 · {versionProduct.name}</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  管理产品版本、更新日志与下载发布
                </p>
              </div>
              <button
                onClick={closeVersionModal}
                disabled={versionSaving || deletingVersion}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 flex-shrink-0"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* 内容 */}
            <div className="px-6 py-5 space-y-6 overflow-y-auto">
              {/* 创建版本表单 */}
              <section className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  发布新版本
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      版本号 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={versionForm.version}
                      onChange={(e) =>
                        setVersionForm((p) => ({ ...p, version: e.target.value }))
                      }
                      className={INPUT_CLS}
                      placeholder="如 v1.2.0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      版本标题 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={versionForm.title}
                      onChange={(e) =>
                        setVersionForm((p) => ({ ...p, title: e.target.value }))
                      }
                      className={INPUT_CLS}
                      placeholder="如：性能优化与大版本更新"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      更新日志（Markdown） <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={versionForm.changelog}
                      onChange={(e) =>
                        setVersionForm((p) => ({ ...p, changelog: e.target.value }))
                      }
                      rows={4}
                      className={`${INPUT_CLS} resize-y font-mono`}
                      placeholder={"## 新功能\n- ...\n\n## 修复\n- ..."}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      下载链接 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={versionForm.downloadUrl}
                      onChange={(e) =>
                        setVersionForm((p) => ({
                          ...p,
                          downloadUrl: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                      placeholder="https://.../release.zip"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      下载密码
                    </label>
                    <input
                      type="text"
                      value={versionForm.downloadPassword}
                      onChange={(e) =>
                        setVersionForm((p) => ({
                          ...p,
                          downloadPassword: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                      placeholder="解压密码（可选）"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      文件大小
                    </label>
                    <input
                      type="text"
                      value={versionForm.fileSize}
                      onChange={(e) =>
                        setVersionForm((p) => ({ ...p, fileSize: e.target.value }))
                      }
                      className={INPUT_CLS}
                      placeholder="如 12.5 MB（可选）"
                    />
                  </div>
                  <div className="flex items-end gap-6 pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Toggle
                        checked={versionForm.isLatest}
                        onChange={(v) =>
                          setVersionForm((p) => ({ ...p, isLatest: v }))
                        }
                      />
                      <span className="text-sm text-gray-700">设为最新版本</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Toggle
                        checked={versionForm.isPublished}
                        onChange={(v) =>
                          setVersionForm((p) => ({ ...p, isPublished: v }))
                        }
                      />
                      <span className="text-sm text-gray-700">立即发布</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleCreateVersion}
                    disabled={versionSaving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    {versionSaving ? "创建中..." : "创建版本"}
                  </button>
                </div>
              </section>

              {/* 版本列表 */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">
                    历史版本
                    <span className="ml-1.5 text-gray-400 font-normal">
                      （{versions.length} 个）
                    </span>
                  </h4>
                </div>

                {versionsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-24 bg-gray-50 rounded-xl animate-pulse"
                      />
                    ))}
                  </div>
                ) : versions.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <div className="text-4xl mb-2">🏷️</div>
                    <p className="text-sm text-gray-500">暂无版本，请在上方发布第一个版本</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {versions.map((v) => (
                      <div
                        key={v.id}
                        className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                      >
                        {/* 版本头 */}
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 font-mono">
                                {v.version}
                              </span>
                              {v.isLatest && (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                  最新
                                </span>
                              )}
                              {v.isPublished ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700 border border-green-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                  已发布
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                  未发布
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-700 mt-1">
                              {v.title}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {formatDateTime(v.createdAt)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleToggleVersion(v, "isLatest")}
                              disabled={togglingVersionId === v.id}
                              title="设为/取消最新版本"
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                                v.isLatest
                                  ? "text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100"
                                  : "text-gray-600 bg-white border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              {togglingVersionId === v.id
                                ? "处理中..."
                                : v.isLatest
                                ? "最新版本"
                                : "设为最新"}
                            </button>
                            <button
                              onClick={() => handleToggleVersion(v, "isPublished")}
                              disabled={togglingVersionId === v.id}
                              title="发布/取消发布"
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                                v.isPublished
                                  ? "text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100"
                                  : "text-green-700 bg-green-50 border-green-200 hover:bg-green-100"
                              }`}
                            >
                              {togglingVersionId === v.id
                                ? "处理中..."
                                : v.isPublished
                                ? "取消发布"
                                : "发布"}
                            </button>
                            <button
                              onClick={() => setDeleteVersionTarget(v)}
                              disabled={deletingVersion}
                              title="删除版本"
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* 下载信息 */}
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 flex-wrap text-xs text-gray-500">
                          <a
                            href={v.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline truncate max-w-[260px]"
                            title={v.downloadUrl}
                          >
                            {v.downloadUrl}
                          </a>
                          {v.fileSize && (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-gray-400">大小:</span>
                              {v.fileSize}
                            </span>
                          )}
                          {v.downloadPassword && (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-gray-400">密码:</span>
                              <code className="px-1.5 py-0.5 bg-gray-100 rounded font-mono text-gray-600">
                                {v.downloadPassword}
                              </code>
                              <button
                                onClick={() =>
                                  handleCopy(v.downloadPassword!, "下载密码")
                                }
                                className="text-gray-400 hover:text-blue-600"
                                title="复制密码"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                  />
                                </svg>
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={closeVersionModal}
                disabled={versionSaving || deletingVersion}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 删除产品确认 ============ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">确认删除产品</h3>
            </div>
            <p className="text-gray-500 text-sm mb-1">
              确定要删除产品「
              <span className="font-medium text-gray-700">
                {deleteTarget.name}
              </span>
              」吗？
            </p>
            <p className="text-xs text-red-500 mb-6">
              此操作不可撤销，将同时删除该产品下的所有版本与订单，关联授权码将被解除绑定。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 删除版本确认 ============ */}
      {deleteVersionTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !deletingVersion && setDeleteVersionTarget(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">确认删除版本</h3>
            </div>
            <p className="text-gray-500 text-sm mb-6">
              确定要删除版本「
              <span className="font-mono font-medium text-gray-700">
                {deleteVersionTarget.version}
              </span>
              」吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteVersionTarget(null)}
                disabled={deletingVersion}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDeleteVersion}
                disabled={deletingVersion}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deletingVersion ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

// ============ 统计卡片组件 ============
function StatBox({
  label,
  value,
  icon,
  loading,
}: {
  label: string;
  value: number;
  icon: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {loading ? (
          <span className="inline-block w-8 h-6 bg-gray-100 rounded animate-pulse" />
        ) : (
          value
        )}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

// ============ 产品卡片组件 ============
function ProductCard({
  product,
  onEdit,
  onDelete,
  onManageVersions,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onManageVersions: () => void;
}) {
  const meta = getStatusMeta(product.status);
  const prices = [
    { label: "基础", value: product.priceBasic },
    { label: "标准", value: product.priceStandard },
    { label: "高级", value: product.pricePremium },
    { label: "企业", value: product.priceEnterprise },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-4">
        {/* 图标 */}
        <div className="w-14 h-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden">
          {product.coverImage ? (
            <img
              src={product.coverImage}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span>{product.icon || "📦"}</span>
          )}
        </div>

        {/* 主要信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {product.name}
            </h3>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${meta.color}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
            <code className="font-mono">{product.slug}</code>
            <span>·</span>
            <span>排序 {product.sortOrder}</span>
            <span>·</span>
            <span>有效期 {product.validDays} 天</span>
          </div>
          <p className="text-sm text-gray-600 mt-1.5 line-clamp-1">
            {product.tagline}
          </p>

          {/* 定价 */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {prices.map((p) => (
              <div
                key={p.label}
                className="flex items-baseline gap-1 text-xs"
              >
                <span className="text-gray-400">{p.label}</span>
                <span
                  className={`font-medium ${
                    p.value > 0 ? "text-gray-700" : "text-gray-300"
                  }`}
                >
                  {p.value > 0 ? `¥${centsToYuan(p.value)}` : "—"}
                </span>
              </div>
            ))}
          </div>

          {/* 统计 */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1" title="订单数">
              📋 订单 {product.orderCount}
            </span>
            <span className="inline-flex items-center gap-1" title="授权码数">
              📜 授权 {product.licenseCount}
            </span>
            <span className="inline-flex items-center gap-1" title="版本数">
              🏷️ 版本 {product.versionCount}
            </span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col items-stretch gap-2 flex-shrink-0">
          <button
            onClick={onManageVersions}
            title="版本管理"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5a.99.99 0 01.7.3l9.7 9.7a1 1 0 010 1.4l-5.6 5.6a1 1 0 01-1.4 0L5.7 12a1 1 0 01-.3-.7V5a2 2 0 012-2z"
              />
            </svg>
            版本管理
          </button>
          <button
            onClick={onEdit}
            title="编辑产品"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            编辑
          </button>
          <button
            onClick={onDelete}
            title="删除产品"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 开关组件 ============
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
        checked ? "bg-blue-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
