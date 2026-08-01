"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Container from "@/components/common/Container";

interface ToolCategory {
  id: string;
  name: string;
}

interface ToolDetail {
  id: string;
  name: string;
  description: string;
  detail?: string;
  content?: string;
  icon?: string;
  url?: string;
  category?: ToolCategory | string;
  views?: number;
  likes?: number;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export default function ToolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toolId = params?.id as string;

  const [tool, setTool] = useState<ToolDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToolDetail = useCallback(async () => {
    if (!toolId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tools/${toolId}`);
      if (res.status === 404) {
        throw new Error("工具不存在或已被移除");
      }
      if (!res.ok) {
        throw new Error("获取工具详情失败");
      }
      const data = await res.json();
      setTool(data.tool || data.data || data);
    } catch (err: any) {
      console.error("[TOOL DETAIL ERROR]", err);
      setError(err.message || "获取工具详情失败");
    } finally {
      setLoading(false);
    }
  }, [toolId]);

  useEffect(() => {
    fetchToolDetail();
  }, [fetchToolDetail]);

  const categoryName = tool
    ? typeof tool.category === "object"
      ? tool.category?.name
      : tool.category
    : null;

  return (
    <div className="min-h-screen bg-gray-50/50 py-10">
      <Container>
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            首页
          </Link>
          <span>/</span>
          <Link href="/tools" className="hover:text-blue-600 transition-colors">
            工具箱
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium truncate max-w-[200px]">
            {tool?.name || "工具详情"}
          </span>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm animate-pulse space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-200 rounded-2xl" />
              <div className="space-y-2 flex-1">
                <div className="h-6 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-1/4" />
              </div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="h-24 bg-gray-200 rounded w-full" />
          </div>
        ) : error || !tool ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-md mx-auto my-12">
            <div className="text-5xl mb-4">🧩</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">未找到该工具</h2>
            <p className="text-sm text-gray-500 mb-6">{error || "要求的工具可能已被下架或不存在"}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
              >
                返回上一页
              </button>
              <Link
                href="/tools"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
              >
                浏览所有工具
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200/80 p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-gray-100 pb-6 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-3xl flex-shrink-0">
                    {tool.icon ? (
                      tool.icon.startsWith("http") || tool.icon.startsWith("/") ? (
                        <img src={tool.icon} alt={tool.name} className="w-10 h-10 object-contain" />
                      ) : (
                        <span>{tool.icon}</span>
                      )
                    ) : (
                      <span>🧰</span>
                    )}
                  </div>
                  <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">{tool.name}</h1>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {categoryName && (
                        <span className="px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-full">
                          {categoryName}
                        </span>
                      )}
                      {tool.views !== undefined && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {tool.views} 次浏览
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {tool.url && (
                  <a
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-sm"
                  >
                    在线体验 / 使用
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    工具简介
                  </h3>
                  <p className="text-base text-gray-700 leading-relaxed bg-gray-50/70 p-4 rounded-xl border border-gray-100">
                    {tool.description || "暂无简介说明"}
                  </p>
                </div>

                {(tool.detail || tool.content) && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      详细指南与说明
                    </h3>
                    <div className="prose max-w-none text-gray-800 text-sm leading-relaxed p-4 bg-white border border-gray-100 rounded-xl">
                      {tool.detail || tool.content}
                    </div>
                  </div>
                )}

                {tool.tags && tool.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      标签分类
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {tool.tags.map((tag, idx) => (
                        <span key={idx} className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Link
                href="/tools"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                返回工具列表
              </Link>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
