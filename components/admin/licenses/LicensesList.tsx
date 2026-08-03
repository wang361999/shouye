"use client";

import { Fragment } from "react";
import { formatDateTime, formatDate } from "@/lib/admin-utils";
import {
  type License,
  type LicenseLog,
  STATUS_FILTER_OPTIONS,
  RESULT_FILTER_OPTIONS,
  isExpired,
  getProjectTypeMeta,
  getStatusMeta,
  getResultMeta,
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

// ============ 渲染验证结果标签 ============
function renderResultTag(result: string) {
  const meta = getResultMeta(result);
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

// ============ 授权码列表（Tab1） ============
export function LicensesList({
  licenses,
  loading,
  statusFilter,
  keyword,
  onStatusFilterChange,
  onKeywordChange,
  onOpenCreate,
  expandedId,
  onToggleExpand,
  togglingId,
  onToggleStatus,
  onCopy,
  onOpenBinding,
  onOpenEdit,
  onDelete,
  onUnbindDomainFromRow,
}: {
  licenses: License[];
  loading: boolean;
  statusFilter: string;
  keyword: string;
  onStatusFilterChange: (v: string) => void;
  onKeywordChange: (v: string) => void;
  onOpenCreate: () => void;
  expandedId: string | null;
  onToggleExpand: (id: string | null) => void;
  togglingId: string | null;
  onToggleStatus: (license: License) => void;
  onCopy: (text: string, label?: string) => void;
  onOpenBinding: (license: License) => void;
  onOpenEdit: (license: License) => void;
  onDelete: (license: License) => void;
  onUnbindDomainFromRow: (licenseId: string, domain: string) => void;
}) {
  const hasFilter = statusFilter !== "all" || keyword;

  return (
    <>
      {/* 筛选栏 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* 状态筛选 */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* 搜索框 */}
          <div className="relative flex-1 min-w-[200px]">
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
              placeholder="搜索授权码 / 项目名 / 备注..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {/* 创建按钮 */}
          <button
            onClick={onOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建授权码
          </button>
        </div>
      </div>

      {/* 列表区域 */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="animate-pulse p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      ) : licenses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-3">📜</div>
          <p className="text-gray-500 mb-1">
            {hasFilter ? "没有符合条件的授权码" : "暂无授权码"}
          </p>
          <p className="text-sm text-gray-400 mb-4">
            创建一个授权码以开启项目授权验证
          </p>
          {hasFilter ? (
            <button
              onClick={() => {
                onStatusFilterChange("all");
                onKeywordChange("");
              }}
              className="text-sm text-blue-600 hover:text-blue-800 mr-3"
            >
              清空筛选条件
            </button>
          ) : null}
          <button
            onClick={onOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建第一个授权码
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">授权码</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">项目名称</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">关联产品</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">归属用户</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">套餐类型</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">域名配额</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">到期时间</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">状态</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {licenses.map((license) => {
                  const expanded = expandedId === license.id;
                  const expired = isExpired(license.expiresAt);
                  const quotaFull = license.boundDomains >= license.maxDomains;
                  return (
                    <Fragment key={license.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        {/* 授权码 */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <code
                              className="text-xs text-gray-700 font-mono max-w-[160px] truncate block"
                              title={license.licenseKey}
                            >
                              {license.licenseKey}
                            </code>
                            <button
                              onClick={() => onCopy(license.licenseKey, "授权码")}
                              title="复制授权码"
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        {/* 项目名称 */}
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate max-w-[160px]" title={license.projectName}>
                              {license.projectName}
                            </div>
                            {license.remark && (
                              <div className="text-xs text-gray-400 truncate max-w-[160px]" title={license.remark}>
                                {license.remark}
                              </div>
                            )}
                          </div>
                        </td>
                        {/* 关联产品 */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {license.product ? (
                            <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                              {license.product.icon && (
                                <span className="text-base leading-none">{license.product.icon}</span>
                              )}
                              <span className="truncate max-w-[120px]" title={license.product.name}>
                                {license.product.name}
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">未关联</span>
                          )}
                        </td>
                        {/* 归属用户 */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {license.owner ? (
                            <div className="min-w-0">
                              <div className="text-sm text-gray-700 truncate max-w-[120px]" title={license.owner.username}>
                                {license.owner.username}
                              </div>
                              {license.owner.email && (
                                <div className="text-xs text-gray-400 truncate max-w-[120px]" title={license.owner.email}>
                                  {license.owner.email}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">未分配</span>
                          )}
                        </td>
                        {/* 套餐类型 */}
                        <td className="px-4 py-3 whitespace-nowrap">{renderProjectType(license.projectType)}</td>
                        {/* 域名配额 */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={quotaFull ? "text-red-600 font-medium" : "text-gray-600"}>
                            {license.boundDomains}
                          </span>
                          <span className="text-gray-300"> / </span>
                          <span className="text-gray-600">{license.maxDomains}</span>
                        </td>
                        {/* 到期时间 */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={expired ? "text-red-600 font-medium" : "text-gray-600"}>
                            {formatDate(license.expiresAt)}
                          </span>
                          {expired && license.status === "active" && (
                            <span className="ml-1 text-xs text-red-500">已过期</span>
                          )}
                        </td>
                        {/* 状态 */}
                        <td className="px-4 py-3 whitespace-nowrap">{renderStatus(license.status)}</td>
                        {/* 操作 */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {/* 查看详情 */}
                            <button
                              onClick={() => onToggleExpand(expanded ? null : license.id)}
                              title={expanded ? "收起详情" : "查看详情"}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            {/* 绑定域名 */}
                            <button
                              onClick={() => onOpenBinding(license)}
                              title="绑定域名"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                            </button>
                            {/* 编辑 */}
                            <button
                              onClick={() => onOpenEdit(license)}
                              title="编辑"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {/* 停用/启用 */}
                            <button
                              onClick={() => onToggleStatus(license)}
                              disabled={togglingId === license.id || license.status === "expired" || license.status === "revoked"}
                              title={
                                license.status === "expired"
                                  ? "已过期，请在编辑中修改"
                                  : license.status === "revoked"
                                  ? "已吊销，请在编辑中修改"
                                  : license.status === "active"
                                  ? "停用"
                                  : "启用"
                              }
                              className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                license.status === "active"
                                  ? "text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100"
                                  : "text-green-700 bg-green-50 border-green-200 hover:bg-green-100"
                              }`}
                            >
                              {togglingId === license.id
                                ? "处理中..."
                                : license.status === "active"
                                ? "停用"
                                : "启用"}
                            </button>
                            {/* 删除 */}
                            <button
                              onClick={() => onDelete(license)}
                              title="删除"
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* 展开行：域名列表 */}
                      {expanded && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-gray-800">
                                  已绑定域名
                                  <span className="ml-2 text-xs font-normal text-gray-400">
                                    {license.domains.length} / {license.maxDomains}
                                  </span>
                                </h4>
                                <button
                                  onClick={() => onOpenBinding(license)}
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  管理域名
                                </button>
                              </div>
                              {license.domains.length === 0 ? (
                                <p className="text-sm text-gray-400 py-2">尚未绑定任何域名</p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {license.domains.map((d) => (
                                    <div
                                      key={d.domain}
                                      className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100"
                                    >
                                      <div className="min-w-0">
                                        <div className="text-sm text-gray-700 font-medium truncate" title={d.domain}>
                                          {d.domain}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                          激活: {formatDate(d.activatedAt)}
                                          {d.lastVerifiedAt && ` · 验证: ${formatDate(d.lastVerifiedAt)}`}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => onUnbindDomainFromRow(license.id, d.domain)}
                                        title="解绑域名"
                                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
                                <span>验证日志: {license.logCount} 条</span>
                                <span>创建时间: {formatDateTime(license.createdAt)}</span>
                                {license.owner && (
                                  <span>归属用户: {license.owner.username}{license.owner.email && ` (${license.owner.email})`}</span>
                                )}
                                {license.product && (
                                  <span>关联产品: {license.product.name}</span>
                                )}
                                {license.order && (
                                  <span>关联订单: {license.order.orderNo}</span>
                                )}
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
    </>
  );
}

// ============ 验证日志列表（Tab2） ============
export function LicenseLogsList({
  logs,
  loading,
  resultFilter,
  domainKeyword,
  onResultFilterChange,
  onDomainKeywordChange,
  logTotal,
  logPage,
  logTotalPages,
  onLogPageChange,
}: {
  logs: LicenseLog[];
  loading: boolean;
  resultFilter: string;
  domainKeyword: string;
  onResultFilterChange: (v: string) => void;
  onDomainKeywordChange: (v: string) => void;
  logTotal: number;
  logPage: number;
  logTotalPages: number;
  onLogPageChange: (page: number) => void;
}) {
  const hasFilter = resultFilter !== "all" || domainKeyword;

  return (
    <>
      {/* 筛选栏 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* 结果筛选 */}
          <select
            value={resultFilter}
            onChange={(e) => onResultFilterChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {RESULT_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* 域名搜索 */}
          <div className="relative flex-1 min-w-[200px]">
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
              value={domainKeyword}
              onChange={(e) => onDomainKeywordChange(e.target.value)}
              placeholder="搜索域名..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* 日志表格 */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="animate-pulse p-6 space-y-4">
            <div className="h-10 bg-gray-100 rounded" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-gray-500 mb-4">
            {hasFilter ? "没有符合条件的日志" : "暂无验证日志"}
          </p>
          {hasFilter && (
            <button
              onClick={() => {
                onResultFilterChange("all");
                onDomainKeywordChange("");
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
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">时间</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">授权码</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">域名</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">IP</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">验证结果</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">详情消息</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    {/* 时间 */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                    {/* 授权码 */}
                    <td className="px-4 py-3">
                      <code
                        className="text-xs text-gray-600 font-mono max-w-[150px] truncate block"
                        title={log.licenseKey}
                      >
                        {log.licenseKey}
                      </code>
                    </td>
                    {/* 域名 */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{log.domain}</td>
                    {/* IP */}
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                      {log.ip || <span className="text-gray-400">-</span>}
                    </td>
                    {/* 验证结果 */}
                    <td className="px-4 py-3 whitespace-nowrap">{renderResultTag(log.result)}</td>
                    {/* 详情消息 */}
                    <td className="px-4 py-3 text-gray-600 max-w-[280px]">
                      {log.message ? (
                        <span className="block truncate" title={log.message}>
                          {log.message}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 底部：总数 + 分页 */}
      {!loading && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-gray-500">
            共 <span className="font-medium text-gray-700">{logTotal}</span> 条日志
          </div>
          <Pagination
            currentPage={logPage}
            totalPages={logTotalPages}
            onPageChange={onLogPageChange}
          />
        </div>
      )}
    </>
  );
}
