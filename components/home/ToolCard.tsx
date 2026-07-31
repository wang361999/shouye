"use client";

import Link from "next/link";
import { truncateText } from "@/lib/utils";

interface Tool {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  category: string;
}

interface ToolCardProps {
  tool: Tool;
}

export default function ToolCard({ tool }: ToolCardProps) {
  return (
    <div className="group bg-white rounded-xl border border-gray-200 p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-gray-300">
      {/* 图标 */}
      <div className="text-4xl mb-4">{tool.icon}</div>

      {/* 分类标签 */}
      <span className="inline-block px-2.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-full mb-3">
        {tool.category}
      </span>

      {/* 工具名称 */}
      <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
        {tool.name}
      </h3>

      {/* 描述（截断2行） */}
      <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed">
        {truncateText(tool.description, 100)}
      </p>

      {/* 开始使用按钮 */}
      <Link
        href={tool.url}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        开始使用
        <svg
          className="w-4 h-4 ml-1.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </Link>
    </div>
  );
}
