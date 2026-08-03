"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import toast from "react-hot-toast";
import { adminFetch } from "@/lib/admin-fetch";
import { ProductsList } from "@/components/admin/products/ProductsList";
import { ProductFormModal } from "@/components/admin/products/ProductFormModal";
import { ProductDetail } from "@/components/admin/products/ProductDetail";
import { type Product } from "@/components/admin/products/types";
import { PageHeader, Button, ConfirmDialog, Icons } from "@/components/admin/ui";

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
        <PageHeader
          title="产品管理"
          subtitle="管理数字产品、定价、版本与下载发布"
          actions={
            <Button onClick={openCreateModal}>
              <Icons.Plus className="w-4 h-4 mr-1" />
              新建产品
            </Button>
          }
        />

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
      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除产品"
        message={
          deleteTarget
            ? `确定要删除产品「${deleteTarget.name}」吗？此操作不可撤销，将同时删除该产品下的所有版本与订单，关联授权码将被解除绑定。`
            : ""
        }
        confirmText="确认删除"
        cancelText="取消"
        danger
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}
