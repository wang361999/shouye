"use client";

import { formatDate } from "@/lib/admin-utils";
import {
  type License,
  type ProductOption,
  PROJECT_TYPE_OPTIONS,
  EDIT_STATUS_OPTIONS,
  isExpired,
  getProjectTypeMeta,
} from "./types";

// ============ 创建授权码模态框 ============
export function LicenseCreateModal({
  createForm,
  setCreateForm,
  submitting,
  products,
  onClose,
  onCreate,
}: {
  createForm: {
    projectName: string;
    projectType: string;
    validDays: number;
    maxDomains: number;
    remark: string;
    ownerUsername: string;
    productId: string;
  };
  setCreateForm: React.Dispatch<
    React.SetStateAction<{
      projectName: string;
      projectType: string;
      validDays: number;
      maxDomains: number;
      remark: string;
      ownerUsername: string;
      productId: string;
    }>
  >;
  submitting: boolean;
  products: ProductOption[];
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">创建授权码</h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 表单 */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          {/* 项目名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              项目名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={createForm.projectName}
              onChange={(e) => setCreateForm((p) => ({ ...p, projectName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="如：企业官网"
            />
          </div>

          {/* 关联产品 + 归属用户 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 关联产品 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">关联产品</label>
              <select
                value={createForm.productId}
                onChange={(e) => setCreateForm((p) => ({ ...p, productId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">不关联产品</option>
                {products.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.icon ? `${prod.icon} ` : ""}{prod.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-400">可选，将此授权码关联到某个产品</p>
            </div>
            {/* 归属用户 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">归属用户</label>
              <input
                type="text"
                value={createForm.ownerUsername}
                onChange={(e) => setCreateForm((p) => ({ ...p, ownerUsername: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="用户名（可选）"
              />
              <p className="mt-1.5 text-xs text-gray-400">填写用户名以分配给对应用户</p>
            </div>
          </div>

          {/* 套餐类型 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">套餐类型</label>
            <select
              value={createForm.projectType}
              onChange={(e) => {
                const meta = getProjectTypeMeta(e.target.value);
                setCreateForm((p) => ({ ...p, projectType: e.target.value, maxDomains: meta.defaultDomains }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {PROJECT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-gray-400">选择套餐后将自动填充对应域名配额，可手动修改</p>
          </div>

          {/* 有效期天数 + 最大域名数 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">有效期天数</label>
              <input
                type="number"
                min={1}
                value={createForm.validDays}
                onChange={(e) => setCreateForm((p) => ({ ...p, validDays: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="365"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">最大域名数</label>
              <input
                type="number"
                min={1}
                value={createForm.maxDomains}
                onChange={(e) => setCreateForm((p) => ({ ...p, maxDomains: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
            <textarea
              value={createForm.remark}
              onChange={(e) => setCreateForm((p) => ({ ...p, remark: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="客户信息或用途说明（可选）"
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onCreate}
            disabled={submitting}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "创建中..." : "创建授权码"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 创建成功 - 展示授权码 ============
export function LicenseCreatedSuccessModal({
  createdLicense,
  onCopy,
  onClose,
}: {
  createdLicense: { licenseKey: string; projectName: string };
  onCopy: (text: string, label?: string) => void;
  onClose: () => void;
}) {
  return (
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
              <h3 className="text-lg font-bold text-gray-900">授权码创建成功</h3>
              <p className="text-xs text-gray-500">{createdLicense.projectName}</p>
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
              请妥善保存以下授权码，将其提供给客户用于项目授权验证。
            </p>
          </div>

          {/* 授权码 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">授权码</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 break-all">
                {createdLicense.licenseKey}
              </code>
              <button
                onClick={() => onCopy(createdLicense.licenseKey, "授权码")}
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
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            我已保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 绑定域名模态框 ============
export function LicenseBindingModal({
  bindingLicense,
  bindDomainInput,
  setBindDomainInput,
  binding,
  unbindingDomain,
  onBindDomain,
  onUnbindDomain,
  onClose,
}: {
  bindingLicense: License;
  bindDomainInput: string;
  setBindDomainInput: React.Dispatch<React.SetStateAction<string>>;
  binding: boolean;
  unbindingDomain: string | null;
  onBindDomain: () => void;
  onUnbindDomain: (domain: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !binding && !unbindingDomain && onClose()}
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900">绑定域名</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {bindingLicense.projectName} ·{" "}
              <span className="font-mono">{bindingLicense.licenseKey}</span>
            </p>
          </div>
          <button
            onClick={() => !binding && !unbindingDomain && onClose()}
            disabled={binding || !!unbindingDomain}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* 配额提示 */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">域名配额</span>
            <span className={bindingLicense.boundDomains >= bindingLicense.maxDomains ? "text-red-600 font-medium" : "text-gray-700"}>
              {bindingLicense.boundDomains} / {bindingLicense.maxDomains}
            </span>
          </div>

          {/* 绑定新域名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">绑定新域名</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={bindDomainInput}
                onChange={(e) => setBindDomainInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onBindDomain();
                }}
                disabled={bindingLicense.boundDomains >= bindingLicense.maxDomains}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                placeholder="example.com"
              />
              <button
                onClick={onBindDomain}
                disabled={binding || bindingLicense.boundDomains >= bindingLicense.maxDomains}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {binding ? "绑定中..." : "绑定"}
              </button>
            </div>
            {bindingLicense.boundDomains >= bindingLicense.maxDomains && (
              <p className="mt-1.5 text-xs text-red-500">已达到最大绑定域名数，请先解绑或升级套餐</p>
            )}
            <p className="mt-1.5 text-xs text-gray-400">无需填写协议与端口，如 https://example.com:8080 会自动标准化为 example.com</p>
          </div>

          {/* 已绑定域名列表 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              已绑定域名（{bindingLicense.domains.length}）
            </label>
            {bindingLicense.domains.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                尚未绑定任何域名
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {bindingLicense.domains.map((d) => (
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
                      onClick={() => onUnbindDomain(d.domain)}
                      disabled={!!unbindingDomain}
                      title="解绑域名"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0 disabled:opacity-50"
                    >
                      {unbindingDomain === d.domain ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={binding || !!unbindingDomain}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 编辑模态框 ============
export function LicenseEditModal({
  editTarget,
  editForm,
  setEditForm,
  editSubmitting,
  products,
  onEdit,
  onClose,
}: {
  editTarget: License;
  editForm: {
    remark: string;
    expiresAt: string;
    maxDomains: number;
    status: string;
    ownerUsername: string;
    productId: string;
  };
  setEditForm: React.Dispatch<
    React.SetStateAction<{
      remark: string;
      expiresAt: string;
      maxDomains: number;
      status: string;
      ownerUsername: string;
      productId: string;
    }>
  >;
  editSubmitting: boolean;
  products: ProductOption[];
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !editSubmitting && onClose()}
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900">编辑授权码</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {editTarget.projectName} ·{" "}
              <span className="font-mono">{editTarget.licenseKey}</span>
            </p>
          </div>
          <button
            onClick={() => !editSubmitting && onClose()}
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
          {/* 关联产品 + 归属用户 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 关联产品 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">关联产品</label>
              <select
                value={editForm.productId}
                onChange={(e) => setEditForm((p) => ({ ...p, productId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">不关联产品</option>
                {products.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.icon ? `${prod.icon} ` : ""}{prod.name}
                  </option>
                ))}
              </select>
            </div>
            {/* 归属用户 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">归属用户</label>
              <input
                type="text"
                value={editForm.ownerUsername}
                onChange={(e) => setEditForm((p) => ({ ...p, ownerUsername: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="用户名（留空取消分配）"
              />
            </div>
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
            <textarea
              value={editForm.remark}
              onChange={(e) => setEditForm((p) => ({ ...p, remark: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="客户信息或用途说明（可选）"
            />
          </div>

          {/* 到期时间 + 最大域名数 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">到期时间</label>
              <input
                type="date"
                value={editForm.expiresAt}
                onChange={(e) => setEditForm((p) => ({ ...p, expiresAt: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">最大域名数</label>
              <input
                type="number"
                min={1}
                value={editForm.maxDomains}
                onChange={(e) => setEditForm((p) => ({ ...p, maxDomains: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 状态 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">状态</label>
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
            {editForm.status === "active" && editForm.expiresAt && isExpired(editForm.expiresAt) && (
              <p className="mt-1.5 text-xs text-red-500">到期时间已早于今天，保存后将显示为「过期」</p>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={editSubmitting}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onEdit}
            disabled={editSubmitting}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editSubmitting ? "保存中..." : "保存修改"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 删除确认模态框 ============
export function LicenseDeleteConfirmModal({
  deleteTarget,
  deleting,
  onDelete,
  onClose,
}: {
  deleteTarget: License;
  deleting: boolean;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !deleting && onClose()}
      />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900">确认删除</h3>
        </div>
        <p className="text-gray-500 text-sm mb-1">
          确定要删除授权码「
          <span className="font-medium text-gray-700">{deleteTarget.projectName}</span>
          」吗？
        </p>
        <p className="text-xs text-gray-400 font-mono mb-1 break-all">{deleteTarget.licenseKey}</p>
        <p className="text-xs text-red-500 mb-6">
          此操作不可撤销，将同时清除该授权码关联的所有域名绑定与验证日志。
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {deleting ? "删除中..." : "确认删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
