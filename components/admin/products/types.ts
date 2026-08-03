/**
 * 产品管理模块共享类型、常量与辅助函数
 * 供 page.tsx 与各子组件复用，避免循环依赖
 */
import type { StatusMeta } from "@/lib/admin-utils";

// ============ 类型定义 ============
export interface Product {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  icon: string | null;
  coverImage: string | null;
  features: string | null;
  techStack: string | null;
  screenshots: string | null;
  demoUrl: string | null;
  docsUrl: string | null;
  downloadUrl: string | null;
  status: string; // active | draft | retired
  sortOrder: number;
  priceBasic: number; // 分
  priceStandard: number;
  pricePremium: number;
  priceEnterprise: number;
  validDays: number;
  orderCount: number;
  licenseCount: number;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVersion {
  id: string;
  productId: string;
  version: string;
  title: string;
  changelog: string;
  downloadUrl: string;
  downloadPassword: string | null;
  fileSize: string | null;
  isLatest: boolean;
  isPublished: boolean;
  createdAt: string;
}

export interface ProductForm {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  icon: string;
  coverImage: string;
  features: string;
  demoUrl: string;
  docsUrl: string;
  downloadUrl: string;
  status: string;
  sortOrder: number;
  priceBasic: string;
  priceStandard: string;
  pricePremium: string;
  priceEnterprise: string;
  validDays: number;
}

export interface VersionForm {
  version: string;
  title: string;
  changelog: string;
  downloadUrl: string;
  downloadPassword: string;
  fileSize: string;
  isLatest: boolean;
  isPublished: boolean;
}

// ============ 状态映射 ============
export const STATUS_META: Record<string, StatusMeta> = {
  active: {
    label: "上架",
    color: "bg-green-50 text-green-700 border-green-200",
    dot: "bg-green-500",
  },
  draft: {
    label: "草稿",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  retired: {
    label: "已下架",
    color: "bg-gray-100 text-gray-600 border-gray-200",
    dot: "bg-gray-400",
  },
};

export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "上架" },
  { value: "draft", label: "草稿" },
  { value: "retired", label: "已下架" },
];

export const STATUS_EDIT_OPTIONS = [
  { value: "active", label: "上架 (active)" },
  { value: "draft", label: "草稿 (draft)" },
  { value: "retired", label: "已下架 (retired)" },
];

export const INPUT_CLS =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

export function getStatusMeta(status: string): StatusMeta {
  return (
    STATUS_META[status] || {
      label: status,
      color: "bg-gray-100 text-gray-600 border-gray-200",
      dot: "bg-gray-400",
    }
  );
}

/** 将数据库中的 features JSON 字符串转为 textarea 文本（每行一个） */
export function featuresToText(features: string | null): string {
  if (!features) return "";
  try {
    const arr = JSON.parse(features);
    if (Array.isArray(arr)) return arr.map((s) => String(s)).filter(Boolean).join("\n");
    return String(features);
  } catch {
    return String(features);
  }
}

/** 将 textarea 文本转为 JSON 数组字符串 */
export function textToFeaturesString(text: string): string {
  const arr = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return JSON.stringify(arr);
}

export const EMPTY_FORM: ProductForm = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  icon: "",
  coverImage: "",
  features: "",
  demoUrl: "",
  docsUrl: "",
  downloadUrl: "",
  status: "active",
  sortOrder: 0,
  priceBasic: "0",
  priceStandard: "0",
  pricePremium: "0",
  priceEnterprise: "0",
  validDays: 365,
};

export const EMPTY_VERSION_FORM: VersionForm = {
  version: "",
  title: "",
  changelog: "",
  downloadUrl: "",
  downloadPassword: "",
  fileSize: "",
  isLatest: false,
  isPublished: true,
};
