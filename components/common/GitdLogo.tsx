"use client";

import { useId } from "react";

/**
 * Gitd 原创品牌 Logo —— 源点
 *
 * 完全原创设计，不含 GitHub 分支/章鱼等元素。
 * 渐变弧环 + 中心圆 + 脉冲折线，寓意"技术来源的实时脉冲"。
 *
 * 同时适配亮色/暗色背景：
 * - 亮色背景（Header 白底）: 折线用深色描边
 * - 暗色背景（移动端深色头部）: 同一套渐变 + 深色折线
 *
 * 使用 useId() 生成唯一渐变 ID，避免同一页面多个 Logo 实例
 * 因 ID 重复导致渐变失效、Logo 不可见的问题。
 */
export default function GitdLogo({ className = "h-8 w-8" }: { className?: string }) {
  const rawId = useId();
  // useId 返回值含冒号（如 :r1:），在 SVG url() 引用中需要去除
  const gradId = `gitd-logo-${rawId.replace(/:/g, "")}`;

  return (
    <svg className={className} viewBox="0 0 72 72" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="12" y1="10" x2="58" y2="62">
          <stop stopColor="#67e8f9" />
          <stop offset="0.42" stopColor="#2563eb" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path
        d="M36 7c15.3 0 27 11.2 27 25.8 0 13.9-10.6 24.7-24.3 25.6-2.1.1-3.9-1.6-3.9-3.7v-6.2c0-1.8 1.4-3.3 3.2-3.6 5.8-.9 10.1-5.7 10.1-11.9 0-6.9-5.4-12.2-12.2-12.2-7.1 0-12.5 5.5-12.5 12.7 0 5.3 3.1 9.9 7.5 11.8 1.5.6 2.4 2 2.4 3.6v9.7c0 2.3-2.2 4-4.4 3.4C17 58.6 8.9 47.6 8.9 34.1 8.9 18.6 20.7 7 36 7z"
        fill={`url(#${gradId})`}
      />
      <circle cx="36" cy="34" r="6.4" fill="#fff" />
      <path
        d="M28 34h5l2.4-4 3.2 8 2.4-4h4"
        fill="none"
        stroke="#0f172a"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
