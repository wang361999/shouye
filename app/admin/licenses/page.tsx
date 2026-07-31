"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

// ============ 类型定义 ============
interface LicenseDomain {
  domain: string;
  activatedAt: string;
  lastVerifiedAt: string | null;
}

interface LicenseOwner {
  id: string;
  username: string;
  email: string;
}

interface LicenseProduct {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

interface LicenseOrder {
  id: string;
  orderNo: string;
  status: string;
}

interface License {
  id: string;
  licenseKey: string;
  projectName: string;
  projectType: string; // basic | standard | premium | enterprise
  maxDomains: number;
  boundDomains: number;
  expiresAt: string;
  status: string; // active | suspended | expired | revoked
  remark: string | null;
  owner: LicenseOwner | null;
  product: LicenseProduct | null;
  order: LicenseOrder | null;
  domains: LicenseDomain[];
  logCount: number;
  createdAt: string;
}

interface ProductOption {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

interface LicenseLog {
  id: string;
  licenseId: string | null;
  licenseKey: string;
  domain: string;
  ip: string | null;
  userAgent: string | null;
  result: string;
  message: string | null;
  createdAt: string;
}

// ============ 套餐类型映射 ============
interface ProjectTypeMeta {
  label: string;
  defaultDomains: number;
  color: string;
}

const PROJECT_TYPE_MAP: Record<string, ProjectTypeMeta> = {
  basic: { label: "基础版", defaultDomains: 1, color: "bg-gray-100 text-gray-700 border-gray-200" },
  standard: { label: "标准版", defaultDomains: 2, color: "bg-blue-50 text-blue-700 border-blue-200" },
  premium: { label: "高级版", defaultDomains: 5, color: "bg-purple-50 text-purple-700 border-purple-200" },
  enterprise: { label: "企业版", defaultDomains: 10, color: "bg-amber-50 text-amber-700 border-amber-200" },
};

const PROJECT_TYPE_OPTIONS = [
  { value: "basic", label: "基础版 (1 域名)" },
  { value: "standard", label: "标准版 (2 域名)" },
  { value: "premium", label: "高级版 (5 域名)" },
  { value: "enterprise", label: "企业版 (10 域名)" },
];

// ============ 状态映射 ============
interface StatusMeta {
  label: string;
  color: string;
  dot: string;
}

const STATUS_MAP: Record<string, StatusMeta> = {
  active: { label: "有效", color: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  suspended: { label: "暂停", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  expired: { label: "过期", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  revoked: { label: "吊销", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-500" },
};

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "有效" },
  { value: "suspended", label: "暂停" },
  { value: "expired", label: "过期" },
  { value: "revoked", label: "吊销" },
];

const EDIT_STATUS_OPTIONS = [
  { value: "active", label: "有效 (active)" },
  { value: "suspended", label: "暂停 (suspended)" },
  { value: "expired", label: "过期 (expired)" },
  { value: "revoked", label: "吊销 (revoked)" },
];

// ============ 验证结果映射 ============
interface ResultMeta {
  label: string;
  color: string;
}

const RESULT_MAP: Record<string, ResultMeta> = {
  valid: { label: "验证通过", color: "bg-green-50 text-green-700 border-green-200" },
  invalid: { label: "无效", color: "bg-red-50 text-red-700 border-red-200" },
  expired: { label: "已过期", color: "bg-orange-50 text-orange-700 border-orange-200" },
  suspended: { label: "已暂停", color: "bg-amber-50 text-amber-700 border-amber-200" },
  domain_mismatch: { label: "域名不匹配", color: "bg-purple-50 text-purple-700 border-purple-200" },
  not_found: { label: "未找到", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

const RESULT_FILTER_OPTIONS = [
  { value: "all", label: "全部结果" },
  { value: "valid", label: "验证通过" },
  { value: "invalid", label: "无效" },
  { value: "expired", label: "已过期" },
  { value: "suspended", label: "已暂停" },
  { value: "domain_mismatch", label: "域名不匹配" },
  { value: "not_found", label: "未找到" },
];

const LOG_PAGE_SIZE = 20;

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

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDateInputValue(dateStr: string) {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isExpired(dateStr: string) {
  return new Date(dateStr).getTime() < Date.now();
}

function getProjectTypeMeta(type: string): ProjectTypeMeta {
  return PROJECT_TYPE_MAP[type] || { label: type, defaultDomains: 1, color: "bg-gray-100 text-gray-700 border-gray-200" };
}

function getStatusMeta(status: string): StatusMeta {
  return STATUS_MAP[status] || { label: status, color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" };
}

function getResultMeta(result: string): ResultMeta {
  return RESULT_MAP[result] || { label: result, color: "bg-gray-100 text-gray-700 border-gray-200" };
}

// ============ 页面组件 ============
export default function LicensesPage() {
  const { token } = useAppStore();

  // Tab 切换
  const [tab, setTab] = useState<"licenses" | "logs">("licenses");

  // ====== 授权码列表状态 ======
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 产品列表（用于下拉选择）
  const [products, setProducts] = useState<ProductOption[]>([]);

  // 创建授权码
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    projectName: "",
    projectType: "standard",
    validDays: 365,
    maxDomains: 2,
    remark: "",
    ownerUsername: "",
    productId: "",
  });
  const [createdLicense, setCreatedLicense] = useState<{ licenseKey: string; projectName: string } | null>(null);

  // 绑定域名
  const [bindingLicenseId, setBindingLicenseId] = useState<string | null>(null);
  const [bindDomainInput, setBindDomainInput] = useState("");
  const [binding, setBinding] = useState(false);
  const [unbindingDomain, setUnbindingDomain] = useState<string | null>(null);

  // 编辑
  const [editTarget, setEditTarget] = useState<License | null>(null);
  const [editForm, setEditForm] = useState({ remark: "", expiresAt: "", maxDomains: 1, status: "active", ownerUsername: "", productId: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // 删除
  const [deleteTarget, setDeleteTarget] = useState<License | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 状态切换 loading
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ====== 验证日志状态 ======
  const [logs, setLogs] = useState<LicenseLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [resultFilter, setResultFilter] = useState("all");
  const [domainKeyword, setDomainKeyword] = useState("");
  const [debouncedDomain, setDebouncedDomain] = useState("");
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logTotalPages, setLogTotalPages] = useState(1);

  // ============ 获取授权码列表 ============
  const fetchLicenses = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch("/api/admin/licenses", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        toast.error("登录已过期，请重新登录");
        return;
      }
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setLicenses(Array.isArray(data) ? data : []);
    } catch {
      toast.error("获取授权码列表失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchLicenses();
  }, [token, fetchLicenses]);

  // ============ 获取产品列表（用于下拉选择） ============
  const fetchProducts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/products", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.products || [];
      setProducts(list.map((p: Record<string, unknown>) => ({
        id: p.id as string,
        name: p.name as string,
        slug: p.slug as string,
        icon: (p.icon as string) || null,
      })));
    } catch {
      // 静默失败，不影响主流程
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchProducts();
  }, [token, fetchProducts]);

  // ============ 获取验证日志 ============
  const fetchLogs = useCallback(async () => {
    if (!token) return;
    try {
      setLogsLoading(true);
      const params = new URLSearchParams({
        page: String(logPage),
        pageSize: String(LOG_PAGE_SIZE),
      });
      if (resultFilter !== "all") params.set("result", resultFilter);
      if (debouncedDomain) params.set("domain", debouncedDomain);

      const res = await fetch(`/api/admin/licenses/logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        toast.error("登录已过期，请重新登录");
        return;
      }
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setLogTotal(data.pagination?.total || 0);
      setLogTotalPages(data.pagination?.totalPages || 1);
    } catch {
      toast.error("获取验证日志失败");
    } finally {
      setLogsLoading(false);
    }
  }, [token, logPage, resultFilter, debouncedDomain]);

  useEffect(() => {
    if (tab === "logs" && token) fetchLogs();
  }, [tab, token, fetchLogs]);

  // 日志域名搜索防抖
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedDomain(domainKeyword.trim());
      setLogPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [domainKeyword]);

  // 结果筛选变化回到第一页
  useEffect(() => {
    setLogPage(1);
  }, [resultFilter]);

  // ============ 客户端筛选授权码 ============
  const filteredLicenses = useMemo(() => {
    return licenses.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      const kw = keyword.trim().toLowerCase();
      if (kw) {
        const hay = `${l.licenseKey} ${l.projectName} ${l.remark || ""}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [licenses, statusFilter, keyword]);

  // ============ 复制 ============
  async function handleCopy(text: string, label = "内容") {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label}已复制`);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  }

  // ============ 打开/关闭创建模态框 ============
  function openCreateModal() {
    setCreateForm({
      projectName: "",
      projectType: "standard",
      validDays: 365,
      maxDomains: PROJECT_TYPE_MAP.standard.defaultDomains,
      remark: "",
      ownerUsername: "",
      productId: "",
    });
    setCreateOpen(true);
  }

  function closeCreateModal() {
    if (submitting) return;
    setCreateOpen(false);
  }

  function handleCreateTypeChange(type: string) {
    const meta = getProjectTypeMeta(type);
    setCreateForm((p) => ({ ...p, projectType: type, maxDomains: meta.defaultDomains }));
  }

  // ============ 创建授权码 ============
  async function handleCreate() {
    if (!token) return;
    const projectName = createForm.projectName.trim();
    if (!projectName) {
      toast.error("请输入项目名称");
      return;
    }
    if (!createForm.maxDomains || createForm.maxDomains < 1) {
      toast.error("最大域名数需大于 0");
      return;
    }
    if (!createForm.validDays || createForm.validDays < 1) {
      toast.error("有效期天数需大于 0");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectName,
          projectType: createForm.projectType,
          maxDomains: createForm.maxDomains,
          validDays: createForm.validDays,
          remark: createForm.remark.trim() || undefined,
          ownerUsername: createForm.ownerUsername.trim() || undefined,
          productId: createForm.productId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "创建失败");
        return;
      }
      toast.success("授权码创建成功");
      setCreateOpen(false);
      if (data.licenseKey) {
        setCreatedLicense({ licenseKey: data.licenseKey, projectName });
      }
      fetchLicenses();
    } catch {
      toast.error("创建失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  // ============ 停用 / 启用 ============
  async function handleToggleStatus(license: License) {
    if (!token) return;
    const newStatus = license.status === "active" ? "suspended" : "active";
    try {
      setTogglingId(license.id);
      const res = await fetch("/api/admin/licenses", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: license.id, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "操作失败");
        return;
      }
      toast.success(newStatus === "active" ? "已启用" : "已停用");
      setLicenses((prev) =>
        prev.map((l) => (l.id === license.id ? { ...l, status: newStatus } : l))
      );
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setTogglingId(null);
    }
  }

  // ============ 删除授权码 ============
  async function handleDelete() {
    if (!token || !deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/admin/licenses?id=${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "删除失败");
        return;
      }
      toast.success("授权码已删除");
      setLicenses((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      toast.error("删除失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  }

  // ============ 打开编辑模态框 ============
  function openEditModal(license: License) {
    setEditTarget(license);
    setEditForm({
      remark: license.remark || "",
      expiresAt: toDateInputValue(license.expiresAt),
      maxDomains: license.maxDomains,
      status: license.status,
      ownerUsername: license.owner?.username || "",
      productId: license.product?.id || "",
    });
  }

  // ============ 提交编辑 ============
  async function handleEdit() {
    if (!token || !editTarget) return;
    if (!editForm.maxDomains || editForm.maxDomains < 1) {
      toast.error("最大域名数需大于 0");
      return;
    }
    if (!editForm.expiresAt) {
      toast.error("请选择到期时间");
      return;
    }
    try {
      setEditSubmitting(true);
      const res = await fetch("/api/admin/licenses", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: editTarget.id,
          status: editForm.status,
          remark: editForm.remark.trim(),
          maxDomains: editForm.maxDomains,
          expiresAt: editForm.expiresAt,
          ownerUsername: editForm.ownerUsername.trim(),
          productId: editForm.productId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "更新失败");
        return;
      }
      toast.success("授权码已更新");
      // 本地更新：状态若仍为 active 但到期时间已过期则展示为 expired
      const newExpiresAt = new Date(editForm.expiresAt).toISOString();
      const computedStatus =
        editForm.status === "active" && isExpired(newExpiresAt) ? "expired" : editForm.status;
      // 查找选中的产品对象
      const selectedProduct = products.find((p) => p.id === editForm.productId) || null;
      const productObj = selectedProduct
        ? { id: selectedProduct.id, name: selectedProduct.name, slug: selectedProduct.slug, icon: selectedProduct.icon }
        : null;
      setLicenses((prev) =>
        prev.map((l) =>
          l.id === editTarget.id
            ? {
                ...l,
                remark: editForm.remark.trim(),
                expiresAt: newExpiresAt,
                maxDomains: editForm.maxDomains,
                status: computedStatus,
                owner: editForm.ownerUsername.trim()
                  ? (l.owner?.username === editForm.ownerUsername.trim()
                      ? l.owner
                      : { id: "", username: editForm.ownerUsername.trim(), email: "" })
                  : null,
                product: productObj,
              }
            : l
        )
      );
      setEditTarget(null);
    } catch {
      toast.error("更新失败，请稍后重试");
    } finally {
      setEditSubmitting(false);
    }
  }

  // ============ 绑定域名 ============
  const bindingLicense = bindingLicenseId
    ? licenses.find((l) => l.id === bindingLicenseId) || null
    : null;

  function openBindingModal(license: License) {
    setBindingLicenseId(license.id);
    setBindDomainInput("");
  }

  async function handleBindDomain() {
    if (!token || !bindingLicenseId) return;
    const domain = bindDomainInput.trim();
    if (!domain) {
      toast.error("请输入域名");
      return;
    }
    try {
      setBinding(true);
      const res = await fetch("/api/admin/licenses/domains", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ licenseId: bindingLicenseId, domain }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "绑定失败");
        return;
      }
      toast.success("域名绑定成功");
      setBindDomainInput("");
      setLicenses((prev) =>
        prev.map((l) => {
          if (l.id !== bindingLicenseId) return l;
          return {
            ...l,
            domains: [
              ...l.domains,
              {
                domain: data.domain || domain,
                activatedAt: data.activatedAt || new Date().toISOString(),
                lastVerifiedAt: null,
              },
            ],
            boundDomains: l.boundDomains + 1,
          };
        })
      );
    } catch {
      toast.error("绑定失败，请稍后重试");
    } finally {
      setBinding(false);
    }
  }

  async function handleUnbindDomain(domain: string) {
    if (!token || !bindingLicenseId) return;
    try {
      setUnbindingDomain(domain);
      const res = await fetch(`/api/admin/licenses/domains?domain=${encodeURIComponent(domain)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "解绑失败");
        return;
      }
      toast.success("域名已解绑");
      setLicenses((prev) =>
        prev.map((l) => {
          if (l.id !== bindingLicenseId) return l;
          return {
            ...l,
            domains: l.domains.filter((d) => d.domain !== domain),
            boundDomains: Math.max(0, l.boundDomains - 1),
          };
        })
      );
    } catch {
      toast.error("解绑失败，请稍后重试");
    } finally {
      setUnbindingDomain(null);
    }
  }

  // ============ 渲染套餐类型标签 ============
  function renderProjectType(type: string) {
    const meta = getProjectTypeMeta(type);
    return (
      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${meta.color}`}>
        {meta.label}
      </span>
    );
  }

  // ============ 渲染状态徽章 ============
  function renderStatus(status: string) {
    const meta = getStatusMeta(status);
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${meta.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
      </span>
    );
  }

  // ============ 渲染验证结果标签 ============
  function renderResultTag(result: string) {
    const meta = getResultMeta(result);
    return (
      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${meta.color}`}>
        {meta.label}
      </span>
    );
  }

  return (
    <AdminLayout activeKey="settings-licenses">
      <div className="space-y-6">
        {/* 页头 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📜 授权管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            管理授权码、绑定域名及查看验证日志
          </p>
        </div>

        {/* Tab 切换 */}
        <div className="bg-white rounded-xl border border-gray-200 p-1 inline-flex gap-1">
          <button
            onClick={() => setTab("licenses")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === "licenses"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            授权码列表
            <span
              className={`ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs rounded-full ${
                tab === "licenses" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              {licenses.length}
            </span>
          </button>
          <button
            onClick={() => setTab("logs")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === "logs"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            验证日志
          </button>
        </div>

        {/* ============ Tab 1: 授权码列表 ============ */}
        {tab === "licenses" && (
          <>
            {/* 筛选栏 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* 状态筛选 */}
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
                {/* 搜索框 */}
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
                    placeholder="搜索授权码 / 项目名 / 备注..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {/* 创建按钮 */}
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  创建授权码
                </button>
              </div>
            </div>

            {/* 列表区域 */}
            {loading ? (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="animate-pulse p-6 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded" />
                  ))}
                </div>
              </div>
            ) : filteredLicenses.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="text-5xl mb-3">📜</div>
                <p className="text-gray-500 mb-1">
                  {statusFilter !== "all" || keyword ? "没有符合条件的授权码" : "暂无授权码"}
                </p>
                <p className="text-sm text-gray-400 mb-4">
                  创建一个授权码以开启项目授权验证
                </p>
                {(statusFilter !== "all" || keyword) ? (
                  <button
                    onClick={() => {
                      setStatusFilter("all");
                      setKeyword("");
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 mr-3"
                  >
                    清空筛选条件
                  </button>
                ) : null}
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  创建第一个授权码
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">授权码</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">项目名称</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">关联产品</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">归属用户</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">套餐类型</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">域名配额</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">到期时间</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">状态</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredLicenses.map((license) => {
                        const expanded = expandedId === license.id;
                        const expired = isExpired(license.expiresAt);
                        const quotaFull = license.boundDomains >= license.maxDomains;
                        return (
                          <Fragment key={license.id}>
                            <tr className="hover:bg-gray-50 transition-colors">
                              {/* 授权码 */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <code
                                    className="text-xs text-gray-700 font-mono max-w-[160px] truncate block"
                                    title={license.licenseKey}
                                  >
                                    {license.licenseKey}
                                  </code>
                                  <button
                                    onClick={() => handleCopy(license.licenseKey, "授权码")}
                                    title="复制授权码"
                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                              {/* 项目名称 */}
                              <td className="px-4 py-3">
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-900 truncate max-w-[160px]" title={license.projectName}>
                                    {license.projectName}
                                  </div>
                                  {license.remark && (
                                    <div className="text-xs text-gray-400 truncate max-w-[160px]" title={license.remark}>
                                      {license.remark}
                                    </div>
                                  )}
                                </div>
                              </td>
                              {/* 关联产品 */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {license.product ? (
                                  <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                                    {license.product.icon && (
                                      <span className="text-base leading-none">{license.product.icon}</span>
                                    )}
                                    <span className="truncate max-w-[120px]" title={license.product.name}>
                                      {license.product.name}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">未关联</span>
                                )}
                              </td>
                              {/* 归属用户 */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {license.owner ? (
                                  <div className="min-w-0">
                                    <div className="text-sm text-gray-700 truncate max-w-[120px]" title={license.owner.username}>
                                      {license.owner.username}
                                    </div>
                                    {license.owner.email && (
                                      <div className="text-xs text-gray-400 truncate max-w-[120px]" title={license.owner.email}>
                                        {license.owner.email}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">未分配</span>
                                )}
                              </td>
                              {/* 套餐类型 */}
                              <td className="px-4 py-3 whitespace-nowrap">{renderProjectType(license.projectType)}</td>
                              {/* 域名配额 */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={quotaFull ? "text-red-600 font-medium" : "text-gray-600"}>
                                  {license.boundDomains}
                                </span>
                                <span className="text-gray-300"> / </span>
                                <span className="text-gray-600">{license.maxDomains}</span>
                              </td>
                              {/* 到期时间 */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={expired ? "text-red-600 font-medium" : "text-gray-600"}>
                                  {formatDate(license.expiresAt)}
                                </span>
                                {expired && license.status === "active" && (
                                  <span className="ml-1 text-xs text-red-500">已过期</span>
                                )}
                              </td>
                              {/* 状态 */}
                              <td className="px-4 py-3 whitespace-nowrap">{renderStatus(license.status)}</td>
                              {/* 操作 */}
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  {/* 查看详情 */}
                                  <button
                                    onClick={() => setExpandedId(expanded ? null : license.id)}
                                    title={expanded ? "收起详情" : "查看详情"}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </button>
                                  {/* 绑定域名 */}
                                  <button
                                    onClick={() => openBindingModal(license)}
                                    title="绑定域名"
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                  </button>
                                  {/* 编辑 */}
                                  <button
                                    onClick={() => openEditModal(license)}
                                    title="编辑"
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  {/* 停用/启用 */}
                                  <button
                                    onClick={() => handleToggleStatus(license)}
                                    disabled={togglingId === license.id || license.status === "expired" || license.status === "revoked"}
                                    title={
                                      license.status === "expired"
                                        ? "已过期，请在编辑中修改"
                                        : license.status === "revoked"
                                        ? "已吊销，请在编辑中修改"
                                        : license.status === "active"
                                        ? "停用"
                                        : "启用"
                                    }
                                    className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                      license.status === "active"
                                        ? "text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100"
                                        : "text-green-700 bg-green-50 border-green-200 hover:bg-green-100"
                                    }`}
                                  >
                                    {togglingId === license.id
                                      ? "处理中..."
                                      : license.status === "active"
                                      ? "停用"
                                      : "启用"}
                                  </button>
                                  {/* 删除 */}
                                  <button
                                    onClick={() => setDeleteTarget(license)}
                                    title="删除"
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {/* 展开行：域名列表 */}
                            {expanded && (
                              <tr className="bg-gray-50/50">
                                <td colSpan={9} className="px-4 py-4">
                                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-sm font-semibold text-gray-800">
                                        已绑定域名
                                        <span className="ml-2 text-xs font-normal text-gray-400">
                                          {license.domains.length} / {license.maxDomains}
                                        </span>
                                      </h4>
                                      <button
                                        onClick={() => openBindingModal(license)}
                                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        管理域名
                                      </button>
                                    </div>
                                    {license.domains.length === 0 ? (
                                      <p className="text-sm text-gray-400 py-2">尚未绑定任何域名</p>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {license.domains.map((d) => (
                                          <div
                                            key={d.domain}
                                            className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100"
                                          >
                                            <div className="min-w-0">
                                              <div className="text-sm text-gray-700 font-medium truncate" title={d.domain}>
                                                {d.domain}
                                              </div>
                                              <div className="text-xs text-gray-400">
                                                激活: {formatDate(d.activatedAt)}
                                                {d.lastVerifiedAt && ` · 验证: ${formatDate(d.lastVerifiedAt)}`}
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => {
                                                setBindingLicenseId(license.id);
                                                handleUnbindDomain(d.domain);
                                              }}
                                              title="解绑域名"
                                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                              </svg>
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
                                      <span>验证日志: {license.logCount} 条</span>
                                      <span>创建时间: {formatDateTime(license.createdAt)}</span>
                                      {license.owner && (
                                        <span>归属用户: {license.owner.username}{license.owner.email && ` (${license.owner.email})`}</span>
                                      )}
                                      {license.product && (
                                        <span>关联产品: {license.product.name}</span>
                                      )}
                                      {license.order && (
                                        <span>关联订单: {license.order.orderNo}</span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ============ Tab 2: 验证日志 ============ */}
        {tab === "logs" && (
          <>
            {/* 筛选栏 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* 结果筛选 */}
                <select
                  value={resultFilter}
                  onChange={(e) => setResultFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {RESULT_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {/* 域名搜索 */}
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
                    value={domainKeyword}
                    onChange={(e) => setDomainKeyword(e.target.value)}
                    placeholder="搜索域名..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* 日志表格 */}
            {logsLoading ? (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="animate-pulse p-6 space-y-4">
                  <div className="h-10 bg-gray-100 rounded" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-14 bg-gray-100 rounded" />
                  ))}
                </div>
              </div>
            ) : logs.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-gray-500 mb-4">
                  {resultFilter !== "all" || domainKeyword ? "没有符合条件的日志" : "暂无验证日志"}
                </p>
                {(resultFilter !== "all" || domainKeyword) && (
                  <button
                    onClick={() => {
                      setResultFilter("all");
                      setDomainKeyword("");
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    清空筛选条件
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">时间</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">授权码</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">域名</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">IP</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">验证结果</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">详情消息</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          {/* 时间 */}
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                          {/* 授权码 */}
                          <td className="px-4 py-3">
                            <code
                              className="text-xs text-gray-600 font-mono max-w-[150px] truncate block"
                              title={log.licenseKey}
                            >
                              {log.licenseKey}
                            </code>
                          </td>
                          {/* 域名 */}
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{log.domain}</td>
                          {/* IP */}
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                            {log.ip || <span className="text-gray-400">-</span>}
                          </td>
                          {/* 验证结果 */}
                          <td className="px-4 py-3 whitespace-nowrap">{renderResultTag(log.result)}</td>
                          {/* 详情消息 */}
                          <td className="px-4 py-3 text-gray-600 max-w-[280px]">
                            {log.message ? (
                              <span className="block truncate" title={log.message}>
                                {log.message}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 底部：总数 + 分页 */}
            {!logsLoading && (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-sm text-gray-500">
                  共 <span className="font-medium text-gray-700">{logTotal}</span> 条日志
                </div>
                <Pagination
                  currentPage={logPage}
                  totalPages={logTotalPages}
                  onPageChange={setLogPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ============ 创建授权码模态框 ============ */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeCreateModal} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">创建授权码</h3>
              <button
                onClick={closeCreateModal}
                disabled={submitting}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 表单 */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto">
              {/* 项目名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  项目名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.projectName}
                  onChange={(e) => setCreateForm((p) => ({ ...p, projectName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="如：企业官网"
                />
              </div>

              {/* 关联产品 + 归属用户 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 关联产品 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">关联产品</label>
                  <select
                    value={createForm.productId}
                    onChange={(e) => setCreateForm((p) => ({ ...p, productId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">不关联产品</option>
                    {products.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.icon ? `${prod.icon} ` : ""}{prod.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-gray-400">可选，将此授权码关联到某个产品</p>
                </div>
                {/* 归属用户 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">归属用户</label>
                  <input
                    type="text"
                    value={createForm.ownerUsername}
                    onChange={(e) => setCreateForm((p) => ({ ...p, ownerUsername: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="用户名（可选）"
                  />
                  <p className="mt-1.5 text-xs text-gray-400">填写用户名以分配给对应用户</p>
                </div>
              </div>

              {/* 套餐类型 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">套餐类型</label>
                <select
                  value={createForm.projectType}
                  onChange={(e) => handleCreateTypeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {PROJECT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-gray-400">选择套餐后将自动填充对应域名配额，可手动修改</p>
              </div>

              {/* 有效期天数 + 最大域名数 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">有效期天数</label>
                  <input
                    type="number"
                    min={1}
                    value={createForm.validDays}
                    onChange={(e) => setCreateForm((p) => ({ ...p, validDays: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="365"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">最大域名数</label>
                  <input
                    type="number"
                    min={1}
                    value={createForm.maxDomains}
                    onChange={(e) => setCreateForm((p) => ({ ...p, maxDomains: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* 备注 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
                <textarea
                  value={createForm.remark}
                  onChange={(e) => setCreateForm((p) => ({ ...p, remark: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="客户信息或用途说明（可选）"
                />
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={closeCreateModal}
                disabled={submitting}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "创建中..." : "创建授权码"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 创建成功 - 展示授权码 ============ */}
      {createdLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            {/* 头部 */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">授权码创建成功</h3>
                  <p className="text-xs text-gray-500">{createdLicense.projectName}</p>
                </div>
              </div>
            </div>

            {/* 内容 */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-amber-800">
                  请妥善保存以下授权码，将其提供给客户用于项目授权验证。
                </p>
              </div>

              {/* 授权码 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">授权码</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 break-all">
                    {createdLicense.licenseKey}
                  </code>
                  <button
                    onClick={() => handleCopy(createdLicense.licenseKey, "授权码")}
                    className="px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                  >
                    复制
                  </button>
                </div>
              </div>
            </div>

            {/* 底部 */}
            <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setCreatedLicense(null)}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                我已保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 绑定域名模态框 ============ */}
      {bindingLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !binding && !unbindingDomain && setBindingLicenseId(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">绑定域名</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {bindingLicense.projectName} ·{" "}
                  <span className="font-mono">{bindingLicense.licenseKey}</span>
                </p>
              </div>
              <button
                onClick={() => !binding && !unbindingDomain && setBindingLicenseId(null)}
                disabled={binding || !!unbindingDomain}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 内容 */}
            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              {/* 配额提示 */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">域名配额</span>
                <span className={bindingLicense.boundDomains >= bindingLicense.maxDomains ? "text-red-600 font-medium" : "text-gray-700"}>
                  {bindingLicense.boundDomains} / {bindingLicense.maxDomains}
                </span>
              </div>

              {/* 绑定新域名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">绑定新域名</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bindDomainInput}
                    onChange={(e) => setBindDomainInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleBindDomain();
                    }}
                    disabled={bindingLicense.boundDomains >= bindingLicense.maxDomains}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                    placeholder="example.com"
                  />
                  <button
                    onClick={handleBindDomain}
                    disabled={binding || bindingLicense.boundDomains >= bindingLicense.maxDomains}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {binding ? "绑定中..." : "绑定"}
                  </button>
                </div>
                {bindingLicense.boundDomains >= bindingLicense.maxDomains && (
                  <p className="mt-1.5 text-xs text-red-500">已达到最大绑定域名数，请先解绑或升级套餐</p>
                )}
                <p className="mt-1.5 text-xs text-gray-400">无需填写协议与端口，如 https://example.com:8080 会自动标准化为 example.com</p>
              </div>

              {/* 已绑定域名列表 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  已绑定域名（{bindingLicense.domains.length}）
                </label>
                {bindingLicense.domains.length === 0 ? (
                  <p className="text-sm text-gray-400 py-3 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    尚未绑定任何域名
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {bindingLicense.domains.map((d) => (
                      <div
                        key={d.domain}
                        className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <div className="min-w-0">
                          <div className="text-sm text-gray-700 font-medium truncate" title={d.domain}>
                            {d.domain}
                          </div>
                          <div className="text-xs text-gray-400">
                            激活: {formatDate(d.activatedAt)}
                            {d.lastVerifiedAt && ` · 验证: ${formatDate(d.lastVerifiedAt)}`}
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnbindDomain(d.domain)}
                          disabled={!!unbindingDomain}
                          title="解绑域名"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0 disabled:opacity-50"
                        >
                          {unbindingDomain === d.domain ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setBindingLicenseId(null)}
                disabled={binding || !!unbindingDomain}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 编辑模态框 ============ */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !editSubmitting && setEditTarget(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">编辑授权码</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editTarget.projectName} ·{" "}
                  <span className="font-mono">{editTarget.licenseKey}</span>
                </p>
              </div>
              <button
                onClick={() => !editSubmitting && setEditTarget(null)}
                disabled={editSubmitting}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 表单 */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto">
              {/* 关联产品 + 归属用户 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 关联产品 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">关联产品</label>
                  <select
                    value={editForm.productId}
                    onChange={(e) => setEditForm((p) => ({ ...p, productId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">不关联产品</option>
                    {products.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.icon ? `${prod.icon} ` : ""}{prod.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* 归属用户 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">归属用户</label>
                  <input
                    type="text"
                    value={editForm.ownerUsername}
                    onChange={(e) => setEditForm((p) => ({ ...p, ownerUsername: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="用户名（留空取消分配）"
                  />
                </div>
              </div>

              {/* 备注 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
                <textarea
                  value={editForm.remark}
                  onChange={(e) => setEditForm((p) => ({ ...p, remark: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="客户信息或用途说明（可选）"
                />
              </div>

              {/* 到期时间 + 最大域名数 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">到期时间</label>
                  <input
                    type="date"
                    value={editForm.expiresAt}
                    onChange={(e) => setEditForm((p) => ({ ...p, expiresAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">最大域名数</label>
                  <input
                    type="number"
                    min={1}
                    value={editForm.maxDomains}
                    onChange={(e) => setEditForm((p) => ({ ...p, maxDomains: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* 状态 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">状态</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {EDIT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {editForm.status === "active" && editForm.expiresAt && isExpired(editForm.expiresAt) && (
                  <p className="mt-1.5 text-xs text-red-500">到期时间已早于今天，保存后将显示为「过期」</p>
                )}
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setEditTarget(null)}
                disabled={editSubmitting}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleEdit}
                disabled={editSubmitting}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editSubmitting ? "保存中..." : "保存修改"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 删除确认模态框 ============ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">确认删除</h3>
            </div>
            <p className="text-gray-500 text-sm mb-1">
              确定要删除授权码「
              <span className="font-medium text-gray-700">{deleteTarget.projectName}</span>
              」吗？
            </p>
            <p className="text-xs text-gray-400 font-mono mb-1 break-all">{deleteTarget.licenseKey}</p>
            <p className="text-xs text-red-500 mb-6">
              此操作不可撤销，将同时清除该授权码关联的所有域名绑定与验证日志。
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
    </AdminLayout>
  );
}

// ============ 分页器组件 ============
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | string)[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        上一页
      </button>
      {pages.map((p, i) =>
        typeof p === "number" ? (
          <button
            key={i}
            onClick={() => onPageChange(p)}
            className={`min-w-[32px] px-2 py-1.5 text-sm rounded-lg border transition-colors ${
              p === currentPage
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {p}
          </button>
        ) : (
          <span key={i} className="px-2 text-gray-400">
            {p}
          </span>
        )
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        下一页
      </button>
    </div>
  );
}
