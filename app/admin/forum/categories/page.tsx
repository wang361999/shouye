"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  desc: string | null;
  sortOrder: number;
  postCount: number;
}

interface CategoryFormData {
  name: string;
  slug: string;
  icon: string;
  desc: string;
  sortOrder: number;
}

const EMPTY_FORM: CategoryFormData = {
  name: "",
  slug: "",
  icon: "",
  desc: "",
  sortOrder: 0,
};

export default function ForumCategoriesPage() {
  const { token } = useAppStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 添加表单
  const [addForm, setAddForm] = useState<CategoryFormData>(EMPTY_FORM);

  // 编辑模态框
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState<CategoryFormData>(EMPTY_FORM);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/forum/categories");
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setCategories(data);
    } catch {
      toast.error("获取分类列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ===== 添加分类 =====
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.slug.trim()) {
      toast.error("分类名称和 slug 不能为空");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/forum/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: addForm.name.trim(),
          slug: addForm.slug.trim(),
          icon: addForm.icon.trim() || undefined,
          desc: addForm.desc.trim() || undefined,
          sortOrder: addForm.sortOrder,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "创建失败");
        return;
      }
      toast.success("分类创建成功");
      setCategories((prev) => [...prev, { ...data, postCount: 0 }]);
      setAddForm(EMPTY_FORM);
    } catch {
      toast.error("创建分类失败");
    } finally {
      setSubmitting(false);
    }
  }

  // ===== 编辑分类 =====
  function openEditModal(cat: Category) {
    setEditingCategory(cat);
    setEditForm({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon || "",
      desc: cat.desc || "",
      sortOrder: cat.sortOrder,
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCategory) return;
    if (!editForm.name.trim() || !editForm.slug.trim()) {
      toast.error("分类名称和 slug 不能为空");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/forum/categories", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: editingCategory.id,
          name: editForm.name.trim(),
          slug: editForm.slug.trim(),
          icon: editForm.icon.trim() || null,
          desc: editForm.desc.trim() || null,
          sortOrder: editForm.sortOrder,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "更新失败");
        return;
      }
      toast.success("分类更新成功");
      setEditingCategory(null);
      // 重新获取分类列表以同步 postCount
      fetchCategories();
    } catch {
      toast.error("更新分类失败");
    } finally {
      setSubmitting(false);
    }
  }

  // ===== 删除分类 =====
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/forum/categories?id=${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "删除失败");
        return;
      }
      toast.success("分类已删除");
      setCategories((prev) =>
        prev.filter((c) => c.id !== deleteTarget.id)
      );
      setDeleteTarget(null);
    } catch {
      toast.error("删除分类失败");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminLayout activeKey="forum-categories">
      <div className="space-y-6">
        {/* 页头 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900">📂 论坛分类管理</h1>
        </div>

        {/* 添加分类表单 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            ➕ 添加新分类
          </h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  分类名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="例如：技术分享"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.slug}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder="例如：tech-share"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  图标
                </label>
                <input
                  type="text"
                  value={addForm.icon}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, icon: e.target.value }))
                  }
                  placeholder="例如：📖"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  排序值
                </label>
                <input
                  type="number"
                  value={addForm.sortOrder}
                  onChange={(e) =>
                    setAddForm((prev) => ({
                      ...prev,
                      sortOrder: Number(e.target.value) || 0,
                    }))
                  }
                  placeholder="0"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                分类描述
              </label>
              <input
                type="text"
                value={addForm.desc}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, desc: e.target.value }))
                }
                placeholder="分类描述（可选）"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "添加中..." : "添加分类"}
              </button>
            </div>
          </form>
        </div>

        {/* 分类列表表格 */}
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            现有分类 ({categories.length})
          </h2>
          {loading ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="animate-pulse p-6 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded" />
                ))}
              </div>
            </div>
          ) : categories.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-gray-500">暂无分类，请使用上方表单添加</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                        分类名称
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                        图标
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                        描述
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                        帖子数
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                        排序
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {categories.map((cat) => (
                      <tr
                        key={cat.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {cat.name}
                          </div>
                          <div className="text-xs text-gray-400">
                            /{cat.slug}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xl">
                          {cat.icon || "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-[200px]">
                          <span className="line-clamp-1">
                            {cat.desc || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {cat.postCount}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {cat.sortOrder}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditModal(cat)}
                              title="编辑分类"
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => setDeleteTarget(cat)}
                              title="删除分类"
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 编辑分类模态框 */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !submitting && setEditingCategory(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">编辑分类</h3>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  分类名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.slug}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  图标
                </label>
                <input
                  type="text"
                  value={editForm.icon}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, icon: e.target.value }))
                  }
                  placeholder="例如：📖"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  分类描述
                </label>
                <input
                  type="text"
                  value={editForm.desc}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, desc: e.target.value }))
                  }
                  placeholder="分类描述（可选）"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  排序值
                </label>
                <input
                  type="number"
                  value={editForm.sortOrder}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      sortOrder: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  disabled={submitting}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "保存中..." : "保存修改"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">确认删除</h3>
            <p className="text-gray-500 text-sm mb-6">
              确定要删除分类「{deleteTarget.name}」吗？
              {deleteTarget.postCount > 0 && (
                <span className="text-red-500 block mt-2">
                  该分类下还有 {deleteTarget.postCount} 篇帖子，无法删除。请先移除或修改这些帖子的分类。
                </span>
              )}
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
                disabled={deleting || deleteTarget.postCount > 0}
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
