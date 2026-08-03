"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  ConfirmDialog,
  EmptyState,
  TableLoading,
  DataTable,
  IconButton,
  Icons,
} from "@/components/admin/ui";

interface Tool {
  id: string;
  name: string;
  category: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface CategoryItem {
  name: string;
  toolCount: number;
  onlineCount: number;
  sortOrder: number;
}

const STORAGE_KEY = "ethhy_tool_category_order";
const DEFAULT_CATEGORIES = ["开发工具", "AI工具", "效率工具"];

export default function ToolCategoriesPage() {
  const { token } = useAppStore();

  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [categoryOrders, setCategoryOrders] = useState<Record<string, number>>(
    {}
  );
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // 加载本地存储的自定义分类和排序
  useEffect(() => {
    try {
      const savedOrders = localStorage.getItem(STORAGE_KEY);
      if (savedOrders) {
        const parsed = JSON.parse(savedOrders) as Record<string, number>;
        setCategoryOrders(parsed);
      }
      const savedCustom = localStorage.getItem(`${STORAGE_KEY}_custom`);
      if (savedCustom) {
        setCustomCategories(JSON.parse(savedCustom));
      }
    } catch {
      // 忽略解析错误
    }
  }, []);

  const fetchTools = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminFetch("/api/tools");
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setTools(data);
    } catch {
      toast.error("获取工具列表失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchTools();
  }, [token, fetchTools]);

  // 从所有工具中提取不重复分类，合并默认分类与自定义分类
  const categories = useMemo<CategoryItem[]>(() => {
    const map = new Map<string, CategoryItem>();

    // 合并默认分类 + 工具中实际使用的分类 + 自定义分类
    const allNames = new Set<string>([
      ...DEFAULT_CATEGORIES,
      ...customCategories,
    ]);
    tools.forEach((t) => {
      if (t.category) allNames.add(t.category);
    });

    allNames.forEach((name) => {
      const matched = tools.filter((t) => t.category === name);
      map.set(name, {
        name,
        toolCount: matched.length,
        onlineCount: matched.filter((t) => t.isActive).length,
        sortOrder: categoryOrders[name] ?? 0,
      });
    });

    return Array.from(map.values()).sort(
      (a, b) => b.sortOrder - a.sortOrder || a.name.localeCompare(b.name)
    );
  }, [tools, customCategories, categoryOrders]);

  function persistOrders(orders: Record<string, number>) {
    setCategoryOrders(orders);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch {
      // 忽略写入错误
    }
  }

  function persistCustom(cats: string[]) {
    setCustomCategories(cats);
    try {
      localStorage.setItem(`${STORAGE_KEY}_custom`, JSON.stringify(cats));
    } catch {
      // 忽略写入错误
    }
  }

  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("请输入分类名称");
      return;
    }
    // 检查是否已存在
    const exists = categories.some((c) => c.name === name);
    if (exists) {
      toast.error("该分类已存在");
      return;
    }
    // 仅当不在默认列表中时，才记录为自定义分类
    if (!DEFAULT_CATEGORIES.includes(name)) {
      persistCustom([...customCategories, name]);
    }
    // 设置默认排序值为 0
    persistOrders({ ...categoryOrders, [name]: 0 });
    toast.success(`分类「${name}」已添加`);
    setNewCategoryName("");
  }

  function handleUpdateSort(name: string, value: number) {
    persistOrders({ ...categoryOrders, [name]: value });
  }

  function handleDeleteCategory() {
    if (!deleteTarget) return;
    const name = deleteTarget;
    // 检查是否有关联工具
    const count = tools.filter((t) => t.category === name).length;
    if (count > 0) {
      toast.error(`该分类下还有 ${count} 个工具，无法删除。请先修改这些工具的分类`);
      setDeleteTarget(null);
      return;
    }
    // 从自定义分类中移除
    if (customCategories.includes(name)) {
      persistCustom(customCategories.filter((c) => c !== name));
    }
    // 从排序记录中移除
    const newOrders = { ...categoryOrders };
    delete newOrders[name];
    persistOrders(newOrders);
    toast.success(`分类「${name}」已删除`);
    setDeleteTarget(null);
  }

  const deleteWarningCount = deleteTarget
    ? tools.filter((t) => t.category === deleteTarget).length
    : 0;

  return (
    <AdminLayout activeKey="tools-categories">
      <div className="space-y-6">
        {/* 页头 */}
        <PageHeader
          title="工具分类管理"
          subtitle="工具分类用于首页工具展示的筛选，管理可用的分类标签"
        />

        {/* 添加新分类表单 */}
        <Card>
          <CardHeader title="添加新分类" />
          <CardBody>
            <form onSubmit={handleAddCategory} className="flex gap-3">
              <Input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="输入分类名称，例如：设计工具"
                className="flex-1"
              />
              <Button type="submit">添加</Button>
            </form>
          </CardBody>
        </Card>

        {/* 分类列表表格 */}
        {loading ? (
          <Card>
            <DataTable headers={["分类名称", "工具数量", "排序", "操作"]}>
              <TableLoading cols={4} rows={3} />
            </DataTable>
          </Card>
        ) : categories.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icons.Tag className="w-12 h-12" />}
              title="暂无分类"
            />
          </Card>
        ) : (
          <Card>
            <DataTable headers={["分类名称", "工具数量", "排序", "操作"]}>
              {categories.map((cat) => (
                <tr
                  key={cat.name}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium">
                        {cat.name.charAt(0)}
                      </span>
                      <span className="font-medium text-gray-900">
                        {cat.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-700">{cat.toolCount} 个</div>
                    <div className="text-xs text-gray-400">
                      {cat.onlineCount} 个已上线
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={cat.sortOrder}
                      onChange={(e) =>
                        handleUpdateSort(
                          cat.name,
                          Number(e.target.value) || 0
                        )
                      }
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      title="数值越大越靠前"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <IconButton
                      icon={<Icons.Trash />}
                      onClick={() => setDeleteTarget(cat.name)}
                      title="删除分类"
                      variant="danger"
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          </Card>
        )}

        {/* 说明卡片 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex gap-2 text-sm text-blue-700">
            <span>💡</span>
            <div className="space-y-1">
              <p>
                工具分类是 <code className="px-1 py-0.5 bg-blue-100 rounded text-xs">Tool.category</code>{" "}
                字符串字段，不是独立的数据库表。
              </p>
              <p>
                此页面用于维护可选的分类标签列表及排序，分类数据保存在浏览器本地存储中。
              </p>
              <p>
                删除分类前，请先将该分类下的工具修改为其他分类。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除"
        message={
          deleteTarget
            ? deleteWarningCount > 0
              ? `确定要删除分类「${deleteTarget}」吗？该分类下还有 ${deleteWarningCount} 个工具，无法删除。`
              : `确定要删除分类「${deleteTarget}」吗？`
            : ""
        }
        danger
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}
