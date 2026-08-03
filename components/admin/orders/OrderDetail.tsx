"use client";

import { centsToYuan } from "@/lib/admin-utils";
import {
  type Order,
  EDIT_STATUS_OPTIONS,
  PAY_METHOD_OPTIONS,
  getProjectTypeMeta,
} from "./types";

// ============ 编辑订单模态框 ============
export function OrderEditModal({
  editTarget,
  editForm,
  setEditForm,
  editSubmitting,
  onEdit,
  onClose,
}: {
  editTarget: Order;
  editForm: {
    status: string;
    payMethod: string;
    payTxId: string;
    remark: string;
  };
  setEditForm: React.Dispatch<
    React.SetStateAction<{
      status: string;
      payMethod: string;
      payTxId: string;
      remark: string;
    }>
  >;
  editSubmitting: boolean;
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
            <h3 className="text-lg font-bold text-gray-900">编辑订单</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="font-mono">{editTarget.orderNo}</span> · {editTarget.productName}
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
              <div className="font-medium text-gray-900">¥{centsToYuan(editTarget.amount)}</div>
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
            onClick={() => !editSubmitting && onClose()}
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
            {editSubmitting ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 标记已支付 - 确认模态框 ============
export function OrderPayConfirmModal({
  payConfirmTarget,
  paySubmitting,
  onConfirm,
  onClose,
}: {
  payConfirmTarget: Order;
  paySubmitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !paySubmitting && onClose()}
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
              <span className="text-gray-900 font-medium">¥{centsToYuan(payConfirmTarget.amount)}</span>
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
            onClick={() => !paySubmitting && onClose()}
            disabled={paySubmitting}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={paySubmitting}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {paySubmitting ? "处理中..." : "确认已收款"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 审核通过 - 确认模态框 ============
export function OrderApproveConfirmModal({
  approveConfirmTarget,
  approveSubmitting,
  onConfirm,
  onClose,
}: {
  approveConfirmTarget: Order;
  approveSubmitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !approveSubmitting && onClose()}
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
              <span className="text-gray-900 font-medium">¥{centsToYuan(approveConfirmTarget.amount)}</span>
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
            onClick={() => !approveSubmitting && onClose()}
            disabled={approveSubmitting}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={approveSubmitting}
            className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {approveSubmitting ? "处理中..." : "确认通过"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 收款成功 - 展示授权码 ============
export function OrderGeneratedLicenseModal({
  generatedLicense,
  onCopy,
  onClose,
}: {
  generatedLicense: {
    orderNo: string;
    productName: string;
    licenseKey: string;
  };
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
                onClick={() => onCopy(generatedLicense.licenseKey, "授权码")}
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

// ============ 删除订单 - 确认模态框 ============
export function OrderDeleteConfirmModal({
  deleteTarget,
  deleteSubmitting,
  onDelete,
  onClose,
}: {
  deleteTarget: Order;
  deleteSubmitting: boolean;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !deleteSubmitting && onClose()}
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-gray-900">确认删除订单</h3>
              <p className="text-sm text-gray-500 mt-1">
                删除后订单将永久移除，关联的授权码将被吊销。此操作不可撤销。
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="text-xs text-gray-400 mb-0.5">订单号</div>
            <div className="text-sm font-medium text-gray-700 font-mono">{deleteTarget.orderNo}</div>
            <div className="text-xs text-gray-400 mt-2 mb-0.5">产品</div>
            <div className="text-sm font-medium text-gray-700">{deleteTarget.productName}</div>
            {deleteTarget.licenseKey && (
              <>
                <div className="text-xs text-gray-400 mt-2 mb-0.5">关联授权码</div>
                <div className="text-sm font-mono text-gray-700">{deleteTarget.licenseKey}</div>
                <p className="text-xs text-red-500 mt-1">该授权码将被吊销</p>
              </>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={() => !deleteSubmitting && onClose()}
            disabled={deleteSubmitting}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onDelete}
            disabled={deleteSubmitting}
            className="px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleteSubmitting ? "删除中..." : "确认删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
