"use client";

import { useState } from "react";
import Link from "next/link";
import Container from "@/components/common/Container";

// ============ 工具定义 ============
interface PdfTool {
  id: string;
  name: string;
  icon: string;
  description: string;
  fromFormats?: string[];
  toFormats?: string[];
  features?: string[];
  status: "available" | "coming" | "popular";
  gradient: string;
}

const PDF_TOOLS: { category: string; icon: string; desc: string; tools: PdfTool[] }[] = [
  // 第一类：PDF 转其他格式
  {
    category: "PDF 转其他格式",
    icon: "📤",
    desc: "将 PDF 文件转换为各种常用格式",
    tools: [
      {
        id: "pdf-to-word",
        name: "PDF 转 Word",
        icon: "📝",
        description: "将 PDF 文档转换为可编辑的 Word 文档，保留格式与排版",
        fromFormats: ["PDF"],
        toFormats: ["DOC", "DOCX"],
        features: ["保留原排版", "支持批量转换", "识别表格"],
        status: "popular",
        gradient: "from-blue-500 to-indigo-600",
      },
      {
        id: "pdf-to-excel",
        name: "PDF 转 Excel",
        icon: "📊",
        description: "从 PDF 中提取表格数据，转换为 Excel 电子表格",
        fromFormats: ["PDF"],
        toFormats: ["XLS", "XLSX"],
        features: ["智能识别表格", "保留数据格式", "支持多 Sheet"],
        status: "available",
        gradient: "from-green-500 to-emerald-600",
      },
      {
        id: "pdf-to-ppt",
        name: "PDF 转 PPT",
        icon: "📽️",
        description: "将 PDF 文档转换为 PowerPoint 演示文稿，每页对应一张幻灯片",
        fromFormats: ["PDF"],
        toFormats: ["PPT", "PPTX"],
        features: ["每页一帧", "保留图片", "可编辑文本"],
        status: "available",
        gradient: "from-orange-500 to-red-500",
      },
      {
        id: "pdf-to-image",
        name: "PDF 转图片",
        icon: "🖼️",
        description: "将 PDF 页面转换为高清图片，支持多种图片格式",
        fromFormats: ["PDF"],
        toFormats: ["JPG", "PNG", "BMP", "GIF"],
        features: ["高清输出", "自定义 DPI", "批量转换"],
        status: "available",
        gradient: "from-purple-500 to-pink-500",
      },
      {
        id: "pdf-to-txt",
        name: "PDF 转文本",
        icon: "📄",
        description: "提取 PDF 中的纯文本内容，支持 TXT/HTML/EPUB/MOBI",
        fromFormats: ["PDF"],
        toFormats: ["TXT", "HTML", "EPUB", "MOBI"],
        features: ["精准提取", "保留换行", "批量处理"],
        status: "available",
        gradient: "from-gray-500 to-gray-700",
      },
      {
        id: "pdf-to-markdown",
        name: "PDF 转 Markdown",
        icon: "📋",
        description: "将 PDF 文档转换为 Markdown 格式，适合技术文档和博客",
        fromFormats: ["PDF"],
        toFormats: ["Markdown", "SVG", "PDF/A"],
        features: ["识别标题层级", "代码块保留", "表格转换"],
        status: "coming",
        gradient: "from-cyan-500 to-blue-500",
      },
    ],
  },
  // 第二类：其他格式转 PDF
  {
    category: "其他格式转 PDF",
    icon: "📥",
    desc: "将各种文件格式转换为 PDF 文档",
    tools: [
      {
        id: "word-to-pdf",
        name: "Word 转 PDF",
        icon: "📝",
        description: "将 Word 文档转换为 PDF 格式，完美保留排版样式",
        fromFormats: ["DOC", "DOCX"],
        toFormats: ["PDF"],
        features: ["格式无损", "批量转换", "支持页眉页脚"],
        status: "popular",
        gradient: "from-blue-600 to-blue-800",
      },
      {
        id: "excel-to-pdf",
        name: "Excel 转 PDF",
        icon: "📊",
        description: "将 Excel 表格转换为 PDF，自适应页面大小",
        fromFormats: ["XLS", "XLSX"],
        toFormats: ["PDF"],
        features: ["自动分页", "保留公式结果", "支持多 Sheet"],
        status: "available",
        gradient: "from-green-600 to-green-800",
      },
      {
        id: "ppt-to-pdf",
        name: "PPT 转 PDF",
        icon: "📽️",
        description: "将 PowerPoint 演示文稿转换为 PDF 文档",
        fromFormats: ["PPT", "PPTX"],
        toFormats: ["PDF"],
        features: ["保留动画帧", "高清输出", "支持备注"],
        status: "available",
        gradient: "from-orange-600 to-red-600",
      },
      {
        id: "image-to-pdf",
        name: "图片转 PDF",
        icon: "🖼️",
        description: "将多张图片合并为一个 PDF 文档，支持排序和调整",
        fromFormats: ["JPG", "PNG", "BMP", "WebP"],
        toFormats: ["PDF"],
        features: ["多图合并", "自定义顺序", "调整尺寸"],
        status: "available",
        gradient: "from-pink-500 to-rose-600",
      },
      {
        id: "html-to-pdf",
        name: "HTML 转 PDF",
        icon: "🌐",
        description: "将网页或 HTML 内容转换为 PDF，支持 URL 或源码",
        fromFormats: ["HTML", "TXT", "Markdown"],
        toFormats: ["PDF"],
        features: ["URL 转换", "自定义纸张", "支持 CSS"],
        status: "coming",
        gradient: "from-indigo-500 to-purple-600",
      },
    ],
  },
  // 第三类：PDF 文档处理
  {
    category: "PDF 文档处理",
    icon: "⚙️",
    desc: "进阶 PDF 处理功能，编辑、优化、保护你的文档",
    tools: [
      {
        id: "pdf-merge",
        name: "合并 PDF",
        icon: "🔗",
        description: "将多个 PDF 文件合并为一个，支持自定义顺序",
        features: ["拖拽排序", "批量合并", "无损合并"],
        status: "available",
        gradient: "from-teal-500 to-cyan-600",
      },
      {
        id: "pdf-split",
        name: "拆分 PDF",
        icon: "✂️",
        description: "按页数或范围拆分 PDF，提取指定页面",
        features: ["按页拆分", "范围提取", "多文件输出"],
        status: "available",
        gradient: "from-amber-500 to-orange-500",
      },
      {
        id: "pdf-compress",
        name: "压缩 PDF",
        icon: "📦",
        description: "压缩 PDF 文件大小，保持画质的同时减小体积",
        features: ["三种压缩级别", "画质可控", "批量压缩"],
        status: "popular",
        gradient: "from-emerald-500 to-teal-600",
      },
      {
        id: "pdf-watermark",
        name: "添加/删除水印",
        icon: "💧",
        description: "为 PDF 添加文字或图片水印，也可移除已有水印",
        features: ["文字水印", "图片水印", "水印去除"],
        status: "coming",
        gradient: "from-sky-500 to-blue-600",
      },
      {
        id: "pdf-encrypt",
        name: "加密/解密 PDF",
        icon: "🔐",
        description: "为 PDF 添加密码保护，或解除已有密码限制",
        features: ["打开密码", "权限密码", "解密移除"],
        status: "coming",
        gradient: "from-violet-500 to-purple-600",
      },
      {
        id: "pdf-ocr",
        name: "OCR 文字识别",
        icon: "🔍",
        description: "扫描件或图片 PDF 转可编辑文字，支持多语言识别",
        features: ["中英文识别", "扫描件转文字", "保留排版"],
        status: "coming",
        gradient: "from-rose-500 to-pink-600",
      },
    ],
  },
];

