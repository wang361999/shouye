"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import toast from "react-hot-toast";
import { adminFetch } from "@/lib/admin-fetch";
import { ProductsList } from "@/components/admin/products/ProductsList";
import { ProductFormModal } from "@/components/admin/products/ProductFormModal";
import { ProductDetail } from "@/components/admin/products/ProductDetail";
import { type Product } from "@/components/admin/products/types";

// ============ 主页面组件 ============
export default function ProductsAdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState("");

  // 产品表单（创建/编辑）
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // 删除产品
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 版本管理
  const [versionProduct, setVersionProduct] = useState<Product | null>(null);

  // ============ 获取产品列表 ============
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminFetch("/api/admin/products");
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      toast.error("获取产品列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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

  // ============ 打开创建/编辑 ============
  function openCreateModal() {
    setEditingProduct(null);
    setFormOpen(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setFormOpen(true);
  }

  function closeFormModal() {
    setFormOpen(false);
  }

  // 表单保存成功后：关闭弹窗 + 刷新列表
  function handleFormSaved() {
    setFormOpen(false);
    fetchProducts();
  }

  // ============ 版本管理 ============
  function openVersionModal(product: Product) {
    setVersionProduct(product);
  }

  function closeVersionModal() {
    setVersionProduct(null);
  }

  // 版本计数同步（创建/删除版本时更新列表中的 versionCount）
  function handleVersionCountChange(productId: string, delta: number) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
              ...p,
              versionCount:
                delta > 0
                  ? p.versionCount + 1
                  : Math.max(0, p.versionCount - 1),
            }
          : p
      )
    );
  }

  // ============ 删除产品 ============
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await adminFetch(`/api/admin/products?id=${deleteTarget.id}`, {
        method: "DELETE",
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

        <ProductsList
          filteredProducts={filteredProducts}
          loading={loading}
          stats={stats}
          keyword={keyword}
          statusFilter={statusFilter}
          onKeywordChange={setKeyword}
          onStatusFilterChange={setStatusFilter}
          onOpenCreate={openCreateModal}
          onEdit={openEditModal}
          onDelete={setDeleteTarget}
          onManageVersions={openVersionModal}
        />
      </div>

      {/* ============ 产品表单模态框 ============ */}
      {formOpen && (
        <ProductFormModal
          editingProduct={editingProduct}
          onClose={closeFormModal}
          onSaved={handleFormSaved}
        />
      )}

      {/* ============ 版本管理模态框 ============ */}
      {versionProduct && (
        <ProductDetail
          product={versionProduct}
          onClose={closeVersionModal}
          onVersionCountChange={handleVersionCountChange}
        />
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
    </AdminLayout>
  );
}
