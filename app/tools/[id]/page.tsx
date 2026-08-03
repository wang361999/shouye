"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Container from "@/components/common/Container";

interface ToolItem {
  id: string;
  name: string;
  description?: string;
  content?: string;
  icon?: string;
  logo?: string;
  cover?: string;
  url?: string;
  link?: string;
  category?: { id?: string; name?: string } | string;
  categoryName?: string;
  tags?: string[] | string;
  isFeatured?: boolean;
  status?: string;
  views?: number;
  usageCount?: number;
  toolType?: string;
  htmlContent?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function ToolDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const toolId = params?.id;

  const [tool, setTool] = useState<ToolItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toolId) return;

    let active = true;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch(`/api/tools/${toolId}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("工具不存在或已被删除");
          }
          throw new Error("获取工具详情失败");
        }
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        const toolData = data.tool || data.data || data;
        setTool(toolData);
      })
      .catch((err: any) => {
        if (active) setError(err.name === 'AbortError' ? '加载超时，请刷新重试' : (err.message || "获取工具详情失败"));
      })
      .finally(() => {
        if (active) setLoading(false);
        clearTimeout(timeoutId);
      });

    return () => {
      active = false;
    };
  }, [toolId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 py-8">
        <Container>
          <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4" />
            <div className="bg-white rounded-2xl p-8 border border-gray-200 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-200 rounded-2xl" />
                <div className="space-y-2 flex-1">
                  <div className="h-6 bg-gray-200 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
              <div className="h-20 bg-gray-100 rounded-xl" />
            </div>
          </div>
        </Container>
      </div>
    );
  }

  if (error || !tool) {
    return (
      <div className="min-h-screen bg-gray-50/50 py-12">
        <Container>
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {error || "找不到该工具"}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              请检查访问链接是否正确，或在工具库中寻找其他实用工具。
            </p>
            <Link
              href="/tools"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium text-sm rounded-xl hover:bg-blue-700 transition-colors"
            >
              ← 返回工具库
            </Link>
          </div>
        </Container>
      </div>
    );
  }

  const iconUrl = tool.icon || tool.logo || tool.cover;
  const catName =
    typeof tool.category === "object"
      ? tool.category?.name
      : tool.categoryName || "实用工具";

  const targetUrl = tool.url || tool.link;
  const isExternal =
    targetUrl &&
    (targetUrl.startsWith("http://") || targetUrl.startsWith("https://"));
  const isEmbedded = tool.toolType === "embedded" && tool.htmlContent;

  // 格式化标签
  const tagList: string[] = Array.isArray(tool.tags)
    ? tool.tags
    : typeof tool.tags === "string"
    ? tool.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-gray-50/50 py-8">
      <Container>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 面包屑导航 */}
          <nav className="flex items-center gap-2 text-xs md:text-sm text-gray-500">
            <Link href="/" className="hover:text-blue-600 transition-colors">
              首页
            </Link>
            <span>/</span>
            <Link
              href="/tools"
              className="hover:text-blue-600 transition-colors"
            >
              工具库
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium truncate max-w-[200px]">
              {tool.name}
            </span>
          </nav>

          {/* 工具头图与核心信息 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden shadow-inner">
                  {iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={iconUrl}
                      alt={tool.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display =
                          "none";
                      }}
                    />
                  ) : (
                    <span>🛠️</span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold text-gray-900">
                      {tool.name}
                    </h1>
                    <span className="px-2.5 py-0.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md">
                      {catName}
                    </span>
                    {tool.isFeatured && (
                      <span className="px-2.5 py-0.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
                        ⭐ 精选推荐
                      </span>
                    )}
                  </div>
                  {tool.description && (
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {tool.description}
                    </p>
                  )}
                </div>
              </div>

              {/* 使用按钮 - 内嵌工具不显示外链按钮 */}
              {targetUrl && !isEmbedded && (
                <div className="flex-shrink-0">
                  <a
                    href={targetUrl}
                    target={isExternal ? "_blank" : "_self"}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                    className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
                  >
                    <span>在线使用工具</span>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </div>
              )}
            </div>

            {/* 标签列表 */}
            {tagList.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">标签：</span>
                {tagList.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 text-xs text-gray-600 bg-gray-100 rounded-lg"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 内嵌工具渲染区 */}
          {isEmbedded ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-gray-900 pb-3 border-b border-gray-100">
                在线使用
              </h2>
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <iframe
                  srcDoc={tool.htmlContent}
                  title={tool.name}
                  className="w-full"
                  style={{ minHeight: "500px", border: "none" }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                />
              </div>
            </div>
          ) : null}

          {/* 详细内容与说明 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 pb-3 border-b border-gray-100">
              工具说明与指引
            </h2>

            {tool.content ? (
              <div className="prose prose-blue max-w-none text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {tool.content}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-gray-400">
                {isEmbedded
                  ? "直接在上方使用工具，如有问题请参考工具说明。"
                  : '该工具暂无详细说明，点击右上角"在线使用工具"即可开始使用。'}
              </div>
            )}
          </div>

          {/* 底部返回 */}
          <div className="flex justify-between items-center">
            <Link
              href="/tools"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              返回工具库列表
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