export default function PdfToolsPage() {
  const [activeCategory, setActiveCategory] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // 搜索过滤
  const filteredCategories = PDF_TOOLS.map((cat) => ({
    ...cat,
    tools: cat.tools.filter(
      (tool) =>
        !searchQuery.trim() ||
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.toFormats?.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase())) ||
        tool.fromFormats?.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
  })).filter((cat) => cat.tools.length > 0);

  const totalTools = PDF_TOOLS.reduce((sum, cat) => sum + cat.tools.length, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Container className="py-8 max-w-6xl">
        {/* 返回 */}
        <div className="mb-6">
          <Link
            href="/tools"
            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            ← 返回工具列表
          </Link>
        </div>

        {/* 头部 Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 via-orange-500 to-amber-500 p-8 md:p-10 text-white shadow-lg mb-8">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-medium text-white mb-4">
              <span>📄</span>
              <span>PDF 工具箱</span>
              <span>•</span>
              <span>{totalTools} 款工具免费使用</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-3">
              PDF 格式转换 & 文档处理
            </h1>
            <p className="text-orange-100 text-sm md:text-base leading-relaxed mb-6">
              一站式 PDF 解决方案，格式转换、合并拆分、压缩加密、OCR 识别，全部在线完成，无需安装软件
            </p>

            {/* 搜索框 */}
            <div className="relative max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索工具，如 Word、Excel、合并、压缩..."
                className="w-full pl-10 pr-4 py-3 bg-white text-gray-900 placeholder-gray-400 rounded-xl shadow-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all"
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
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 text-xs bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 装饰 */}
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute right-20 top-0 w-48 h-48 bg-yellow-500/20 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{totalTools}</div>
            <div className="text-xs text-gray-500 mt-1">PDF 工具</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">20+</div>
            <div className="text-xs text-gray-500 mt-1">支持格式</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="text-2xl font-bold text-green-600">100%</div>
            <div className="text-xs text-gray-500 mt-1">免费使用</div>
          </div>
        </div>

        {/* 分类 Tab */}
        {!searchQuery && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
            {PDF_TOOLS.map((cat, idx) => (
              <button
                key={cat.category}
                onClick={() => setActiveCategory(idx)}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                  activeCategory === idx
                    ? "bg-orange-500 text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-orange-200 hover:bg-orange-50"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.category}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeCategory === idx
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {cat.tools.length}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 工具列表 */}
        {searchQuery ? (
          // 搜索结果
          <div className="space-y-8">
            {filteredCategories.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <div className="text-5xl mb-3">🔍</div>
                <h3 className="text-gray-800 font-semibold text-lg mb-1">
                  未找到匹配的工具
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  试试搜索其他关键词，如「Word」「合并」「压缩」
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-4 py-2 bg-orange-50 text-orange-600 text-xs font-medium rounded-xl hover:bg-orange-100 transition-colors"
                >
                  清除搜索
                </button>
              </div>
            ) : (
              filteredCategories.map((cat) => (
                <div key={cat.category}>
                  <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span>{cat.category}</span>
                    <span className="text-xs font-normal text-gray-400">
                      ({cat.tools.length} 个结果)
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cat.tools.map((tool) => (
                      <ToolCard key={tool.id} tool={tool} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          // 分类展示
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span>{PDF_TOOLS[activeCategory].icon}</span>
                <span>{PDF_TOOLS[activeCategory].category}</span>
              </h2>
              <span className="text-xs text-gray-400">
                {PDF_TOOLS[activeCategory].desc}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PDF_TOOLS[activeCategory].tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="mt-12 bg-white rounded-2xl border border-gray-100 p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
            <span>💡</span>
            <span>使用说明</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">选择工具</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  根据你的需求选择对应的 PDF 工具，支持格式转换、合并拆分、压缩加密等
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">上传文件</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  拖拽或点击上传你的 PDF 文件，支持批量上传，文件在浏览器端处理
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">下载结果</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  处理完成后一键下载，文件不会上传到服务器，保护你的隐私安全
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 特点展示 */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: "🔒", title: "隐私安全", desc: "本地处理，文件不上传" },
            { icon: "⚡", title: "极速转换", desc: "秒级完成，无需等待" },
            { icon: "🎯", title: "精准还原", desc: "格式无损，高度保真" },
            { icon: "💰", title: "完全免费", desc: "无限制，无水印" },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-xl p-4 border border-gray-100 text-center"
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="font-semibold text-gray-900 text-sm">{item.title}</div>
              <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}

// ============ 工具卡片组件 ============
function ToolCard({ tool }: { tool: PdfTool }) {
  const isComing = tool.status === "coming";
  const isPopular = tool.status === "popular";

  return (
    <div
      className={`bg-white rounded-2xl border overflow-hidden transition-all group ${
        isComing
          ? "border-gray-100 opacity-75"
          : "border-gray-100 hover:border-orange-200 hover:shadow-lg cursor-pointer"
      }`}
    >
      {/* 顶部渐变条 */}
      <div className={`h-2 bg-gradient-to-r ${tool.gradient}`} />

      <div className="p-5">
        {/* 头部 */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center text-xl flex-shrink-0 shadow-md`}
          >
            {tool.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors truncate">
                {tool.name}
              </h3>
              {isPopular && (
                <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded-full font-medium">
                  热门
                </span>
              )}
              {isComing && (
                <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">
                  即将上线
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {tool.description}
            </p>
          </div>
        </div>

        {/* 格式转换信息 */}
        {tool.fromFormats && tool.toFormats && (
          <div className="mb-3 flex items-center gap-2 text-xs">
            <div className="flex flex-wrap gap-1">
              {tool.fromFormats.slice(0, 3).map((f) => (
                <span
                  key={f}
                  className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-mono text-[10px]"
                >
                  {f}
                </span>
              ))}
              {tool.fromFormats.length > 3 && (
                <span className="text-gray-400 text-[10px]">+{tool.fromFormats.length - 3}</span>
              )}
            </div>
            <span className="text-gray-300">→</span>
            <div className="flex flex-wrap gap-1">
              {tool.toFormats.slice(0, 3).map((f) => (
                <span
                  key={f}
                  className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded font-mono text-[10px]"
                >
                  {f}
                </span>
              ))}
              {tool.toFormats.length > 3 && (
                <span className="text-gray-400 text-[10px]">+{tool.toFormats.length - 3}</span>
              )}
            </div>
          </div>
        )}

        {/* 特性标签 */}
        {tool.features && tool.features.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tool.features.map((f) => (
              <span
                key={f}
                className="text-[10px] px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full"
              >
                ✓ {f}
              </span>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <button
          disabled={isComing}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${
            isComing
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 shadow-sm"
          }`}
        >
          {isComing ? "敬请期待" : "立即使用"}
          {!isComing && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
