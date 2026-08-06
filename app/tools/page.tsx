"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Container from "@/components/common/Container";

interface ToolCategory {
  id: string;
  name: string;
  slug?: string;
  description?: string;
}

interface ToolItem {
  id: string;
  name: string;
  description?: string;
  content?: string;
  icon?: string;
  logo?: string;
  cover?: string;
  coverImage?: string;
  url?: string;
  link?: string;
  category?: ToolCategory | string;
  categoryId?: string;
  categoryName?: string;
  tags?: string[] | string;
  isFeatured?: boolean;
  status?: string;
  views?: number;
  usageCount?: number;
  toolType?: string;
  htmlContent?: string;
  createdAt?: string;
}

function isImageUrl(value?: string | null) {
  if (!value) return false;
  return /^(https?:\/\/|\/|data:image\/)/i.test(value.trim());
}

function ToolIcon({ tool }: { tool: ToolItem }) {
  const imageUrl =
    [tool.icon, tool.logo, tool.cover, tool.coverImage].find((value) =>
      isImageUrl(value),
    ) || "";
  const textIcon = !isImageUrl(tool.icon) && tool.icon ? tool.icon : "🔧";

  if (imageUrl) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={tool.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            const img = e.currentTarget;
            img.style.display = "none";
            const fallback = img.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = "inline";
          }}
        />
        <span className="hidden px-1 text-center leading-none truncate max-w-full">
          {textIcon}
        </span>
      </>
    );
  }

  return (
    <span className="px-1 text-center leading-none truncate max-w-full">
      {textIcon}
    </span>
  );
}

