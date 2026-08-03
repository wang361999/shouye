"use client";

import { useState, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { adminFetch } from "@/lib/admin-fetch";
import { formatDateTime, centsToYuan } from "@/lib/admin-utils";
import {
  type Product,
  type ProductVersion,
  type VersionForm,
  EMPTY_VERSION_FORM,
  INPUT_CLS,
  getStatusMeta,
} from "./types";

// ============ 开关组件 ============
export function Toggle({
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

// ============ 产品卡片组件 ============
export function ProductCard({
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

// ============ 版本管理弹窗（产品详情查看） ============
export function ProductDetail({
  product,
  onClose,
  onVersionCountChange,
}: {
  product: Product;
  onClose: () => void;
  onVersionCountChange: (productId: string, delta: number) => void;
}) {
  const [versions, setVersions] = useState<ProductVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionForm, setVersionForm] = useState<VersionForm>(EMPTY_VERSION_FORM);
  const [versionSaving, setVersionSaving] = useState(false);
  const [deleteVersionTarget, setDeleteVersionTarget] =
    useState<ProductVersion | null>(null);
  const [deletingVersion, setDeletingVersion] = useState(false);
  const [togglingVersionId, setTogglingVersionId] = useState<string | null>(null);

  // ============ 获取版本列表 ============
  const fetchVersions = useCallback(async (productId: string) => {
    try {
      setVersionsLoading(true);
      const res = await adminFetch(
        `/api/admin/products/versions?productId=${productId}`
      );
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setVersions(Array.isArray(data) ? data : []);
    } catch {
      toast.error("获取版本列表失败");
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVersions(product.id);
    setDeleteVersionTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  // ============ 复制 ============
  async function handleCopy(text: string, label = "内容") {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label}已复制`);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  }

  function closeVersionModal() {
    if (versionSaving || deletingVersion) return;
    onClose();
  }

  // ============ 创建版本 ============
  async function handleCreateVersion() {
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
      const res = await adminFetch("/api/admin/products/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
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
      fetchVersions(product.id);
      // 同步产品列表中的版本计数
      onVersionCountChange(product.id, 1);
    } catch {
      toast.error("创建版本失败，请稍后重试");
    } finally {
      setVersionSaving(false);
    }
  }

  // ============ 切换版本 isLatest / isPublished ============
  async function handleToggleVersion(
    v: ProductVersion,
    field: "isLatest" | "isPublished"
  ) {
    const newValue = !v[field];
    try {
      setTogglingVersionId(v.id);
      const res = await adminFetch("/api/admin/products/versions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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

  // ============ 删除版本 ============
  async function handleDeleteVersion() {
    if (!deleteVersionTarget) return;
    try {
      setDeletingVersion(true);
      const res = await adminFetch(
        `/api/admin/products/versions?id=${deleteVersionTarget.id}`,
        {
          method: "DELETE",
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "删除版本失败");
        return;
      }
      toast.success("版本已删除");
      setVersions((prev) => prev.filter((v) => v.id !== deleteVersionTarget.id));
      onVersionCountChange(product.id, -1);
      setDeleteVersionTarget(null);
    } catch {
      toast.error("删除版本失败，请稍后重试");
    } finally {
      setDeletingVersion(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={closeVersionModal} />
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span className="text-xl">{product.icon || "📦"}</span>
                <span className="truncate">版本管理 · {product.name}</span>
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
    </>
  );
}
