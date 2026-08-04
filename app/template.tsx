"use client";

/**
 * 页面过渡动画模板
 *
 * Next.js App Router 的 template.tsx 会在每次路由导航时重新挂载，
 * 配合 globals.css 中的 .animate-fade-in 动画实现页面切换时的淡入效果。
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
