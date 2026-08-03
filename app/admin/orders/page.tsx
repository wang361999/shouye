"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import toast from "react-hot-toast";
import { adminFetch } from "@/lib/admin-fetch";
import {
  type Order,
  type OrderListResponse,
  PAGE_SIZE,
} from "@/components/admin/orders/types";
import { OrdersList } from "@/components/admin/orders/OrdersList";
import {
  OrderEditModal,
  OrderPayConfirmModal,
  OrderApproveConfirmModal,
  OrderGeneratedLicenseModal,
  OrderDeleteConfirmModal,
} from "@/components/admin/orders/OrderDetail";

// ============ 页面组件 ============
export default function OrdersPage() {
  // 列表状态
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // 详情展开
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 编辑模态框
  const [editTarget, setEditTarget] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState({
    status: "pending",
    payMethod: "",
    payTxId: "",
    remark: "",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // 标记已支付确认
  const [payConfirmTarget, setPayConfirmTarget] = useState<Order | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);

  // 审核通过确认
  const [approveConfirmTarget, setApproveConfirmTarget] = useState<Order | null>(null);
  const [approveSubmitting, setApproveSubmitting] = useState(false);

  // 取消 / 退款 / 拒绝 快捷操作
  const [quickLoadingId, setQuickLoadingId] = useState<string | null>(null);

  // 删除订单确认
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // 授权码生成成功展示
  const [generatedLicense, setGeneratedLicense] = useState<{
    orderNo: string;
    productName: string;
    licenseKey: string;
  } | null>(null);

  // 关键词搜索防抖
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============ 获取订单列表 ============
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedKeyword.trim()) params.set("keyword", debouncedKeyword.trim());

      const res = await adminFetch(`/api/admin/orders?${params}`);
      if (!res.ok) throw new Error("获取失败");
      const data: OrderListResponse = await res.json();
      setOrders(Array.isArray(data.data) ? data.data : []);
      setTotal(data.total || 0);
      setTotalPages(
        data.pageSize ? Math.max(1, Math.ceil((data.total || 0) / data.pageSize)) : 1
      );
    } catch {
      toast.error("获取订单列表失败");
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, debouncedKeyword]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // 搜索防抖
  function handleKeywordChange(value: string) {
    setKeyword(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedKeyword(value.trim());
      setCurrentPage(1);
    }, 400);
  }

  // 清空筛选条件
  function handleClearFilters() {
    setStatusFilter("all");
    setKeyword("");
    setDebouncedKeyword("");
  }

  // 状态筛选变化回到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  // ============ 复制 ============
  async function handleCopy(text: string, label = "内容") {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label}已复制`);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  }

  // ============ 通用更新订单（PATCH） ============
  async function patchOrder(
    body: { id: string; status?: string; payMethod?: string; payTxId?: string; remark?: string },
    options: { successMsg?: string; expectLicense?: boolean; orderNo?: string; productName?: string } = {}
  ): Promise<{ ok: boolean; licenseKey?: string }> {
    try {
      const res = await adminFetch("/api/admin/orders", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "操作失败");
        return { ok: false };
      }
      if (options.successMsg) toast.success(options.successMsg);
      if (options.expectLicense && data.licenseKey) {
        setGeneratedLicense({
          orderNo: options.orderNo || "",
          productName: options.productName || "",
          licenseKey: data.licenseKey,
        });
      }
      return { ok: true, licenseKey: data.licenseKey };
    } catch {
      toast.error("操作失败，请稍后重试");
      return { ok: false };
    }
  }

  // ============ 打开编辑模态框 ============
  function openEditModal(order: Order) {
    setEditTarget(order);
    setEditForm({
      status: order.status,
      payMethod: order.payMethod || "",
      payTxId: order.payTxId || "",
      remark: order.remark || "",
    });
  }

  // ============ 提交编辑 ============
  async function handleEditSubmit() {
    if (!editTarget) return;
    try {
      setEditSubmitting(true);
      const wasApproved = editTarget.status === "approved";
      const willApprove = editForm.status === "approved" && !wasApproved;

      const result = await patchOrder(
        {
          id: editTarget.id,
          status: editForm.status,
          payMethod: editForm.payMethod,
          payTxId: editForm.payTxId.trim(),
          remark: editForm.remark.trim(),
        },
        {
          successMsg: "订单已更新",
          expectLicense: willApprove,
          orderNo: editTarget.orderNo,
          productName: editTarget.productName,
        }
      );

      if (result.ok) {
        setEditTarget(null);
        fetchOrders();
      }
    } finally {
      setEditSubmitting(false);
    }
  }

  // ============ 标记已支付：确认 ============
  function openPayConfirm(order: Order) {
    setPayConfirmTarget(order);
  }

  async function handleConfirmPay() {
    if (!payConfirmTarget) return;
    try {
      setPaySubmitting(true);
      const result = await patchOrder(
        { id: payConfirmTarget.id, status: "paid" },
        {
          successMsg: "已确认收款，等待审核",
        }
      );
      if (result.ok) {
        setPayConfirmTarget(null);
        fetchOrders();
      }
    } finally {
      setPaySubmitting(false);
    }
  }

  // ============ 审核通过：确认 ============
  function openApproveConfirm(order: Order) {
    setApproveConfirmTarget(order);
  }

  async function handleConfirmApprove() {
    if (!approveConfirmTarget) return;
    try {
      setApproveSubmitting(true);
      const result = await patchOrder(
        { id: approveConfirmTarget.id, status: "approved" },
        {
          successMsg: "审核已通过",
          expectLicense: !approveConfirmTarget.licenseId,
          orderNo: approveConfirmTarget.orderNo,
          productName: approveConfirmTarget.productName,
        }
      );
      if (result.ok) {
        setApproveConfirmTarget(null);
        fetchOrders();
      }
    } finally {
      setApproveSubmitting(false);
    }
  }

  // ============ 拒绝订单（快捷） ============
  async function handleQuickReject(order: Order) {
    try {
      setQuickLoadingId(order.id);
      const result = await patchOrder(
        { id: order.id, status: "rejected" },
        { successMsg: "订单已拒绝" }
      );
      if (result.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, status: "rejected" } : o))
        );
      }
    } finally {
      setQuickLoadingId(null);
    }
  }

  // ============ 取消订单（快捷） ============
  async function handleQuickCancel(order: Order) {
    try {
      setQuickLoadingId(order.id);
      const result = await patchOrder(
        { id: order.id, status: "cancelled" },
        { successMsg: "订单已取消" }
      );
      if (result.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, status: "cancelled" } : o))
        );
      }
    } finally {
      setQuickLoadingId(null);
    }
  }

  // ============ 退款（快捷） ============
  async function handleQuickRefund(order: Order) {
    try {
      setQuickLoadingId(order.id);
      const result = await patchOrder(
        { id: order.id, status: "refunded" },
        { successMsg: "订单已退款" }
      );
      if (result.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, status: "refunded" } : o))
        );
      }
    } finally {
      setQuickLoadingId(null);
    }
  }

  // ============ 删除订单 ============
  async function handleDeleteOrder() {
    if (!deleteTarget) return;
    try {
      setDeleteSubmitting(true);
      const res = await adminFetch(`/api/admin/orders?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "删除失败");
        return;
      }
      toast.success("订单已删除");
      setDeleteTarget(null);
      fetchOrders();
    } catch {
      toast.error("删除失败，请稍后重试");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <AdminLayout activeKey="orders">
      <div className="space-y-6">
        {/* 页头 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 订单管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            管理产品订单、确认收款、生成授权码及退款处理
          </p>
        </div>

        <OrdersList
          orders={orders}
          loading={loading}
          statusFilter={statusFilter}
          keyword={keyword}
          debouncedKeyword={debouncedKeyword}
          total={total}
          currentPage={currentPage}
          totalPages={totalPages}
          expandedId={expandedId}
          quickLoadingId={quickLoadingId}
          onStatusFilterChange={setStatusFilter}
          onKeywordChange={handleKeywordChange}
          onClearFilters={handleClearFilters}
          onRefresh={fetchOrders}
          onPageChange={setCurrentPage}
          onToggleExpand={setExpandedId}
          onCopy={handleCopy}
          onOpenPayConfirm={openPayConfirm}
          onOpenApproveConfirm={openApproveConfirm}
          onQuickReject={handleQuickReject}
          onQuickCancel={handleQuickCancel}
          onQuickRefund={handleQuickRefund}
          onOpenEdit={openEditModal}
          onDelete={setDeleteTarget}
        />
      </div>

      {/* ============ 编辑订单模态框 ============ */}
      {editTarget && (
        <OrderEditModal
          editTarget={editTarget}
          editForm={editForm}
          setEditForm={setEditForm}
          editSubmitting={editSubmitting}
          onEdit={handleEditSubmit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* ============ 标记已支付 - 确认模态框 ============ */}
      {payConfirmTarget && (
        <OrderPayConfirmModal
          payConfirmTarget={payConfirmTarget}
          paySubmitting={paySubmitting}
          onConfirm={handleConfirmPay}
          onClose={() => setPayConfirmTarget(null)}
        />
      )}

      {/* ============ 审核通过 - 确认模态框 ============ */}
      {approveConfirmTarget && (
        <OrderApproveConfirmModal
          approveConfirmTarget={approveConfirmTarget}
          approveSubmitting={approveSubmitting}
          onConfirm={handleConfirmApprove}
          onClose={() => setApproveConfirmTarget(null)}
        />
      )}

      {/* ============ 收款成功 - 展示授权码 ============ */}
      {generatedLicense && (
        <OrderGeneratedLicenseModal
          generatedLicense={generatedLicense}
          onCopy={handleCopy}
          onClose={() => setGeneratedLicense(null)}
        />
      )}

      {/* ============ 删除订单 - 确认模态框 ============ */}
      {deleteTarget && (
        <OrderDeleteConfirmModal
          deleteTarget={deleteTarget}
          deleteSubmitting={deleteSubmitting}
          onDelete={handleDeleteOrder}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </AdminLayout>
  );
}
