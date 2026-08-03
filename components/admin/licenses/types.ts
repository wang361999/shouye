/**
 * 授权管理模块共享类型、常量与辅助函数
 */
import type { StatusMeta } from "@/lib/admin-utils";

// ============ 类型定义 ============
export interface LicenseDomain {
  domain: string;
  activatedAt: string;
  lastVerifiedAt: string | null;
}

export interface LicenseOwner {
  id: string;
  username: string;
  email: string;
}

export interface LicenseProduct {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export interface LicenseOrder {
  id: string;
  orderNo: string;
  status: string;
}

export interface License {
  id: string;
  licenseKey: string;
  projectName: string;
  projectType: string; // basic | standard | premium | enterprise
  maxDomains: number;
  boundDomains: number;
  expiresAt: string;
  status: string; // active | suspended | expired | revoked
  remark: string | null;
  owner: LicenseOwner | null;
  product: LicenseProduct | null;
  order: LicenseOrder | null;
  domains: LicenseDomain[];
  logCount: number;
  createdAt: string;
}

export interface ProductOption {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export interface LicenseLog {
  id: string;
  licenseId: string | null;
  licenseKey: string;
  domain: string;
  ip: string | null;
  userAgent: string | null;
  result: string;
  message: string | null;
  createdAt: string;
}

// ============ 套餐类型映射 ============
export interface ProjectTypeMeta {
  label: string;
  defaultDomains: number;
  color: string;
}

export const PROJECT_TYPE_MAP: Record<string, ProjectTypeMeta> = {
  basic: { label: "基础版", defaultDomains: 1, color: "bg-gray-100 text-gray-700 border-gray-200" },
  standard: { label: "标准版", defaultDomains: 2, color: "bg-blue-50 text-blue-700 border-blue-200" },
  premium: { label: "高级版", defaultDomains: 5, color: "bg-purple-50 text-purple-700 border-purple-200" },
  enterprise: { label: "企业版", defaultDomains: 10, color: "bg-amber-50 text-amber-700 border-amber-200" },
};

export const PROJECT_TYPE_OPTIONS = [
  { value: "basic", label: "基础版 (1 域名)" },
  { value: "standard", label: "标准版 (2 域名)" },
  { value: "premium", label: "高级版 (5 域名)" },
  { value: "enterprise", label: "企业版 (10 域名)" },
];

// ============ 状态映射 ============
export const STATUS_MAP: Record<string, StatusMeta> = {
  active: { label: "有效", color: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  suspended: { label: "暂停", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  expired: { label: "过期", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  revoked: { label: "吊销", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-500" },
};

export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "有效" },
  { value: "suspended", label: "暂停" },
  { value: "expired", label: "过期" },
  { value: "revoked", label: "吊销" },
];

export const EDIT_STATUS_OPTIONS = [
  { value: "active", label: "有效 (active)" },
  { value: "suspended", label: "暂停 (suspended)" },
  { value: "expired", label: "过期 (expired)" },
  { value: "revoked", label: "吊销 (revoked)" },
];

// ============ 验证结果映射 ============
export interface ResultMeta {
  label: string;
  color: string;
}

export const RESULT_MAP: Record<string, ResultMeta> = {
  valid: { label: "验证通过", color: "bg-green-50 text-green-700 border-green-200" },
  invalid: { label: "无效", color: "bg-red-50 text-red-700 border-red-200" },
  expired: { label: "已过期", color: "bg-orange-50 text-orange-700 border-orange-200" },
  suspended: { label: "已暂停", color: "bg-amber-50 text-amber-700 border-amber-200" },
  domain_mismatch: { label: "域名不匹配", color: "bg-purple-50 text-purple-700 border-purple-200" },
  not_found: { label: "未找到", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

export const RESULT_FILTER_OPTIONS = [
  { value: "all", label: "全部结果" },
  { value: "valid", label: "验证通过" },
  { value: "invalid", label: "无效" },
  { value: "expired", label: "已过期" },
  { value: "suspended", label: "已暂停" },
  { value: "domain_mismatch", label: "域名不匹配" },
  { value: "not_found", label: "未找到" },
];

export const LOG_PAGE_SIZE = 20;

// ============ 工具函数 ============
export function toDateInputValue(dateStr: string) {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isExpired(dateStr: string) {
  return new Date(dateStr).getTime() < Date.now();
}

export function getProjectTypeMeta(type: string): ProjectTypeMeta {
  return PROJECT_TYPE_MAP[type] || { label: type, defaultDomains: 1, color: "bg-gray-100 text-gray-700 border-gray-200" };
}

export function getStatusMeta(status: string): StatusMeta {
  return STATUS_MAP[status] || { label: status, color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" };
}

export function getResultMeta(result: string): ResultMeta {
  return RESULT_MAP[result] || { label: result, color: "bg-gray-100 text-gray-700 border-gray-200" };
}
