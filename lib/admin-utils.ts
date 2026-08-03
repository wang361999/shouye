/**
 * 后台共享工具函数
 * 消除多个页面中重复的 formatDateTime / centsToYuan / yuanToCents 等函数
 */

/** 格式化日期时间（上海时区） */
export function formatDateTime(dateStr: string | null | Date | undefined): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

/** 格式化日期（仅日期，上海时区） */
export function formatDate(dateStr: string | null | Date | undefined): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

/** 分转元（字符串，保留两位小数） */
export function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** 元转分（整数） */
export function yuanToCents(yuan: string | number): number {
  return Math.round(Number(yuan) * 100);
}

/** 状态徽章通用类型 */
export interface StatusMeta {
  label: string;
  color: string;
  dot: string;
}