export default function ToolsPage() {
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [categories, setCategories] = useState<ToolCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 筛选与搜索
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // 获取工具分类与工具列表
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 并行请求工具与分类列表
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const [toolsRes, catRes] = await Promise.all([
        fetch("/api/tools", { signal: controller.signal }).catch(() => null),
        fetch("/api/admin/tools/categories", { signal: controller.signal }).catch(() => null),
      ]);

      clearTimeout(timeoutId);

      let toolsData: ToolItem[] = [];
      if (toolsRes && toolsRes.ok) {
        const json = await toolsRes.json();
        toolsData = Array.isArray(json)
          ? json
          : json.tools || json.data || [];
      }

      let categoriesData: ToolCategory[] = [];
      if (catRes && catRes.ok) {
        const json = await catRes.json();
        categoriesData = Array.isArray(json)
          ? json
          : json.categories || json.data || [];
      }

      setTools(toolsData);
      setCategories(categoriesData);
    } catch (err: any) {
      console.error("[TOOLS PAGE FETCH ERROR]", err);
      setError("加载工具库失败，请刷新重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 工具分类与关键词过滤
  const filteredTools = tools.filter((tool) => {
    // 状态检查（仅显示 active/published 或未标状态的工具）
    if (tool.status && !["active", "published"].includes(tool.status.toLowerCase())) {
      return false;
    }

    // 分类匹配
    if (selectedCategory !== "all") {
      const catId = typeof tool.category === "object" ? tool.category?.id : tool.categoryId;
      const catName = typeof tool.category === "object" ? tool.category?.name : (tool.categoryName || tool.category);
      if (catId !== selectedCategory && catName !== selectedCategory) {
        return false;
      }
    }

    // 搜索匹配
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = tool.name?.toLowerCase().includes(q);
      const descMatch = tool.description?.toLowerCase().includes(q);
      const tagMatch = Array.isArray(tool.tags)
        ? tool.tags.some((t) => t.toLowerCase().includes(q))
        : typeof tool.tags === "string" && tool.tags.toLowerCase().includes(q);
      if (!nameMatch && !descMatch && !tagMatch) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50/50 py-8">
      <Container>
        {/* 页头 Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 md:p-12 text-white shadow-lg mb-8">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] sm:text-xs font-medium text-white mb-4">
              <span>🚀 效率利器</span>
              <span>•</span>
              <span>开发者实用工具全集</span>
            </div>
            <h1 className="text-[18px] sm:text-3xl font-extrabold tracking-tight mb-3">
              工具库中心
            </h1>
            <p className="text-blue-100 text-[11px] sm:text-base leading-relaxed mb-6">
              汇聚高效便利的开发与日常在线工具，助你快速解决开发、调试、转换与效率难题。
            </p>

            {/* 搜索框 */}
            <div className="relative max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索工具名称、功能或标签..."
                enterKeyHint="search"
                className="w-full pl-10 pr-4 py-3 bg-white text-gray-900 placeholder-gray-400 rounded-xl shadow-md text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              />
              <svg
                className="w-5 h-5 text-gray-400 absolute left-3 top-3.5"
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
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 text-[11px] sm:text-xs bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 背景装饰点缀 */}
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute right-20 top-0 w-48 h-48 bg-purple-500/20 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* 精选内置工具 */}
        <div className="mb-8">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>✨</span>
            <span>精选内置工具</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/tools/prompt-generator"
              className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xl flex-shrink-0">
                  ✨
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    AI Prompt 生成器
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    10+ 高质量 Prompt 模板，写代码、写文章、做方案一键生成专业 Prompt
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                      热门
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">
                      免费
                    </span>
                  </div>
                </div>
              </div>
            </Link>

            <Link
              href="/tools/pdf"
              className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-orange-200 hover:shadow-lg transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-xl flex-shrink-0">
                  📄
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
                    PDF 格式转换工具箱
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    17 款 PDF 工具，格式转换、合并拆分、压缩加密、OCR 识别一站式搞定
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded">
                      推荐
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded">
                      免费
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* 分类过滤器 */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-xl text-[11px] sm:text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              全部工具 ({tools.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-[11px] sm:text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* 加载状态 */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-pulse space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-4/5" />
                <div className="pt-2 flex justify-between items-center">
                  <div className="h-4 bg-gray-200 rounded w-16" />
                  <div className="h-8 bg-gray-200 rounded-lg w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-red-100 p-12 text-center my-8">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-gray-800 font-semibold mb-1">{error}</h3>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-[11px] sm:text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              重新加载
            </button>
          </div>
        ) : filteredTools.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center my-8">
            <div className="text-5xl mb-3">🛠️</div>
            <h3 className="text-gray-800 font-semibold text-[15px] sm:text-lg mb-1">
              暂无匹配的工具
            </h3>
            <p className="text-[11px] sm:text-sm text-gray-500 mb-6">
              {searchQuery
                ? `未找到与 “${searchQuery}” 相关的工具`
                : "当前分类下暂无工具，请选择其他分类查看"}
            </p>
            {(searchQuery || selectedCategory !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="px-4 py-2 bg-blue-50 text-blue-600 text-[11px] sm:text-xs font-medium rounded-xl hover:bg-blue-100 transition-colors"
              >
                重置搜索与筛选
              </button>
            )}
          </div>
        ) : (
          /* 工具网格列表 */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredTools.map((tool) => {
              const catName =
                typeof tool.category === "object"
                  ? tool.category?.name
                  : tool.categoryName || "实用工具";

              const isExternal =
                tool.url &&
                (tool.url.startsWith("http://") ||
                  tool.url.startsWith("https://"));

              return (
                <div
                  key={tool.id}
                  className="group bg-white rounded-2xl p-5 border border-gray-200/80 hover:border-blue-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* 头部：图标 + 名称 + 标签 */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/60 flex items-center justify-center text-[15px] sm:text-xl flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                          <ToolIcon tool={tool} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate text-[13px] sm:text-base">
                            {tool.name}
                          </h3>
                          <span className="inline-block px-2 py-0.5 text-[11px] font-medium text-blue-600 bg-blue-50 rounded-md">
                            {catName}
                          </span>
                        </div>
                      </div>

                      {tool.isFeatured && (
                        <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
                          ⭐ 精选
                        </span>
                      )}
                    </div>

                    {/* 简介 */}
                    <p className="text-[11px] sm:text-xs text-gray-500 line-clamp-2 leading-relaxed mb-4 min-h-[2.5rem]">
                      {tool.description || "暂无工具功能说明..."}
                    </p>
                  </div>

                  {/* 底部操作与按钮 */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-gray-400">
                      {tool.toolType === "embedded" ? "🛠️ 在线工具" : (tool.views !== undefined ? `${tool.views} 次浏览` : "即点即用")}
                    </div>

                    <Link
                      href={`/tools/${tool.id}`}
                      prefetch
                      className="inline-flex items-center gap-1 px-4 py-1.5 text-[11px] sm:text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                    >
                      使用工具
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
