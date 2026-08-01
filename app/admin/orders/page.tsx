"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

// ============ 类型定义 ============
interface Order {
  id: string;
  orderNo: string;
  userId: string;
  username: string | null;
  email: string | null;
  productId: string;
  productName: string;
  productSlug: string | null;
  projectType: string; // basic | standard | premium | enterprise
  maxDomains: number;
  amount: number; // 单位：分
  validDays: number;
  status: string; // pending | paid | refunded | cancelled
  payMethod: string | null; // alipay | wechat | manual
  payTxId: string | null;
  paidAt: string | null;
  licenseId: string | null;
  licenseKey: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OrderListResponse {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
}

// ============ 状态映射 ============
interface StatusMeta {
  label: string;
  color: string;
  dot: string;
}

const STATUS_MAP: Record<string, StatusMeta> = {
  pending: { label: "待支付", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  paid: { label: "待审核", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  approved: { label: "已通过", color: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  rejected: { label: "已拒绝", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  refunded: { label: "已退款", color: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  cancelled: { label: "已取消", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" },
};

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待支付" },
  { value: "paid", label: "待审核" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已拒绝" },
  { value: "refunded", label: "已退款" },
  { value: "cancelled", label: "已取消" },
];

const EDIT_STATUS_OPTIONS = [
  { value: "pending", label: "待支付 (pending)" },
  { value: "paid", label: "待审核 (paid)" },
  { value: "approved", label: "已通过 (approved)" },
  { value: "rejected", label: "已拒绝 (rejected)" },
  { value: "refunded", label: "已退款 (refunded)" },
  { value: "cancelled", label: "已取消 (cancelled)" },
];

// ============ 套餐类型映射 ============
interface ProjectTypeMeta {
  label: string;
  color: string;
}

const PROJECT_TYPE_MAP: Record<string, ProjectTypeMeta> = {
  basic: { label: "基础版", color: "bg-gray-100 text-gray-700 border-gray-200" },
  standard: { label: "标准版", color: "bg-blue-50 text-blue-700 border-blue-200" },
  premium: { label: "高级版", color: "bg-purple-50 text-purple-700 border-purple-200" },
  enterprise: { label: "企业版", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

// ============ 支付方式映射 ============
interface PayMethodMeta {
  label: string;
  color: string;
}

const PAY_METHOD_MAP: Record<string, PayMethodMeta> = {
  alipay: { label: "支付宝", color: "bg-blue-50 text-blue-700 border-blue-200" },
  wechat: { label: "微信支付", color: "bg-green-50 text-green-700 border-green-200" },
  manual: { label: "银行转账/手动", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

const PAY_METHOD_OPTIONS = [
  { value: "", label: "未指定" },
  { value: "alipay", label: "支付宝" },
  { value: "wechat", label: "微信支付" },
  { value: "manual", label: "银行转账/手动" },
];

const PAGE_SIZE = 20;

// ============ 工具函数 ============
function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatYuan(cents: number): string {
  if (cents == null || isNaN(cents)) return "0.00";
  return (cents / 100).toFixed(2);
}

function getStatusMeta(status: string): StatusMeta {
  return STATUS_MAP[status] || { label: status, color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" };
}

function getProjectTypeMeta(type: string): ProjectTypeMeta {
  return PROJECT_TYPE_MAP[type] || { label: type, color: "bg-gray-100 text-gray-700 border-gray-200" };
}

function getPayMethodMeta(method: string | null): PayMethodMeta | null {
  if (!method) return null;
  return PAY_METHOD_MAP[method] || { label: method, color: "bg-gray-100 text-gray-700 border-gray-200" };
}

// ============ 页面组件 ============
export default function OrdersPage() {
  const { token } = useAppStore();

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
    if (!token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedKeyword.trim()) params.set("keyword", debouncedKeyword.trim());

      const res = await fetch(`/api/admin/orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        toast.error("登录已过期，请重新登录");
        return;
      }
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
  }, [token, currentPage, statusFilter, debouncedKeyword]);

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
    if (!token) return { ok: false };
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
    if (!token || !editTarget) return;
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
    if (!token || !payConfirmTarget) return;
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
    if (!token || !approveConfirmTarget) return;
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
    if (!token) return;
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
    if (!token) return;
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
    if (!token) return;
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

  // ============ 渲染支付方式标签 ============
  function renderPayMethod(method: string | null) {
    const meta = getPayMethodMeta(method);
    if (!meta) return <span className="text-xs text-gray-400">-</span>;
    return (
      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${meta.color}`}>
        {meta.label}
      </span>
    );
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

        {/* 筛选栏 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* 状态筛选按钮组 */}
            <div className="inline-flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    statusFilter === opt.value
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* 搜索框 */}
            <div className="relative flex-1 min-w-[220px]">
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
                onChange={(e) => handleKeywordChange(e.target.value)}
                placeholder="搜索订单号 / 产品名 / 用户名 / 邮箱 / 交易号..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {/* 刷新 */}
            <button
              onClick={fetchOrders}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              刷新
            </button>
          </div>
        </div>

        {/* 列表区域 */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="animate-pulse p-6 space-y-4">
              <div className="h-10 bg-gray-100 rounded" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-3">🧾</div>
            <p className="text-gray-500 mb-1">
              {statusFilter !== "all" || debouncedKeyword
                ? "没有符合条件的订单"
                : "暂无订单"}
            </p>
            <p className="text-sm text-gray-400 mb-4">
              {statusFilter !== "all" || debouncedKeyword
                ? "尝试调整筛选条件或搜索关键词"
                : "用户下单后将显示在这里"}
            </p>
            {(statusFilter !== "all" || debouncedKeyword) && (
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setKeyword("");
                  setDebouncedKeyword("");
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
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">订单号</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">产品</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">用户</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">套餐 / 域名</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">金额</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">状态</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">支付方式</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">支付时间</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">授权码</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">创建时间</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => {
                    const expanded = expandedId === order.id;
                    const busy = quickLoadingId === order.id;
                    return (
                      <Fragment key={order.id}>
                        <tr className="hover:bg-gray-50 transition-colors">
                          {/* 订单号 */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setExpandedId(expanded ? null : order.id)}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title={expanded ? "收起详情" : "展开详情"}
                              >
                                <svg
                                  className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                              <code
                                className="text-xs text-gray-700 font-mono max-w-[150px] truncate block"
                                title={order.orderNo}
                              >
                                {order.orderNo}
                              </code>
                              {order.remark && (
                                <span title="有备注" className="text-amber-500" >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h10M7 16h6M3 4a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V4z" />
                                  </svg>
                                </span>
                              )}
                            </div>
                          </td>
                          {/* 产品 */}
                          <td className="px-4 py-3">
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 truncate max-w-[150px]" title={order.productName}>
                                {order.productName}
                              </div>
                              {order.productSlug && (
                                <div className="text-xs text-gray-400 truncate max-w-[150px]" title={order.productSlug}>
                                  /{order.productSlug}
                                </div>
                              )}
                            </div>
                          </td>
                          {/* 用户 */}
                          <td className="px-4 py-3">
                            <div className="min-w-0">
                              <div className="text-gray-900 truncate max-w-[140px]" title={order.username || ""}>
                                {order.username || (
                                  <span className="text-gray-400">未知用户</span>
                                )}
                              </div>
                              {order.email && (
                                <div className="text-xs text-gray-400 truncate max-w-[140px]" title={order.email}>
                                  {order.email}
                                </div>
                              )}
                            </div>
                          </td>
                          {/* 套餐 / 域名 */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              {renderProjectType(order.projectType)}
                              <span className="text-xs text-gray-500">{order.maxDomains} 域名 · {order.validDays} 天</span>
                            </div>
                          </td>
                          {/* 金额 */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-medium text-gray-900">¥{formatYuan(order.amount)}</span>
                          </td>
                          {/* 状态 */}
                          <td className="px-4 py-3 whitespace-nowrap">{renderStatus(order.status)}</td>
                          {/* 支付方式 */}
                          <td className="px-4 py-3 whitespace-nowrap">{renderPayMethod(order.payMethod)}</td>
                          {/* 支付时间 */}
                          <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                            {formatDateTime(order.paidAt)}
                          </td>
                          {/* 授权码 */}
                          <td className="px-4 py-3">
                            {order.licenseKey ? (
                              <div className="flex items-center gap-1">
                                <code
                                  className="text-xs text-gray-700 font-mono max-w-[140px] truncate block"
                                  title={order.licenseKey}
                                >
                                  {order.licenseKey}
                                </code>
                                <button
                                  onClick={() => handleCopy(order.licenseKey!, "授权码")}
                                  title="复制授权码"
                                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">未生成</span>
                            )}
                          </td>
                          {/* 创建时间 */}
                          <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                            {formatDateTime(order.createdAt)}
                          </td>
                          {/* 操作 */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 待支付：标记已支付 */}
                              {order.status === "pending" && (
                                <button
                                  onClick={() => openPayConfirm(order)}
                                  disabled={busy}
                                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  确认收款
                                </button>
                              )}
                              {/* 待支付：取消 */}
                              {order.status === "pending" && (
                                <button
                                  onClick={() => handleQuickCancel(order)}
                                  disabled={busy}
                                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {busy ? "处理中" : "取消"}
                                </button>
                              )}
                              {/* 待审核：审核通过 */}
                              {order.status === "paid" && (
                                <button
                                  onClick={() => openApproveConfirm(order)}
                                  disabled={busy}
                                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  审核通过
                                </button>
                              )}
                              {/* 待审核：拒绝 */}
                              {order.status === "paid" && (
                                <button
                                  onClick={() => handleQuickReject(order)}
                                  disabled={busy}
                                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {busy ? "处理中" : "拒绝"}
                                </button>
                              )}
                              {/* 已通过/待审核：退款 */}
                              {(order.status === "paid" || order.status === "approved") && (
                                <button
                                  onClick={() => handleQuickRefund(order)}
                                  disabled={busy}
                                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {busy ? "处理中" : "退款"}
                                </button>
                              )}
                              {/* 编辑（所有状态） */}
                              <button
                                onClick={() => openEditModal(order)}
                                title="编辑 / 备注"
                                className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                              >
                                编辑
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* 展开行：备注与交易号 */}
                        {expanded && (
                          <tr className="bg-gray-50/50">
                            <td colSpan={11} className="px-4 py-4">
                              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <div className="text-xs text-gray-400 mb-0.5">交易号</div>
                                    <div className="text-gray-700 font-mono break-all">
                                      {order.payTxId || <span className="text-gray-400">-</span>}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-400 mb-0.5">授权码 ID</div>
                                    <div className="text-gray-700 font-mono break-all">
                                      {order.licenseId || <span className="text-gray-400">未关联</span>}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-400 mb-0.5">用户 ID</div>
                                    <div className="text-gray-700 font-mono break-all">{order.userId}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-400 mb-0.5">更新时间</div>
                                    <div className="text-gray-700">{formatDateTime(order.updatedAt)}</div>
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-400 mb-0.5">备注</div>
                                  <div className="text-gray-700 whitespace-pre-wrap">
                                    {order.remark || <span className="text-gray-400">暂无备注</span>}
                                  </div>
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

        {/* 底部：总数 + 分页 */}
        {!loading && orders.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-gray-500">
              共 <span className="font-medium text-gray-700">{total}</span> 个订单
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* ============ 编辑订单模态框 ============ */}
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
                <h3 className="text-lg font-bold text-gray-900">编辑订单</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="font-mono">{editTarget.orderNo}</span> · {editTarget.productName}
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
              {/* 订单状态 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">订单状态</label>
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
                {editForm.status === "approved" && editTarget.status !== "approved" && !editTarget.licenseId && (
                  <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    审核通过后将自动生成授权码
                  </p>
                )}
              </div>

              {/* 支付方式 + 交易号 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">支付方式</label>
                  <select
                    value={editForm.payMethod}
                    onChange={(e) => setEditForm((p) => ({ ...p, payMethod: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {PAY_METHOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">交易号</label>
                  <input
                    type="text"
                    value={editForm.payTxId}
                    onChange={(e) => setEditForm((p) => ({ ...p, payTxId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="支付平台交易号"
                  />
                </div>
              </div>

              {/* 备注 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
                <textarea
                  value={editForm.remark}
                  onChange={(e) => setEditForm((p) => ({ ...p, remark: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="订单备注信息（可选）"
                />
              </div>

              {/* 订单摘要 */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                <div>
                  <div className="text-xs text-gray-400">金额</div>
                  <div className="font-medium text-gray-900">¥{formatYuan(editTarget.amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">套餐</div>
                  <div>{getProjectTypeMeta(editTarget.projectType).label}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">授权码</div>
                  <div className="text-xs text-gray-600 truncate" title={editTarget.licenseKey || ""}>
                    {editTarget.licenseKey ? editTarget.licenseKey : "未生成"}
                  </div>
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => !editSubmitting && setEditTarget(null)}
                disabled={editSubmitting}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={editSubmitting}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editSubmitting ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 标记已支付 - 确认模态框 ============ */}
      {payConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !paySubmitting && setPayConfirmTarget(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            {/* 头部 */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">确认收款</h3>
                  <p className="text-xs text-gray-500">
                    <span className="font-mono">{payConfirmTarget.orderNo}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 内容 */}
            <div className="px-6 py-5 space-y-4">
              {/* 审核提示 */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-blue-800">
                  确认收款后，订单将进入<span className="font-medium">待审核</span>状态。需管理员审核通过后才会生成授权码并发送给用户。
                </p>
              </div>

              {/* 订单摘要 */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">产品</span>
                  <span className="text-gray-900 font-medium">{payConfirmTarget.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">用户</span>
                  <span className="text-gray-900">{payConfirmTarget.username || "未知用户"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">金额</span>
                  <span className="text-gray-900 font-medium">¥{formatYuan(payConfirmTarget.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">套餐</span>
                  <span>{getProjectTypeMeta(payConfirmTarget.projectType).label}</span>
                </div>
              </div>
            </div>

            {/* 底部 */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => !paySubmitting && setPayConfirmTarget(null)}
                disabled={paySubmitting}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmPay}
                disabled={paySubmitting}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {paySubmitting ? "处理中..." : "确认已收款"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 审核通过 - 确认模态框 ============ */}
      {approveConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !approveSubmitting && setApproveConfirmTarget(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            {/* 头部 */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">审核通过</h3>
                  <p className="text-xs text-gray-500">
                    <span className="font-mono">{approveConfirmTarget.orderNo}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 内容 */}
            <div className="px-6 py-5 space-y-4">
              {/* 授权码生成提示 */}
              {!approveConfirmTarget.licenseId && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs text-amber-800">
                    审核通过后，系统将<span className="font-medium">自动生成授权码</span>（{approveConfirmTarget.maxDomains} 域名 · {approveConfirmTarget.validDays} 天有效期），并关联到该订单与用户。生成后将在弹窗中展示授权码。
                  </p>
                </div>
              )}
              {approveConfirmTarget.licenseId && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-blue-800">
                    该订单已关联授权码，审核通过后仅更新订单状态，不会重复生成授权码。
                  </p>
                </div>
              )}

              {/* 订单摘要 */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">产品</span>
                  <span className="text-gray-900 font-medium">{approveConfirmTarget.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">用户</span>
                  <span className="text-gray-900">{approveConfirmTarget.username || "未知用户"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">金额</span>
                  <span className="text-gray-900 font-medium">¥{formatYuan(approveConfirmTarget.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">套餐</span>
                  <span>{getProjectTypeMeta(approveConfirmTarget.projectType).label}</span>
                </div>
              </div>
            </div>

            {/* 底部 */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => !approveSubmitting && setApproveConfirmTarget(null)}
                disabled={approveSubmitting}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmApprove}
                disabled={approveSubmitting}
                className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {approveSubmitting ? "处理中..." : "确认通过"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 收款成功 - 展示授权码 ============ */}
      {generatedLicense && (
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
                  <h3 className="text-lg font-bold text-gray-900">收款成功，授权码已生成</h3>
                  <p className="text-xs text-gray-500">
                    {generatedLicense.productName}
                    {generatedLicense.orderNo && (
                      <> · <span className="font-mono">{generatedLicense.orderNo}</span></>
                    )}
                  </p>
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
                  请妥善保存以下授权码，并将其提供给客户用于项目授权验证。
                </p>
              </div>

              {/* 授权码 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">授权码</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 break-all">
                    {generatedLicense.licenseKey}
                  </code>
                  <button
                    onClick={() => handleCopy(generatedLicense.licenseKey, "授权码")}
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
                onClick={() => setGeneratedLicense(null)}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                我已保存
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
