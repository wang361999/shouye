"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Container from "@/components/common/Container";

interface ToolCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface Tool {
  id: string;
  name: string;
  description: string;
  icon?: string;
  url?: string;
  category?: ToolCategory | string;
  categoryId?: string;
  status?: string;
  views?: number;
  likes?: number;
  tags?: string[];
  createdAt?: string;
}

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<ToolCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTools = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/tools");
      if (!res.ok) {
        throw new Error("获取工具列表失败");
      }
      const data = await res.json();
      const toolList = Array.isArray(data) ? data : data.tools || data.data || [];
      const catList = data.categories || [];
      setTools(toolList);
      setCategories(catList);
    } catch (err: any) {
      console.error("[TOOLS PAGE ERROR]", err);
      setError(err.message || "加载工具列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const allCategories = categories.length > 0 ? categories : Array.from(
    new Set(
      tools
        .map((t) => (typeof t.category === "object" ? t.category?.name : t.category))
        .filter(Boolean) as string[]
    )
  ).map((catName) => ({ id: catName, name: catName, slug: catName }));

  const filteredTools = tools.filter((tool) => {
    const catName = typeof tool.category === "object" ? tool.category?.name : tool.category;
    const catId = tool.categoryId || catName;
    const matchesCategory =
      selectedCategory === "all" ||
      catId === selectedCategory ||
      catName === selectedCategory;

    const matchesSearch =
      !searchQuery.trim() ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tool.tags && tool.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())));

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50/50 py-10">
      <Container>
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium mb-4">
            <span>🛠️ 开发者百宝箱</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            实用开发者工具集合
          </h1>
          <p className="mt-3 text-base text-gray-500 sm:text-lg">
            精选在线开发工具、效率神器与辅助套件，助力高效编程与生产力提升
          </p>

          <div className="mt-6 relative max-w-xl mx-auto">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索工具名称、功能或关键字..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600"
              >
                清除
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center flex-wrap gap-2 mb-8">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            全部工具
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat.id || cat.name}
              onClick={() => setSelectedCategory(cat.id || cat.name)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === (cat.id || cat.name)
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {cat.icon && <span className="mr-1.5">{cat.icon}</span>}
              {cat.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-pulse space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-4/5" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-red-100 p-8 text-center max-w-md mx-auto">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">加载失败</h3>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <button
              onClick={fetchTools}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              重试
            </button>
          </div>
        ) : filteredTools.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center max-w-md mx-auto">
            <div className="text-5xl mb-3">🔍</div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">未找到相关工具</h3>
            <p className="text-sm text-gray-500 mb-4">尝试更换搜索关键字或切换分类标签</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
            >
              重置筛选
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTools.map((tool) => {
              const catName = typeof tool.category === "object" ? tool.category?.name : tool.category;
              return (
                <div
                  key={tool.id}
                  className="group bg-white rounded-2xl border border-gray-200/80 p-6 hover:shadow-md hover:border-blue-200 transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100/80 flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-105 transition-transform">
                          {tool.icon ? (
                            tool.icon.startsWith("http") || tool.icon.startsWith("/") ? (
                              <img src={tool.icon} alt={tool.name} className="w-7 h-7 object-contain" />
                            ) : (
                              <span>{tool.icon}</span>
                            )
                          ) : (
                            <span>🧰</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                            <Link href={`/tools/${tool.id}`}>
                              {tool.name}
                            </Link>
                          </h3>
                          {catName && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-600 rounded">
                              {catName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed mb-4">
                      {tool.description || "暂无工具说明"}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                    <Link
                      href={`/tools/${tool.id}`}
                      className="text-xs font-medium text-gray-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
                    >
                      查看详情
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>

                    {tool.url ? (
                      <a
                        href={tool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        立即打开
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ) : (
                      <Link
                        href={`/tools/${tool.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        使用工具
                      </Link>
                    )}
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
