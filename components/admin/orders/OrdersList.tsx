"use client";

import { Fragment } from "react";
import { formatDateTime, centsToYuan } from "@/lib/admin-utils";
import {
  type Order,
  STATUS_FILTER_OPTIONS,
  getStatusMeta,
  getProjectTypeMeta,
  getPayMethodMeta,
} from "./types";

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

// ============ 分页器组件 ============
export function Pagination({
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

// ============ 订单列表 ============
export function OrdersList({
  orders,
  loading,
  statusFilter,
  keyword,
  debouncedKeyword,
  total,
  currentPage,
  totalPages,
  expandedId,
  quickLoadingId,
  onStatusFilterChange,
  onKeywordChange,
  onClearFilters,
  onRefresh,
  onPageChange,
  onToggleExpand,
  onCopy,
  onOpenPayConfirm,
  onOpenApproveConfirm,
  onQuickReject,
  onQuickCancel,
  onQuickRefund,
  onOpenEdit,
  onDelete,
}: {
  orders: Order[];
  loading: boolean;
  statusFilter: string;
  keyword: string;
  debouncedKeyword: string;
  total: number;
  currentPage: number;
  totalPages: number;
  expandedId: string | null;
  quickLoadingId: string | null;
  onStatusFilterChange: (v: string) => void;
  onKeywordChange: (v: string) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
  onToggleExpand: (id: string | null) => void;
  onCopy: (text: string, label?: string) => void;
  onOpenPayConfirm: (order: Order) => void;
  onOpenApproveConfirm: (order: Order) => void;
  onQuickReject: (order: Order) => void;
  onQuickCancel: (order: Order) => void;
  onQuickRefund: (order: Order) => void;
  onOpenEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
}) {
  return (
    <>
      {/* 筛选栏 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* 状态筛选按钮组 */}
          <div className="inline-flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onStatusFilterChange(opt.value)}
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
              onChange={(e) => onKeywordChange(e.target.value)}
              placeholder="搜索订单号 / 产品名 / 用户名 / 邮箱 / 交易号..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {/* 刷新 */}
          <button
            onClick={onRefresh}
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
              onClick={onClearFilters}
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
                              onClick={() => onToggleExpand(expanded ? null : order.id)}
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
                          <span className="font-medium text-gray-900">¥{centsToYuan(order.amount)}</span>
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
                                onClick={() => onCopy(order.licenseKey!, "授权码")}
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
                                onClick={() => onOpenPayConfirm(order)}
                                disabled={busy}
                                className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                确认收款
                              </button>
                            )}
                            {/* 待支付：取消 */}
                            {order.status === "pending" && (
                              <button
                                onClick={() => onQuickCancel(order)}
                                disabled={busy}
                                className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {busy ? "处理中" : "取消"}
                              </button>
                            )}
                            {/* 待审核：审核通过 */}
                            {order.status === "paid" && (
                              <button
                                onClick={() => onOpenApproveConfirm(order)}
                                disabled={busy}
                                className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                审核通过
                              </button>
                            )}
                            {/* 待审核：拒绝 */}
                            {order.status === "paid" && (
                              <button
                                onClick={() => onQuickReject(order)}
                                disabled={busy}
                                className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {busy ? "处理中" : "拒绝"}
                              </button>
                            )}
                            {/* 已通过/待审核：退款 */}
                            {(order.status === "paid" || order.status === "approved") && (
                              <button
                                onClick={() => onQuickRefund(order)}
                                disabled={busy}
                                className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {busy ? "处理中" : "退款"}
                              </button>
                            )}
                            {/* 编辑（所有状态） */}
                            <button
                              onClick={() => onOpenEdit(order)}
                              title="编辑 / 备注"
                              className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              编辑
                            </button>
                            {/* 已取消/退款/拒绝：删除 */}
                            {["cancelled", "refunded", "rejected"].includes(order.status) && (
                              <button
                                onClick={() => onDelete(order)}
                                disabled={busy}
                                className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                删除
                              </button>
                            )}
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
            onPageChange={onPageChange}
          />
        </div>
      )}
    </>
  );
}
