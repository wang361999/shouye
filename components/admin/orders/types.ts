/**
 * 订单管理模块共享类型、常量与辅助函数
 */
import type { StatusMeta } from "@/lib/admin-utils";

// ============ 类型定义 ============
export interface Order {
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

export interface OrderListResponse {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
}

// ============ 状态映射 ============
export const STATUS_MAP: Record<string, StatusMeta> = {
  pending: { label: "待支付", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  paid: { label: "待审核", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  approved: { label: "已通过", color: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  rejected: { label: "已拒绝", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  refunded: { label: "已退款", color: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  cancelled: { label: "已取消", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" },
};

export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待支付" },
  { value: "paid", label: "待审核" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已拒绝" },
  { value: "refunded", label: "已退款" },
  { value: "cancelled", label: "已取消" },
];

export const EDIT_STATUS_OPTIONS = [
  { value: "pending", label: "待支付 (pending)" },
  { value: "paid", label: "待审核 (paid)" },
  { value: "approved", label: "已通过 (approved)" },
  { value: "rejected", label: "已拒绝 (rejected)" },
  { value: "refunded", label: "已退款 (refunded)" },
  { value: "cancelled", label: "已取消 (cancelled)" },
];

// ============ 套餐类型映射 ============
export interface ProjectTypeMeta {
  label: string;
  color: string;
}

export const PROJECT_TYPE_MAP: Record<string, ProjectTypeMeta> = {
  basic: { label: "基础版", color: "bg-gray-100 text-gray-700 border-gray-200" },
  standard: { label: "标准版", color: "bg-blue-50 text-blue-700 border-blue-200" },
  premium: { label: "高级版", color: "bg-purple-50 text-purple-700 border-purple-200" },
  enterprise: { label: "企业版", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

// ============ 支付方式映射 ============
export interface PayMethodMeta {
  label: string;
  color: string;
}

export const PAY_METHOD_MAP: Record<string, PayMethodMeta> = {
  alipay: { label: "支付宝", color: "bg-blue-50 text-blue-700 border-blue-200" },
  wechat: { label: "微信支付", color: "bg-green-50 text-green-700 border-green-200" },
  manual: { label: "银行转账/手动", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

export const PAY_METHOD_OPTIONS = [
  { value: "", label: "未指定" },
  { value: "alipay", label: "支付宝" },
  { value: "wechat", label: "微信支付" },
  { value: "manual", label: "银行转账/手动" },
];

export const PAGE_SIZE = 20;

// ============ 工具函数 ============
export function getStatusMeta(status: string): StatusMeta {
  return STATUS_MAP[status] || { label: status, color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" };
}

export function getProjectTypeMeta(type: string): ProjectTypeMeta {
  return PROJECT_TYPE_MAP[type] || { label: type, color: "bg-gray-100 text-gray-700 border-gray-200" };
}

export function getPayMethodMeta(method: string | null): PayMethodMeta | null {
  if (!method) return null;
  return PAY_METHOD_MAP[method] || { label: method, color: "bg-gray-100 text-gray-700 border-gray-200" };
}
