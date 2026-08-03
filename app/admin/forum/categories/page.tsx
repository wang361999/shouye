"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { adminFetch } from "@/lib/admin-fetch";
import toast from "react-hot-toast";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  DataTable,
  IconButton,
  Modal,
  ConfirmDialog,
  FormField,
  Input,
  EmptyState,
  TableLoading,
  Icons,
} from "@/components/admin/ui";

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
      const res = await adminFetch("/api/forum/categories", {
        method: "POST",
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
      const res = await adminFetch("/api/forum/categories", {
        method: "PUT",
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
    if (!deleteTarget || deleting) return;
    if (deleteTarget.postCount > 0) {
      toast.error("该分类下还有帖子，无法删除");
      return;
    }
    try {
      setDeleting(true);
      const res = await adminFetch(`/api/forum/categories?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "删除失败");
        return;
      }
      toast.success("分类已删除");
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      toast.error("删除分类失败");
    } finally {
      setDeleting(false);
    }
  }

  // 删除确认消息
  const deleteMessage = deleteTarget
    ? `确定要删除分类「${deleteTarget.name}」吗？${
        deleteTarget.postCount > 0
          ? `该分类下还有 ${deleteTarget.postCount} 篇帖子，无法删除。请先移除或修改这些帖子的分类。`
          : ""
      }`
    : "";

  return (
    <AdminLayout activeKey="forum-categories">
      <div className="space-y-6">
        {/* 页头 */}
        <PageHeader title="论坛分类管理" />

        {/* 添加分类表单 */}
        <Card>
          <CardHeader title="添加新分类" />
          <CardBody>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="分类名称 *">
                  <Input
                    type="text"
                    value={addForm.name}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="例如：技术分享"
                  />
                </FormField>
                <FormField label="Slug *">
                  <Input
                    type="text"
                    value={addForm.slug}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, slug: e.target.value }))
                    }
                    placeholder="例如：tech-share"
                  />
                </FormField>
                <FormField label="图标">
                  <Input
                    type="text"
                    value={addForm.icon}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, icon: e.target.value }))
                    }
                    placeholder="例如：📖"
                  />
                </FormField>
                <FormField label="排序值">
                  <Input
                    type="number"
                    value={addForm.sortOrder}
                    onChange={(e) =>
                      setAddForm((prev) => ({
                        ...prev,
                        sortOrder: Number(e.target.value) || 0,
                      }))
                    }
                    placeholder="0"
                  />
                </FormField>
              </div>
              <FormField label="分类描述">
                <Input
                  type="text"
                  value={addForm.desc}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, desc: e.target.value }))
                  }
                  placeholder="分类描述（可选）"
                />
              </FormField>
              <div className="flex justify-end">
                <Button type="submit" loading={submitting}>
                  添加分类
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        {/* 分类列表表格 */}
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            现有分类 ({categories.length})
          </h2>
          {loading ? (
            <Card>
              <DataTable headers={["分类名称", "图标", "描述", "帖子数", "排序", "操作"]}>
                <TableLoading cols={6} rows={3} />
              </DataTable>
            </Card>
          ) : categories.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Icons.Tag className="w-12 h-12" />}
                title="暂无分类"
                description="请使用上方表单添加"
              />
            </Card>
          ) : (
            <Card>
              <DataTable headers={["分类名称", "图标", "描述", "帖子数", "排序", "操作"]}>
                {categories.map((cat) => (
                  <tr
                    key={cat.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{cat.name}</div>
                      <div className="text-xs text-gray-400">/{cat.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-xl">{cat.icon || "-"}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px]">
                      <span className="line-clamp-1">{cat.desc || "-"}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{cat.postCount}</td>
                    <td className="px-4 py-3 text-gray-600">{cat.sortOrder}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          icon={<Icons.Edit />}
                          onClick={() => openEditModal(cat)}
                          title="编辑分类"
                        />
                        <IconButton
                          icon={<Icons.Trash />}
                          onClick={() => setDeleteTarget(cat)}
                          title="删除分类"
                          variant="danger"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </Card>
          )}
        </div>
      </div>

      {/* 编辑分类模态框 */}
      <Modal
        open={!!editingCategory}
        onClose={() => {
          if (!submitting) setEditingCategory(null);
        }}
        title="编辑分类"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <FormField label="分类名称 *">
            <Input
              type="text"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Slug *">
            <Input
              type="text"
              value={editForm.slug}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, slug: e.target.value }))
              }
            />
          </FormField>
          <FormField label="图标">
            <Input
              type="text"
              value={editForm.icon}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, icon: e.target.value }))
              }
              placeholder="例如：📖"
            />
          </FormField>
          <FormField label="分类描述">
            <Input
              type="text"
              value={editForm.desc}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, desc: e.target.value }))
              }
              placeholder="分类描述（可选）"
            />
          </FormField>
          <FormField label="排序值">
            <Input
              type="number"
              value={editForm.sortOrder}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  sortOrder: Number(e.target.value) || 0,
                }))
              }
            />
          </FormField>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setEditingCategory(null)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button type="submit" loading={submitting}>
              保存修改
            </Button>
          </div>
        </form>
      </Modal>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除"
        message={deleteMessage}
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        danger
      />
    </AdminLayout>
  );
}
