"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";

// 动态导入 MarkdownRenderer（不含 SSR，减少首屏 JS）
// react-markdown + remark-gfm 体积较大，延迟加载可显著降低首屏 bundle
const MarkdownRenderer = dynamic(
  () => import("./MarkdownRenderer"),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-full"></div>
        <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-2/3"></div>
      </div>
    ),
  }
);

interface LazyMarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * 懒加载 Markdown 渲染器
 *
 * 优化策略：
 * 1. 使用 IntersectionObserver 检测组件是否进入视口
 * 2. 进入视口后才加载 react-markdown + remark-gfm（约 80KB gzipped）
 * 3. 首屏不加载，减少首屏 JS 体积，加快 LCP
 * 4. 加载中显示骨架屏，避免布局跳动
 *
 * 适用场景：帖子详情、项目详情等页面（Markdown 内容在首屏下方或需要滚动查看）
 */
export default function LazyMarkdownRenderer({ content, className = "" }: LazyMarkdownRendererProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 如果不支持 IntersectionObserver，直接加载（降级）
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        // 提前 200px 开始加载，用户滚动到之前就准备好
        rootMargin: "200px",
        threshold: 0.01,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={className}>
      <Suspense
        fallback={
          <div className="animate-pulse space-y-3 py-4">
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-2/3"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
          </div>
        }
      >
        {isVisible ? (
          <MarkdownRenderer content={content} />
        ) : (
          <div className="py-4 space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-5/6"></div>
          </div>
        )}
      </Suspense>
    </div>
  );
}
