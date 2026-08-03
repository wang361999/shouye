"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import toast from "react-hot-toast";
import { adminFetch } from "@/lib/admin-fetch";
import {
  type License,
  type LicenseLog,
  type ProductOption,
  LOG_PAGE_SIZE,
  PROJECT_TYPE_MAP,
  toDateInputValue,
  isExpired,
} from "@/components/admin/licenses/types";
import { LicensesList, LicenseLogsList } from "@/components/admin/licenses/LicensesList";
import {
  LicenseCreateModal,
  LicenseCreatedSuccessModal,
  LicenseBindingModal,
  LicenseEditModal,
  LicenseDeleteConfirmModal,
} from "@/components/admin/licenses/LicenseFormModal";

// ============ 页面组件 ============
export default function LicensesPage() {
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
    try {
      setLoading(true);
      const res = await adminFetch("/api/admin/licenses");
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setLicenses(Array.isArray(data) ? data : []);
    } catch {
      toast.error("获取授权码列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLicenses();
  }, [fetchLicenses]);

  // ============ 获取产品列表（用于下拉选择） ============
  const fetchProducts = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/products");
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
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ============ 获取验证日志 ============
  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const params = new URLSearchParams({
        page: String(logPage),
        pageSize: String(LOG_PAGE_SIZE),
      });
      if (resultFilter !== "all") params.set("result", resultFilter);
      if (debouncedDomain) params.set("domain", debouncedDomain);

      const res = await adminFetch(`/api/admin/licenses/logs?${params}`);
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
  }, [logPage, resultFilter, debouncedDomain]);

  useEffect(() => {
    if (tab === "logs") fetchLogs();
  }, [tab, fetchLogs]);

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

  // ============ 创建授权码 ============
  async function handleCreate() {
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
      const res = await adminFetch("/api/admin/licenses", {
        method: "POST",
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
    const newStatus = license.status === "active" ? "suspended" : "active";
    try {
      setTogglingId(license.id);
      const res = await adminFetch("/api/admin/licenses", {
        method: "PATCH",
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
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await adminFetch(`/api/admin/licenses?id=${deleteTarget.id}`, {
        method: "DELETE",
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
    if (!editTarget) return;
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
      const res = await adminFetch("/api/admin/licenses", {
        method: "PATCH",
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
    if (!bindingLicenseId) return;
    const domain = bindDomainInput.trim();
    if (!domain) {
      toast.error("请输入域名");
      return;
    }
    try {
      setBinding(true);
      const res = await adminFetch("/api/admin/licenses/domains", {
        method: "POST",
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
    if (!bindingLicenseId) return;
    try {
      setUnbindingDomain(domain);
      const res = await adminFetch(`/api/admin/licenses/domains?domain=${encodeURIComponent(domain)}`, {
        method: "DELETE",
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

  // ============ 从展开行直接解绑域名 ============
  async function handleUnbindDomainFromRow(licenseId: string, domain: string) {
    try {
      setUnbindingDomain(domain);
      const res = await adminFetch(`/api/admin/licenses/domains?domain=${encodeURIComponent(domain)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "解绑失败");
        return;
      }
      toast.success("域名已解绑");
      setLicenses((prev) =>
        prev.map((l) => {
          if (l.id !== licenseId) return l;
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
          <LicensesList
            licenses={filteredLicenses}
            loading={loading}
            statusFilter={statusFilter}
            keyword={keyword}
            onStatusFilterChange={setStatusFilter}
            onKeywordChange={setKeyword}
            onOpenCreate={openCreateModal}
            expandedId={expandedId}
            onToggleExpand={setExpandedId}
            togglingId={togglingId}
            onToggleStatus={handleToggleStatus}
            onCopy={handleCopy}
            onOpenBinding={openBindingModal}
            onOpenEdit={openEditModal}
            onDelete={setDeleteTarget}
            onUnbindDomainFromRow={handleUnbindDomainFromRow}
          />
        )}

        {/* ============ Tab 2: 验证日志 ============ */}
        {tab === "logs" && (
          <LicenseLogsList
            logs={logs}
            loading={logsLoading}
            resultFilter={resultFilter}
            domainKeyword={domainKeyword}
            onResultFilterChange={setResultFilter}
            onDomainKeywordChange={setDomainKeyword}
            logTotal={logTotal}
            logPage={logPage}
            logTotalPages={logTotalPages}
            onLogPageChange={setLogPage}
          />
        )}
      </div>

      {/* ============ 创建授权码模态框 ============ */}
      {createOpen && (
        <LicenseCreateModal
          createForm={createForm}
          setCreateForm={setCreateForm}
          submitting={submitting}
          products={products}
          onClose={closeCreateModal}
          onCreate={handleCreate}
        />
      )}

      {/* ============ 创建成功 - 展示授权码 ============ */}
      {createdLicense && (
        <LicenseCreatedSuccessModal
          createdLicense={createdLicense}
          onCopy={handleCopy}
          onClose={() => setCreatedLicense(null)}
        />
      )}

      {/* ============ 绑定域名模态框 ============ */}
      {bindingLicense && (
        <LicenseBindingModal
          bindingLicense={bindingLicense}
          bindDomainInput={bindDomainInput}
          setBindDomainInput={setBindDomainInput}
          binding={binding}
          unbindingDomain={unbindingDomain}
          onBindDomain={handleBindDomain}
          onUnbindDomain={handleUnbindDomain}
          onClose={() => setBindingLicenseId(null)}
        />
      )}

      {/* ============ 编辑模态框 ============ */}
      {editTarget && (
        <LicenseEditModal
          editTarget={editTarget}
          editForm={editForm}
          setEditForm={setEditForm}
          editSubmitting={editSubmitting}
          products={products}
          onEdit={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* ============ 删除确认模态框 ============ */}
      {deleteTarget && (
        <LicenseDeleteConfirmModal
          deleteTarget={deleteTarget}
          deleting={deleting}
          onDelete={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </AdminLayout>
  );
}
