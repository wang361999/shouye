"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import Container from "@/components/common/Container";
import toast from "react-hot-toast";
import { PDFDocument, degrees, StandardFonts, rgb } from "pdf-lib";
import jsPDF from "jspdf";

type ToolKey =
  | "merge"
  | "split"
  | "compress"
  | "watermark"
  | "encrypt"
  | "img-to-pdf"
  | "pdf-to-img"
  | "pdf-to-txt"
  | "txt-to-pdf"
  | "rotate";

interface PdfFile {
  id: string;
  file: File;
  name: string;
  size: string;
  pages?: number;
}

interface ImageFile {
  id: string;
  file: File;
  name: string;
  url: string;
}

const TOOLS: { key: ToolKey; name: string; icon: string; desc: string }[] = [
  { key: "merge", name: "合并 PDF", icon: "🔗", desc: "多个 PDF 合并为一个" },
  { key: "split", name: "拆分 PDF", icon: "✂️", desc: "按页数拆分 PDF" },
  { key: "compress", name: "压缩 PDF", icon: "📦", desc: "减小 PDF 文件大小" },
  { key: "watermark", name: "添加水印", icon: "💧", desc: "添加文字/图片水印" },
  { key: "encrypt", name: "加密解密", icon: "🔐", desc: "密码保护/解除密码" },
  { key: "rotate", name: "旋转页面", icon: "🔄", desc: "旋转 PDF 页面方向" },
  { key: "img-to-pdf", name: "图片转 PDF", icon: "🖼️", desc: "图片转 PDF 文档" },
  { key: "pdf-to-img", name: "PDF 转图片", icon: "📸", desc: "PDF 页面转图片" },
  { key: "pdf-to-txt", name: "PDF 转文本", icon: "📝", desc: "提取 PDF 文字内容" },
  { key: "txt-to-pdf", name: "文本转 PDF", icon: "📄", desc: "文字/Markdown 转 PDF" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function PdfToolsPage() {
  const [activeTool, setActiveTool] = useState<ToolKey>("merge");

  return (
    <div className="min-h-screen bg-gray-50">
      <Container className="py-8 max-w-5xl">
        {/* 返回 */}
        <div className="mb-6">
          <Link
            href="/tools"
            className="text-sm text-gray-500 hover:text-orange-600 transition-colors"
          >
            ← 返回工具列表
          </Link>
        </div>

        {/* 头部 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 via-orange-500 to-amber-500 p-8 text-white shadow-lg mb-8">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-medium text-white mb-4">
              <span>📄</span>
              <span>PDF 工具箱</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">
              一站式 PDF 处理工具
            </h1>
            <p className="text-orange-100 text-sm md:text-base">
              所有操作在浏览器本地完成，文件不上传服务器，保护你的隐私
            </p>
          </div>
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* 工具切换 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {TOOLS.map((tool) => (
            <button
              key={tool.key}
              onClick={() => setActiveTool(tool.key)}
              className={`p-4 rounded-xl border transition-all text-left ${
                activeTool === tool.key
                  ? "border-orange-400 bg-orange-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/50"
              }`}
            >
              <div className="text-2xl mb-2">{tool.icon}</div>
              <div className="font-semibold text-gray-900 text-sm">{tool.name}</div>
              <div className="text-xs text-gray-500 mt-1">{tool.desc}</div>
            </button>
          ))}
        </div>

        {/* 工具内容 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
          {activeTool === "merge" && <MergeTool />}
          {activeTool === "split" && <SplitTool />}
          {activeTool === "compress" && <CompressTool />}
          {activeTool === "watermark" && <WatermarkTool />}
          {activeTool === "encrypt" && <EncryptTool />}
          {activeTool === "rotate" && <RotateTool />}
          {activeTool === "img-to-pdf" && <ImageToPdfTool />}
          {activeTool === "pdf-to-img" && <PdfToImageTool />}
          {activeTool === "pdf-to-txt" && <PdfToTextTool />}
          {activeTool === "txt-to-pdf" && <TextToPdfTool />}
        </div>

        {/* 特点 */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: "🔒", title: "隐私安全", desc: "本地处理，不上传" },
            { icon: "⚡", title: "极速处理", desc: "秒级完成" },
            { icon: "🎯", title: "无损质量", desc: "保持原始画质" },
            { icon: "💰", title: "完全免费", desc: "无限制使用" },
          ].map((item) => (
            <div key={item.title} className="bg-white rounded-xl p-4 border border-gray-100 text-center">
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

// ============ 合并 PDF 工具 ============
function MergeTool() {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string; size: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragOver = useRef(false);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const pdfFiles = Array.from(fileList).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length === 0) {
      toast.error("请选择 PDF 文件");
      return;
    }

    const newFiles: PdfFile[] = [];
    for (const file of pdfFiles) {
      let pageCount = 0;
      try {
        const buf = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(buf);
        pageCount = pdfDoc.getPageCount();
      } catch {}
      newFiles.push({
        id: Math.random().toString(36).slice(2),
        file,
        name: file.name,
        size: formatSize(file.size),
        pages: pageCount,
      });
    }
    setFiles((prev) => [...prev, ...newFiles]);
    setResult(null);
    toast.success(`已添加 ${newFiles.length} 个 PDF 文件`);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragOver.current = false;
      if (e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setResult(null);
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= newFiles.length) return prev;
      [newFiles[index], newFiles[newIndex]] = [newFiles[newIndex], newFiles[index]];
      return newFiles;
    });
    setResult(null);
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast.error("至少需要 2 个 PDF 文件才能合并");
      return;
    }
    try {
      setProcessing(true);
      const mergedPdf = await PDFDocument.create();

      for (const pdfFile of files) {
        const buf = await pdfFile.file.arrayBuffer();
        const pdf = await PDFDocument.load(buf);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(mergedBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setResult({
        url,
        name: "merged.pdf",
        size: formatSize(mergedBytes.length),
      });
      toast.success("合并成功！");
    } catch (err) {
      console.error(err);
      toast.error("合并失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.name;
    a.click();
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">合并 PDF</h2>
      <p className="text-sm text-gray-500 mb-6">
        将多个 PDF 文件合并为一个，支持拖拽调整顺序
      </p>

      {/* 上传区域 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          dragOver.current = true;
        }}
        onDragLeave={() => (dragOver.current = false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all mb-6"
      >
        <div className="text-4xl mb-3">📁</div>
        <p className="text-gray-700 font-medium">点击或拖拽 PDF 文件到这里</p>
        <p className="text-xs text-gray-400 mt-1">支持多个 PDF 文件，批量上传</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              已选择 {files.length} 个文件
            </span>
            <button
              onClick={() => {
                setFiles([]);
                setResult(null);
              }}
              className="text-xs text-gray-400 hover:text-red-500"
            >
              清空全部
            </button>
          </div>
          {files.map((f, i) => (
            <div
              key={f.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
            >
              <span className="text-sm font-medium text-gray-400 w-6 text-center">{i + 1}</span>
              <div className="text-xl">📄</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{f.name}</div>
                <div className="text-xs text-gray-500">
                  {f.size}
                  {f.pages ? ` · ${f.pages} 页` : ""}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveFile(i, -1)}
                  disabled={i === 0}
                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveFile(i, 1)}
                  disabled={i === files.length - 1}
                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeFile(f.id)}
                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 结果 */}
      {result && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="text-2xl">✅</div>
            <div className="flex-1">
              <div className="font-medium text-green-900">合并完成</div>
              <div className="text-xs text-green-700">{result.name} · {result.size}</div>
            </div>
            <button
              onClick={downloadResult}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              下载文件
            </button>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleMerge}
          disabled={files.length < 2 || processing}
          className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {processing ? "合并中..." : "开始合并"}
        </button>
      </div>
    </div>
  );
}

// ============ 拆分 PDF 工具 ============
function SplitTool() {
  const [file, setFile] = useState<PdfFile | null>(null);
  const [splitMode, setSplitMode] = useState<"range" | "every">("range");
  const [pageRange, setPageRange] = useState("");
  const [everyN, setEveryN] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{ url: string; name: string; size: string; pages: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const f = fileList[0];
    if (!f.type.includes("pdf") && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("请选择 PDF 文件");
      return;
    }

    let pageCount = 0;
    try {
      const buf = await f.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buf);
      pageCount = pdfDoc.getPageCount();
    } catch {}

    setFile({
      id: Math.random().toString(36).slice(2),
      file: f,
      name: f.name,
      size: formatSize(f.size),
      pages: pageCount,
    });
    setResults([]);
  };

  const handleSplit = async () => {
    if (!file) {
      toast.error("请先选择 PDF 文件");
      return;
    }
    try {
      setProcessing(true);
      const buf = await file.file.arrayBuffer();
      const srcPdf = await PDFDocument.load(buf);
      const totalPages = srcPdf.getPageCount();
      const outputFiles: { url: string; name: string; size: string; pages: number }[] = [];

      if (splitMode === "range") {
        // 按范围拆分，如 "1-3, 5, 7-10"
        const ranges = pageRange
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean);

        if (ranges.length === 0) {
          toast.error("请输入拆分范围");
          return;
        }

        for (let i = 0; i < ranges.length; i++) {
          const range = ranges[i];
          let startPage = 1;
          let endPage = totalPages;

          if (range.includes("-")) {
            const [s, e] = range.split("-").map((n) => parseInt(n.trim()));
            startPage = s;
            endPage = e;
          } else {
            const n = parseInt(range.trim());
            startPage = n;
            endPage = n;
          }

          if (startPage < 1 || endPage > totalPages || startPage > endPage) {
            toast.error(`范围 "${range}" 无效，总页数：${totalPages}`);
            return;
          }

          const newPdf = await PDFDocument.create();
          const indices: number[] = [];
          for (let p = startPage; p <= endPage; p++) {
            indices.push(p - 1);
          }
          const pages = await newPdf.copyPages(srcPdf, indices);
          pages.forEach((page) => newPdf.addPage(page));

          const bytes = await newPdf.save();
          const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          outputFiles.push({
            url,
            name: `${file.name.replace(/\.pdf$/i, "")}_part${i + 1}(${startPage}-${endPage}).pdf`,
            size: formatSize(bytes.length),
            pages: endPage - startPage + 1,
          });
        }
      } else {
        // 每隔 N 页拆分
        if (everyN < 1) {
          toast.error("每页数量不能小于 1");
          return;
        }
        let partNum = 1;
        for (let i = 0; i < totalPages; i += everyN) {
          const end = Math.min(i + everyN, totalPages);
          const newPdf = await PDFDocument.create();
          const indices: number[] = [];
          for (let p = i; p < end; p++) {
            indices.push(p);
          }
          const pages = await newPdf.copyPages(srcPdf, indices);
          pages.forEach((page) => newPdf.addPage(page));

          const bytes = await newPdf.save();
          const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          outputFiles.push({
            url,
            name: `${file.name.replace(/\.pdf$/i, "")}_part${partNum}.pdf`,
            size: formatSize(bytes.length),
            pages: end - i,
          });
          partNum++;
        }
      }

      setResults(outputFiles);
      toast.success(`拆分成功，共 ${outputFiles.length} 个文件`);
    } catch (err) {
      console.error(err);
      toast.error("拆分失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setProcessing(false);
    }
  };

  const downloadAll = () => {
    results.forEach((r, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = r.url;
        a.download = r.name;
        a.click();
      }, i * 500);
    });
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">拆分 PDF</h2>
      <p className="text-sm text-gray-500 mb-6">
        按页码范围或固定页数拆分 PDF 文件
      </p>

      {/* 上传区域 */}
      {!file ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all mb-6"
        >
          <div className="text-4xl mb-3">✂️</div>
          <p className="text-gray-700 font-medium">点击选择要拆分的 PDF 文件</p>
          <p className="text-xs text-gray-400 mt-1">支持任意大小的 PDF 文件</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files)}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6">
          <div className="text-2xl">📄</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">{file.name}</div>
            <div className="text-xs text-gray-500">
              {file.size}
              {file.pages ? ` · ${file.pages} 页` : ""}
            </div>
          </div>
          <button
            onClick={() => {
              setFile(null);
              setResults([]);
            }}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            重新选择
          </button>
        </div>
      )}

      {/* 拆分方式 */}
      {file && (
        <div className="mb-6 space-y-4">
          <div className="flex gap-3">
            <button
              onClick={() => setSplitMode("range")}
              className={`flex-1 p-3 rounded-lg border text-left transition-all ${
                splitMode === "range"
                  ? "border-orange-400 bg-orange-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-sm text-gray-900">按页码范围</div>
              <div className="text-xs text-gray-500 mt-1">如 1-3, 5, 7-10</div>
            </button>
            <button
              onClick={() => setSplitMode("every")}
              className={`flex-1 p-3 rounded-lg border text-left transition-all ${
                splitMode === "every"
                  ? "border-orange-400 bg-orange-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-sm text-gray-900">每隔 N 页</div>
              <div className="text-xs text-gray-500 mt-1">每 N 页拆分为一个文件</div>
            </button>
          </div>

          {splitMode === "range" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                页码范围
              </label>
              <input
                type="text"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                placeholder="例如：1-5, 8, 10-15"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                用逗号分隔多个范围，支持单页（如 5）和区间（如 1-3）
                {file.pages && ` · 共 ${file.pages} 页`}
              </p>
            </div>
          )}

          {splitMode === "every" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                每页数量
              </label>
              <input
                type="number"
                min={1}
                value={everyN}
                onChange={(e) => setEveryN(parseInt(e.target.value) || 1)}
                className="w-32 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                每隔 {everyN} 页拆分为一个文件
                {file.pages && ` · 将生成 ${Math.ceil(file.pages / everyN)} 个文件`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 结果 */}
      {results.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✅</span>
              <span className="font-medium text-gray-900 text-sm">
                拆分完成，共 {results.length} 个文件
              </span>
            </div>
            <button
              onClick={downloadAll}
              className="text-xs text-orange-600 hover:text-orange-700 font-medium"
            >
              全部下载
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg"
              >
                <div className="text-lg">📄</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{r.name}</div>
                  <div className="text-xs text-gray-500">
                    {r.size} · {r.pages} 页
                  </div>
                </div>
                <a
                  href={r.url}
                  download={r.name}
                  className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                >
                  下载
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      {file && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleSplit}
            disabled={processing}
            className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {processing ? "拆分中..." : "开始拆分"}
          </button>
        </div>
      )}
    </div>
  );
}

// ============ 压缩 PDF 工具 ============
function CompressTool() {
  const [file, setFile] = useState<PdfFile | null>(null);
  const [level, setLevel] = useState<"low" | "medium" | "high">("medium");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string; size: string; saved: string } | null>(null);
  const [pdfjsReady, setPdfjsReady] = useState(false);
  const pdfjsRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 初始化 pdf.js（用于高级压缩的光栅化）
  useEffect(() => {
    if (typeof window === "undefined") return;
    // @ts-ignore
    if (window.pdfjsLib) {
      pdfjsRef.current = (window as any).pdfjsLib;
      setPdfjsReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      // @ts-ignore
      const pdfjs = window.pdfjsLib;
      if (pdfjs) {
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        pdfjsRef.current = pdfjs;
        setPdfjsReady(true);
      }
    };
    script.onerror = () => {
      console.error("pdf.js CDN 加载失败");
    };
    document.head.appendChild(script);
  }, []);

  const handleFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const f = fileList[0];
    if (!f.type.includes("pdf") && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("请选择 PDF 文件");
      return;
    }

    let pageCount = 0;
    try {
      const buf = await f.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buf);
      pageCount = pdfDoc.getPageCount();
    } catch {}

    setFile({
      id: Math.random().toString(36).slice(2),
      file: f,
      name: f.name,
      size: formatSize(f.size),
      pages: pageCount,
    });
    setResult(null);
  };

  const handleCompress = async () => {
    if (!file) {
      toast.error("请先选择 PDF 文件");
      return;
    }
    try {
      setProcessing(true);
      const buf = await file.file.arrayBuffer();
      const originalSize = file.file.size;
      let compressedBytes: Uint8Array;

      if (level === "low") {
        // 轻度：结构优化（useObjectStreams + 去除元数据）
        const srcPdf = await PDFDocument.load(buf);
        srcPdf.setTitle("");
        srcPdf.setAuthor("");
        srcPdf.setSubject("");
        srcPdf.setKeywords([]);
        srcPdf.setProducer("");
        srcPdf.setCreator("");
        const newPdf = await PDFDocument.create();
        const pages = await newPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        pages.forEach((page) => newPdf.addPage(page));
        compressedBytes = await newPdf.save({ useObjectStreams: true });
      } else if (level === "medium") {
        // 中度：结构优化 + 光栅化（中等质量 JPEG）
        compressedBytes = await rasterizeCompress(buf, 1.5, 0.8);
      } else {
        // 高强度：光栅化（低 DPI + 高压缩 JPEG）
        compressedBytes = await rasterizeCompress(buf, 1.0, 0.6);
      }

      const compressedSize = compressedBytes.length;
      const savedPercent = Math.max(0, ((originalSize - compressedSize) / originalSize) * 100).toFixed(1);

      const blob = new Blob([new Uint8Array(compressedBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setResult({
        url,
        name: `${file.name.replace(/\.pdf$/i, "")}_compressed.pdf`,
        size: formatSize(compressedSize),
        saved: savedPercent,
      });

      if (parseFloat(savedPercent) > 0) {
        toast.success(`压缩成功！减少了 ${savedPercent}%`);
      } else {
        toast.success("压缩完成（文件已经很紧凑了）");
      }
    } catch (err) {
      console.error(err);
      toast.error("压缩失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setProcessing(false);
    }
  };

  // 光栅化压缩：将每页渲染为 JPEG 图片，重新构建 PDF
  const rasterizeCompress = async (buf: ArrayBuffer, scale: number, quality: number): Promise<Uint8Array> => {
    if (!pdfjsReady || !pdfjsRef.current) {
      throw new Error("PDF 引擎未加载完成，请稍候再试");
    }

    const pdf = await pdfjsRef.current.getDocument({ data: new Uint8Array(buf) }).promise;
    const totalPages = pdf.numPages;
    const newPdf = await PDFDocument.create();

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      // 白色背景
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 渲染页面
      await page.render({ canvasContext: ctx, viewport }).promise;

      // 转 JPEG
      const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
      const jpegBase64 = jpegDataUrl.split(",")[1];
      const jpegBytes = Uint8Array.from(atob(jpegBase64), (c) => c.charCodeAt(0));

      // 嵌入到新 PDF
      const img = await newPdf.embedJpg(jpegBytes);
      const pdfPage = newPdf.addPage([viewport.width, viewport.height]);
      pdfPage.drawImage(img, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      });
    }

    return newPdf.save({ useObjectStreams: true });
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">压缩 PDF</h2>
      <p className="text-sm text-gray-500 mb-6">
        减小 PDF 文件大小，支持结构优化和光栅化压缩
      </p>

      {!file ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all mb-6"
        >
          <div className="text-4xl mb-3">📦</div>
          <p className="text-gray-700 font-medium">点击选择要压缩的 PDF 文件</p>
          <p className="text-xs text-gray-400 mt-1">支持任意大小的 PDF 文件</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files)}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6">
          <div className="text-2xl">📄</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">{file.name}</div>
            <div className="text-xs text-gray-500">
              {file.size}
              {file.pages ? ` · ${file.pages} 页` : ""}
            </div>
          </div>
          <button
            onClick={() => {
              setFile(null);
              setResult(null);
            }}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            重新选择
          </button>
        </div>
      )}

      {file && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">压缩强度</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "low", label: "轻度", desc: "结构优化，画质无损" },
              { key: "medium", label: "推荐", desc: "光栅化压缩，平衡质量" },
              { key: "high", label: "强力", desc: "低清光栅化，体积最小" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setLevel(item.key as any);
                  setResult(null);
                }}
                className={`p-3 rounded-lg border text-left transition-all ${
                  level === item.key
                    ? "border-orange-400 bg-orange-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-sm text-gray-900">{item.label}</div>
                <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
              </button>
            ))}
          </div>
          {level !== "low" && (
            <p className="text-xs text-amber-600 mt-3">
              💡 光栅化压缩会将页面转为图片，文字将不可选。适合以图片为主的 PDF。
            </p>
          )}
        </div>
      )}

      {result && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="text-2xl">✅</div>
            <div className="flex-1">
              <div className="font-medium text-green-900">压缩完成</div>
              <div className="text-xs text-green-700">
                {result.size} · 减少 {result.saved}%
              </div>
            </div>
            <a
              href={result.url}
              download={result.name}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              下载
            </a>
          </div>
        </div>
      )}

      {file && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleCompress}
            disabled={processing || (level !== "low" && !pdfjsReady)}
            className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {processing ? "压缩中..." : "开始压缩"}
          </button>
        </div>
      )}
    </div>
  );
}

// ============ 添加水印工具 ============
function WatermarkTool() {
  const [file, setFile] = useState<PdfFile | null>(null);
  const [text, setText] = useState("机密文件");
  const [opacity, setOpacity] = useState(0.2);
  const [rotation, setRotation] = useState(45);
  const [fontSize, setFontSize] = useState(50);
  const [color, setColor] = useState("#cccccc");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string; size: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const f = fileList[0];
    if (!f.type.includes("pdf") && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("请选择 PDF 文件");
      return;
    }

    let pageCount = 0;
    try {
      const buf = await f.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buf);
      pageCount = pdfDoc.getPageCount();
    } catch {}

    setFile({
      id: Math.random().toString(36).slice(2),
      file: f,
      name: f.name,
      size: formatSize(f.size),
      pages: pageCount,
    });
    setResult(null);
  };

  const handleAddWatermark = async () => {
    if (!file) {
      toast.error("请先选择 PDF 文件");
      return;
    }
    if (!text.trim()) {
      toast.error("请输入水印文字");
      return;
    }
    try {
      setProcessing(true);
      const buf = await file.file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buf);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const pages = pdfDoc.getPages();
      const watermarkText = text;

      for (const page of pages) {
        const { width, height } = page.getSize();
        const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, fontSize);
        const textHeight = fontSize;

        // 绘制平铺水印
        const cols = Math.ceil(width / (textWidth + 100));
        const rows = Math.ceil(height / (textHeight + 150));

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const x = col * (textWidth + 100) + 50;
            const y = row * (textHeight + 150) + 80;

            page.drawText(watermarkText, {
              x,
              y,
              size: fontSize,
              font: helveticaFont,
              color: rgb(
                parseInt(color.slice(1, 3), 16) / 255,
                parseInt(color.slice(3, 5), 16) / 255,
                parseInt(color.slice(5, 7), 16) / 255
              ),
              opacity,
              rotate: degrees(rotation),
            });
          }
        }
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setResult({
        url,
        name: `${file.name.replace(/\.pdf$/i, "")}_watermarked.pdf`,
        size: formatSize(bytes.length),
      });
      toast.success("水印添加成功！");
    } catch (err) {
      console.error(err);
      toast.error("添加失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">添加水印</h2>
      <p className="text-sm text-gray-500 mb-6">
        为 PDF 添加文字水印，保护文档版权
      </p>

      {!file ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all mb-6"
        >
          <div className="text-4xl mb-3">💧</div>
          <p className="text-gray-700 font-medium">点击选择要添加水印的 PDF</p>
          <p className="text-xs text-gray-400 mt-1">支持平铺文字水印</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files)}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6">
          <div className="text-2xl">📄</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">{file.name}</div>
            <div className="text-xs text-gray-500">
              {file.size}
              {file.pages ? ` · ${file.pages} 页` : ""}
            </div>
          </div>
          <button
            onClick={() => {
              setFile(null);
              setResult(null);
            }}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            重新选择
          </button>
        </div>
      )}

      {file && (
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">水印文字</label>
            <input
              type="text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setResult(null);
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                透明度：{opacity.toFixed(2)}
              </label>
              <input
                type="range"
                min={0.05}
                max={0.8}
                step={0.05}
                value={opacity}
                onChange={(e) => {
                  setOpacity(parseFloat(e.target.value));
                  setResult(null);
                }}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                角度：{rotation}°
              </label>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={rotation}
                onChange={(e) => {
                  setRotation(parseInt(e.target.value));
                  setResult(null);
                }}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                字号：{fontSize}
              </label>
              <input
                type="range"
                min={12}
                max={100}
                step={2}
                value={fontSize}
                onChange={(e) => {
                  setFontSize(parseInt(e.target.value));
                  setResult(null);
                }}
                className="w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">水印颜色</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  setResult(null);
                }}
                className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
              />
              <span className="text-sm text-gray-500 font-mono">{color}</span>
              <div className="flex gap-2">
                {["#cccccc", "#000000", "#ff0000", "#0066ff"].map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setColor(c);
                      setResult(null);
                    }}
                    className="w-6 h-6 rounded border border-gray-300"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="text-2xl">✅</div>
            <div className="flex-1">
              <div className="font-medium text-green-900">水印添加成功</div>
              <div className="text-xs text-green-700">{result.name} · {result.size}</div>
            </div>
            <a
              href={result.url}
              download={result.name}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              下载
            </a>
          </div>
        </div>
      )}

      {file && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleAddWatermark}
            disabled={processing}
            className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {processing ? "处理中..." : "添加水印"}
          </button>
        </div>
      )}
    </div>
  );
}

// ============ 加密解密工具 ============
function EncryptTool() {
  const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [file, setFile] = useState<PdfFile | null>(null);
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [algorithm, setAlgorithm] = useState<"AES-256" | "RC4">("AES-256");
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(true);
  const [allowModifying, setAllowModifying] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string; size: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const f = fileList[0];
    if (!f.type.includes("pdf") && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("请选择 PDF 文件");
      return;
    }

    let pageCount = 0;
    try {
      const buf = await f.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buf);
      pageCount = pdfDoc.getPageCount();
    } catch {
      // 可能是加密的 PDF
      if (mode === "decrypt") {
        toast("检测到可能加密的 PDF，请输入密码", { icon: "🔐" });
      }
    }

    setFile({
      id: Math.random().toString(36).slice(2),
      file: f,
      name: f.name,
      size: formatSize(f.size),
      pages: pageCount || undefined,
    });
    setResult(null);
  };

  const handleProcess = async () => {
    if (!file) {
      toast.error("请先选择 PDF 文件");
      return;
    }
    try {
      setProcessing(true);
      const buf = await file.file.arrayBuffer();
      const pdfBytes = new Uint8Array(buf);

      if (mode === "encrypt") {
        if (!newPassword.trim()) {
          toast.error("请输入加密密码");
          return;
        }
        // 动态导入加密库（避免 SSR 问题）
        const { encryptPDF } = await import("@pdfsmaller/pdf-encrypt");

        const encrypted = await encryptPDF(pdfBytes, newPassword, {
          ownerPassword: ownerPassword || newPassword,
          algorithm,
          allowPrinting,
          allowCopying,
          allowModifying,
          allowAnnotating: allowModifying,
          allowFillingForms: true,
          allowExtraction: allowCopying,
          allowAssembly: allowModifying,
          allowHighQualityPrint: allowPrinting,
        });

        const encryptedBytes = new Uint8Array(encrypted);
        const blob = new Blob([encryptedBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        setResult({
          url,
          name: `${file.name.replace(/\.pdf$/i, "")}_encrypted.pdf`,
          size: formatSize(encryptedBytes.length),
        });
        toast.success(`加密成功！算法：${algorithm}`);
      } else {
        // 解密模式
        if (!password.trim()) {
          toast.error("请输入 PDF 密码");
          return;
        }
        const { decryptPDF } = await import("@pdfsmaller/pdf-decrypt");

        try {
          const decrypted = await decryptPDF(pdfBytes, password);
          const decryptedBytes = new Uint8Array(decrypted);
          const blob = new Blob([decryptedBytes], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);

          setResult({
            url,
            name: `${file.name.replace(/\.pdf$/i, "")}_decrypted.pdf`,
            size: formatSize(decryptedBytes.length),
          });
          toast.success("解密成功！");
        } catch (decryptErr: any) {
          const msg = decryptErr?.message || String(decryptErr);
          if (msg.includes("password") || msg.includes("Incorrect")) {
            toast.error("密码错误，请重试");
          } else if (msg.includes("not encrypted")) {
            toast.error("该 PDF 没有加密，无需解密");
          } else {
            throw decryptErr;
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("处理失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">加密 / 解密 PDF</h2>
      <p className="text-sm text-gray-500 mb-6">
        AES-256 真加密，支持权限控制，所有操作本地完成
      </p>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => {
            setMode("encrypt");
            setResult(null);
          }}
          className={`flex-1 p-3 rounded-lg border text-left transition-all ${
            mode === "encrypt"
              ? "border-orange-400 bg-orange-50"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <div className="font-medium text-sm text-gray-900">🔒 加密 PDF</div>
          <div className="text-xs text-gray-500 mt-1">AES-256 密码保护</div>
        </button>
        <button
          onClick={() => {
            setMode("decrypt");
            setResult(null);
          }}
          className={`flex-1 p-3 rounded-lg border text-left transition-all ${
            mode === "decrypt"
              ? "border-orange-400 bg-orange-50"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <div className="font-medium text-sm text-gray-900">🔓 解密 PDF</div>
          <div className="text-xs text-gray-500 mt-1">解除密码保护</div>
        </button>
      </div>

      {!file ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all mb-6"
        >
          <div className="text-4xl mb-3">🔐</div>
          <p className="text-gray-700 font-medium">
            点击选择要{mode === "encrypt" ? "加密" : "解密"}的 PDF
          </p>
          <p className="text-xs text-gray-400 mt-1">支持加密的 PDF 文件</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files)}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6">
          <div className="text-2xl">📄</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">{file.name}</div>
            <div className="text-xs text-gray-500">
              {file.size}
              {file.pages ? ` · ${file.pages} 页` : ""}
            </div>
          </div>
          <button
            onClick={() => {
              setFile(null);
              setResult(null);
            }}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            重新选择
          </button>
        </div>
      )}

      {file && (
        <div className="mb-6 space-y-4">
          {mode === "encrypt" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">用户密码（打开 PDF 需要）</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setResult(null);
                  }}
                  placeholder="请输入打开密码"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  所有者密码（管理权限需要，可选）
                </label>
                <input
                  type="password"
                  value={ownerPassword}
                  onChange={(e) => {
                    setOwnerPassword(e.target.value);
                    setResult(null);
                  }}
                  placeholder="留空则与用户密码相同"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">加密算法</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setAlgorithm("AES-256");
                      setResult(null);
                    }}
                    className={`flex-1 p-2.5 rounded-lg border text-sm transition-all ${
                      algorithm === "AES-256"
                        ? "border-orange-400 bg-orange-50 text-orange-700"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    AES-256（推荐）
                  </button>
                  <button
                    onClick={() => {
                      setAlgorithm("RC4");
                      setResult(null);
                    }}
                    className={`flex-1 p-2.5 rounded-lg border text-sm transition-all ${
                      algorithm === "RC4"
                        ? "border-orange-400 bg-orange-50 text-orange-700"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    RC4 128-bit（兼容旧设备）
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">权限控制</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowPrinting}
                      onChange={(e) => {
                        setAllowPrinting(e.target.checked);
                        setResult(null);
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                    />
                    <span className="text-sm text-gray-700">允许打印</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowCopying}
                      onChange={(e) => {
                        setAllowCopying(e.target.checked);
                        setResult(null);
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                    />
                    <span className="text-sm text-gray-700">允许复制文字和图片</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowModifying}
                      onChange={(e) => {
                        setAllowModifying(e.target.checked);
                        setResult(null);
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                    />
                    <span className="text-sm text-gray-700">允许修改文档内容</span>
                  </label>
                </div>
              </div>
            </>
          )}
          {mode === "decrypt" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">PDF 密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setResult(null);
                }}
                placeholder="请输入 PDF 打开密码"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
              />
              <p className="text-xs text-gray-400 mt-2">
                支持 AES-256 和 RC4 加密的 PDF，自动检测加密类型
              </p>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="text-2xl">✅</div>
            <div className="flex-1">
              <div className="font-medium text-green-900">
                {mode === "encrypt" ? "加密完成" : "解密成功"}
              </div>
              <div className="text-xs text-green-700">{result.name} · {result.size}</div>
            </div>
            <a
              href={result.url}
              download={result.name}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              下载
            </a>
          </div>
        </div>
      )}

      {file && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleProcess}
            disabled={processing}
            className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {processing ? "处理中..." : mode === "encrypt" ? "开始加密" : "开始解密"}
          </button>
        </div>
      )}
    </div>
  );
}

// ============ 旋转页面工具 ============
function RotateTool() {
  const [file, setFile] = useState<PdfFile | null>(null);
  const [rotation, setRotation] = useState(90);
  const [scope, setScope] = useState<"all" | "range">("all");
  const [pageRange, setPageRange] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string; size: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const f = fileList[0];
    if (!f.type.includes("pdf") && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("请选择 PDF 文件");
      return;
    }

    let pageCount = 0;
    try {
      const buf = await f.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buf);
      pageCount = pdfDoc.getPageCount();
    } catch {}

    setFile({
      id: Math.random().toString(36).slice(2),
      file: f,
      name: f.name,
      size: formatSize(f.size),
      pages: pageCount,
    });
    setResult(null);
  };

  const handleRotate = async () => {
    if (!file) {
      toast.error("请先选择 PDF 文件");
      return;
    }
    try {
      setProcessing(true);
      const buf = await file.file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buf);
      const totalPages = pdfDoc.getPageCount();

      let targetPages: number[] = [];
      if (scope === "all") {
        for (let i = 0; i < totalPages; i++) {
          targetPages.push(i);
        }
      } else {
        const ranges = pageRange
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (const range of ranges) {
          if (range.includes("-")) {
            const [s, e] = range.split("-").map((n) => parseInt(n.trim()));
            for (let p = s; p <= e; p++) {
              if (p >= 1 && p <= totalPages) {
                targetPages.push(p - 1);
              }
            }
          } else {
            const n = parseInt(range.trim());
            if (n >= 1 && n <= totalPages) {
              targetPages.push(n - 1);
            }
          }
        }
        if (targetPages.length === 0) {
          toast.error("请输入有效的页码范围");
          return;
        }
      }

      for (const pageIdx of targetPages) {
        const page = pdfDoc.getPage(pageIdx);
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees(currentRotation + rotation));
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setResult({
        url,
        name: `${file.name.replace(/\.pdf$/i, "")}_rotated.pdf`,
        size: formatSize(bytes.length),
      });
      toast.success(`旋转成功！共 ${targetPages.length} 页`);
    } catch (err) {
      console.error(err);
      toast.error("旋转失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">旋转 PDF 页面</h2>
      <p className="text-sm text-gray-500 mb-6">
        调整 PDF 页面的方向，支持 90°/180°/270° 旋转
      </p>

      {!file ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all mb-6"
        >
          <div className="text-4xl mb-3">🔄</div>
          <p className="text-gray-700 font-medium">点击选择要旋转的 PDF</p>
          <p className="text-xs text-gray-400 mt-1">支持顺时针旋转</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files)}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6">
          <div className="text-2xl">📄</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">{file.name}</div>
            <div className="text-xs text-gray-500">
              {file.size}
              {file.pages ? ` · ${file.pages} 页` : ""}
            </div>
          </div>
          <button
            onClick={() => {
              setFile(null);
              setResult(null);
            }}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            重新选择
          </button>
        </div>
      )}

      {file && (
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">旋转角度</label>
            <div className="grid grid-cols-4 gap-3">
              {[90, 180, 270, -90].map((deg) => (
                <button
                  key={deg}
                  onClick={() => {
                    setRotation(deg);
                    setResult(null);
                  }}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    rotation === deg
                      ? "border-orange-400 bg-orange-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="text-lg">↻</div>
                  <div className="text-sm font-medium text-gray-900">
                    {deg > 0 ? deg : 360 + deg}°
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">旋转范围</label>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setScope("all");
                  setResult(null);
                }}
                className={`flex-1 p-2.5 rounded-lg border text-sm transition-all ${
                  scope === "all"
                    ? "border-orange-400 bg-orange-50 text-orange-700"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                全部页面
              </button>
              <button
                onClick={() => {
                  setScope("range");
                  setResult(null);
                }}
                className={`flex-1 p-2.5 rounded-lg border text-sm transition-all ${
                  scope === "range"
                    ? "border-orange-400 bg-orange-50 text-orange-700"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                指定页码
              </button>
            </div>
          </div>

          {scope === "range" && (
            <div>
              <input
                type="text"
                value={pageRange}
                onChange={(e) => {
                  setPageRange(e.target.value);
                  setResult(null);
                }}
                placeholder="例如：1-3, 5, 7-9"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                用逗号分隔，支持区间
                {file.pages && ` · 共 ${file.pages} 页`}
              </p>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="text-2xl">✅</div>
            <div className="flex-1">
              <div className="font-medium text-green-900">旋转完成</div>
              <div className="text-xs text-green-700">{result.name} · {result.size}</div>
            </div>
            <a
              href={result.url}
              download={result.name}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              下载
            </a>
          </div>
        </div>
      )}

      {file && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleRotate}
            disabled={processing}
            className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {processing ? "处理中..." : "开始旋转"}
          </button>
        </div>
      )}
    </div>
  );
}

// ============ PDF 转文本工具 ============
function PdfToTextTool() {
  const [file, setFile] = useState<PdfFile | null>(null);
  const [text, setText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [pdfjsReady, setPdfjsReady] = useState(false);
  const pdfjsRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 初始化 pdf.js（从 CDN 加载，避免 SSR 问题）
  useEffect(() => {
    if (typeof window === "undefined") return;
    // @ts-ignore
    if (window.pdfjsLib) {
      pdfjsRef.current = (window as any).pdfjsLib;
      setPdfjsReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      // @ts-ignore
      const pdfjs = window.pdfjsLib;
      if (pdfjs) {
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        pdfjsRef.current = pdfjs;
        setPdfjsReady(true);
      }
    };
    script.onerror = () => {
      console.error("pdf.js CDN 加载失败");
    };
    document.head.appendChild(script);
  }, []);

  const handleFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const f = fileList[0];
    if (!f.type.includes("pdf") && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("请选择 PDF 文件");
      return;
    }

    let pageCount = 0;
    try {
      const buf = await f.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buf);
      pageCount = pdfDoc.getPageCount();
    } catch {}

    setFile({
      id: Math.random().toString(36).slice(2),
      file: f,
      name: f.name,
      size: formatSize(f.size),
      pages: pageCount,
    });
    setText("");
  };

  const handleExtract = async () => {
    if (!file) {
      toast.error("请先选择 PDF 文件");
      return;
    }
    if (!pdfjsReady || !pdfjsRef.current) {
      toast.error("PDF 引擎加载中，请稍候再试");
      return;
    }
    try {
      setProcessing(true);
      const arrayBuffer = await file.file.arrayBuffer();

      // 使用 pdf.js 提取文本
      const pdf = await pdfjsRef.current.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      let fullText = "";

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        fullText += `--- 第 ${i} 页 ---\n${pageText}\n\n`;
      }

      setText(fullText);
      toast.success(`提取成功！共 ${totalPages} 页`);
    } catch (err) {
      console.error(err);
      toast.error("提取失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setProcessing(false);
    }
  };

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("已复制到剪贴板");
  };

  const handleDownload = () => {
    if (!text || !file) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.name.replace(/\.pdf$/i, "")}.txt`;
    a.click();
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">PDF 转文本</h2>
      <p className="text-sm text-gray-500 mb-6">
        提取 PDF 中的文字内容，支持复制和下载
      </p>

      {!file ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all mb-6"
        >
          <div className="text-4xl mb-3">📝</div>
          <p className="text-gray-700 font-medium">点击选择要提取文字的 PDF</p>
          <p className="text-xs text-gray-400 mt-1">支持文字型 PDF（扫描件需 OCR）</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files)}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6">
          <div className="text-2xl">📄</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">{file.name}</div>
            <div className="text-xs text-gray-500">
              {file.size}
              {file.pages ? ` · ${file.pages} 页` : ""}
            </div>
          </div>
          <button
            onClick={() => {
              setFile(null);
              setText("");
            }}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            重新选择
          </button>
        </div>
      )}

      {text && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">提取结果</label>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
              >
                复制全部
              </button>
              <button
                onClick={handleDownload}
                className="text-xs px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
              >
                下载 TXT
              </button>
            </div>
          </div>
          <textarea
            value={text}
            readOnly
            className="w-full h-64 p-3 text-sm border border-gray-200 rounded-lg bg-gray-50 font-mono resize-y focus:outline-none"
          />
        </div>
      )}

      {file && !text && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            💡 提示：仅支持提取文字型 PDF 中的文字。扫描件或图片 PDF 需要 OCR 识别。
          </p>
        </div>
      )}

      {file && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleExtract}
            disabled={processing || !pdfjsReady}
            className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {processing ? "提取中..." : "提取文字"}
          </button>
        </div>
      )}
    </div>
  );
}

// ============ 文本转 PDF 工具 ============
function TextToPdfTool() {
  const [text, setText] = useState("在这里输入你的文字内容...\n\n支持多行文本，自动分页。\n可以是纯文字，也可以是简单的 Markdown。");
  const [title, setTitle] = useState("我的文档");
  const [fontSize, setFontSize] = useState(12);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string; size: string } | null>(null);

  const handleConvert = async () => {
    if (!text.trim()) {
      toast.error("请输入文字内容");
      return;
    }
    try {
      setProcessing(true);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginLeft = 20;
      const marginRight = 20;
      const marginTop = 25;
      const marginBottom = 20;
      const contentWidth = pageWidth - marginLeft - marginRight;

      // 设置字体
      pdf.setFont("helvetica");
      pdf.setFontSize(fontSize);

      let y = marginTop;
      const lineHeight = fontSize * 0.45;

      // 标题
      if (title.trim()) {
        pdf.setFontSize(fontSize + 4);
        pdf.setFont("helvetica", "bold");
        pdf.text(title.trim(), pageWidth / 2, y, { align: "center" });
        y += lineHeight * 2;
        pdf.setFontSize(fontSize);
        pdf.setFont("helvetica", "normal");
      }

      // 处理文本行
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.trim() === "") {
          y += lineHeight * 0.8;
          continue;
        }

        // 自动换行
        const splitLines = pdf.splitTextToSize(line, contentWidth);
        for (const splitLine of splitLines) {
          if (y > pageHeight - marginBottom) {
            pdf.addPage();
            y = marginTop;
          }
          pdf.text(splitLine, marginLeft, y);
          y += lineHeight;
        }
      }

      // 页脚
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.setTextColor(150);
        pdf.text(
          `第 ${i} / ${totalPages} 页`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      }

      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);

      setResult({
        url,
        name: `${title.trim() || "document"}.pdf`,
        size: formatSize(blob.size),
      });
      toast.success("转换成功！");
    } catch (err) {
      console.error(err);
      toast.error("转换失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">文本转 PDF</h2>
      <p className="text-sm text-gray-500 mb-6">
        将文字内容转换为 PDF 文档，支持标题和自动分页
      </p>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">文档标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setResult(null);
            }}
            placeholder="输入文档标题"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            字号：{fontSize}px
          </label>
          <input
            type="range"
            min={10}
            max={20}
            step={1}
            value={fontSize}
            onChange={(e) => {
              setFontSize(parseInt(e.target.value));
              setResult(null);
            }}
            className="w-full mt-2"
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">文字内容</label>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          placeholder="在这里输入文字内容..."
          className="w-full h-64 p-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 resize-y font-mono"
        />
        <p className="text-xs text-gray-400 mt-1">
          {text.length} 字符 · 自动分页 · A4 纸张
        </p>
      </div>

      {result && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="text-2xl">✅</div>
            <div className="flex-1">
              <div className="font-medium text-green-900">转换完成</div>
              <div className="text-xs text-green-700">{result.name} · {result.size}</div>
            </div>
            <a
              href={result.url}
              download={result.name}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              下载 PDF
            </a>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={() => {
            setText("");
            setResult(null);
          }}
          className="px-4 py-2.5 text-gray-500 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
        >
          清空
        </button>
        <button
          onClick={handleConvert}
          disabled={processing}
          className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {processing ? "转换中..." : "生成 PDF"}
        </button>
      </div>
    </div>
  );
}

// ============ 图片转 PDF 工具 ============
function ImageToPdfTool() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [pageSize, setPageSize] = useState<"a4" | "fit">("fit");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string; size: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const imageFiles = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error("请选择图片文件");
      return;
    }

    const newImages: ImageFile[] = imageFiles.map((f) => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      name: f.name,
      url: URL.createObjectURL(f),
    }));
    setImages((prev) => [...prev, ...newImages]);
    setResult(null);
    toast.success(`已添加 ${newImages.length} 张图片`);
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setResult(null);
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setImages((prev) => {
      const newImages = [...prev];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= newImages.length) return prev;
      [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
      return newImages;
    });
    setResult(null);
  };

  const handleConvert = async () => {
    if (images.length === 0) {
      toast.error("请先添加图片");
      return;
    }
    try {
      setProcessing(true);

      // 加载第一张图片获取尺寸
      const firstImg = await loadImage(images[0].url);
      const pdf = new jsPDF({
        orientation: orientation,
        unit: "px",
        format: pageSize === "a4" ? "a4" : [firstImg.width, firstImg.height],
      });

      for (let i = 0; i < images.length; i++) {
        const img = await loadImage(images[i].url);

        if (i > 0) {
          if (pageSize === "a4") {
            pdf.addPage("a4", orientation);
          } else {
            pdf.addPage([img.width, img.height], orientation);
          }
        }

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        if (pageSize === "fit") {
          pdf.addImage(img, "JPEG", 0, 0, pageWidth, pageHeight);
        } else {
          // A4 页面：等比缩放居中
          const ratio = Math.min(pageWidth / img.width, pageHeight / img.height);
          const w = img.width * ratio;
          const h = img.height * ratio;
          const x = (pageWidth - w) / 2;
          const y = (pageHeight - h) / 2;
          pdf.addImage(img, "JPEG", x, y, w, h);
        }
      }

      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      setResult({
        url,
        name: "images-to-pdf.pdf",
        size: formatSize(blob.size),
      });
      toast.success("转换成功！");
    } catch (err) {
      console.error(err);
      toast.error("转换失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setProcessing(false);
    }
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">图片转 PDF</h2>
      <p className="text-sm text-gray-500 mb-6">
        将多张图片合并为一个 PDF 文档，支持 JPG、PNG、WebP 等格式
      </p>

      {/* 上传区域 */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all mb-6"
      >
        <div className="text-4xl mb-3">🖼️</div>
        <p className="text-gray-700 font-medium">点击或拖拽图片到这里</p>
        <p className="text-xs text-gray-400 mt-1">支持 JPG、PNG、WebP、BMP、GIF 等格式</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* 设置 */}
      {images.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">页面大小</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(e.target.value as "a4" | "fit");
                setResult(null);
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
            >
              <option value="fit">自适应图片大小</option>
              <option value="a4">A4 纸张</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">方向</label>
            <select
              value={orientation}
              onChange={(e) => {
                setOrientation(e.target.value as "portrait" | "landscape");
                setResult(null);
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
            >
              <option value="portrait">竖向</option>
              <option value="landscape">横向</option>
            </select>
          </div>
        </div>
      )}

      {/* 图片列表 */}
      {images.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">
              已添加 {images.length} 张图片
            </span>
            <button
              onClick={() => {
                setImages([]);
                setResult(null);
              }}
              className="text-xs text-gray-400 hover:text-red-500"
            >
              清空全部
            </button>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {images.map((img, i) => (
              <div key={img.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute top-1 left-1 w-5 h-5 bg-black/60 text-white text-xs rounded-full flex items-center justify-center">
                  {i + 1}
                </div>
                <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => moveImage(i, -1)}
                    disabled={i === 0}
                    className="w-5 h-5 bg-black/60 text-white text-xs rounded hover:bg-black/80 disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => moveImage(i, 1)}
                    disabled={i === images.length - 1}
                    className="w-5 h-5 bg-black/60 text-white text-xs rounded hover:bg-black/80 disabled:opacity-30"
                  >
                    →
                  </button>
                  <button
                    onClick={() => removeImage(img.id)}
                    className="w-5 h-5 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 结果 */}
      {result && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="text-2xl">✅</div>
            <div className="flex-1">
              <div className="font-medium text-green-900">转换完成</div>
              <div className="text-xs text-green-700">{result.name} · {result.size}</div>
            </div>
            <a
              href={result.url}
              download={result.name}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              下载 PDF
            </a>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      {images.length > 0 && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleConvert}
            disabled={processing}
            className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {processing ? "转换中..." : "生成 PDF"}
          </button>
        </div>
      )}
    </div>
  );
}

// ============ PDF 转图片工具 ============
function PdfToImageTool() {
  const [file, setFile] = useState<PdfFile | null>(null);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [quality, setQuality] = useState(2);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{ url: string; name: string; page: number }[]>([]);
  const [pdfjsReady, setPdfjsReady] = useState(false);
  const pdfjsRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 初始化 pdf.js（从 CDN 加载，避免 SSR 问题）
  useEffect(() => {
    if (typeof window === "undefined") return;
    // @ts-ignore
    if (window.pdfjsLib) {
      pdfjsRef.current = (window as any).pdfjsLib;
      setPdfjsReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      // @ts-ignore
      const pdfjs = window.pdfjsLib;
      if (pdfjs) {
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        pdfjsRef.current = pdfjs;
        setPdfjsReady(true);
      }
    };
    script.onerror = () => {
      console.error("pdf.js CDN 加载失败");
    };
    document.head.appendChild(script);
  }, []);

  const handleFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const f = fileList[0];
    if (!f.type.includes("pdf") && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("请选择 PDF 文件");
      return;
    }

    let pageCount = 0;
    try {
      const buf = await f.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buf);
      pageCount = pdfDoc.getPageCount();
    } catch {}

    setFile({
      id: Math.random().toString(36).slice(2),
      file: f,
      name: f.name,
      size: formatSize(f.size),
      pages: pageCount,
    });
    setResults([]);
  };

  const handleConvert = async () => {
    if (!file) {
      toast.error("请先选择 PDF 文件");
      return;
    }
    if (!pdfjsReady || !pdfjsRef.current) {
      toast.error("PDF 引擎加载中，请稍候再试");
      return;
    }
    try {
      setProcessing(true);
      const arrayBuffer = await file.file.arrayBuffer();

      // 使用 pdf.js 渲染每一页到 canvas
      const pdf = await pdfjsRef.current.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      const outputFiles: { url: string; name: string; page: number }[] = [];

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: quality });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        // 白色背景（JPEG 格式需要）
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 渲染 PDF 页面到 canvas
        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        }).promise;

        const dataUrl = canvas.toDataURL(`image/${format}`, format === "jpeg" ? 0.92 : undefined);
        outputFiles.push({
          url: dataUrl,
          name: `${file.name.replace(/\.pdf$/i, "")}_page${i}.${format}`,
          page: i,
        });
      }

      setResults(outputFiles);
      toast.success(`转换成功，共 ${outputFiles.length} 张图片`);
    } catch (err) {
      console.error(err);
      toast.error("转换失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setProcessing(false);
    }
  };

  const downloadAll = () => {
    results.forEach((r, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = r.url;
        a.download = r.name;
        a.click();
      }, i * 300);
    });
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">PDF 转图片</h2>
      <p className="text-sm text-gray-500 mb-6">
        将 PDF 每一页转换为高清图片，支持 PNG/JPEG 格式
      </p>

      {/* 上传区域 */}
      {!file ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all mb-6"
        >
          <div className="text-4xl mb-3">📸</div>
          <p className="text-gray-700 font-medium">点击选择要转换的 PDF 文件</p>
          <p className="text-xs text-gray-400 mt-1">每一页将转换为一张图片</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files)}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6">
          <div className="text-2xl">📄</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">{file.name}</div>
            <div className="text-xs text-gray-500">
              {file.size}
              {file.pages ? ` · ${file.pages} 页` : ""}
            </div>
          </div>
          <button
            onClick={() => {
              setFile(null);
              setResults([]);
            }}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            重新选择
          </button>
        </div>
      )}

      {/* 设置 */}
      {file && (
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">图片格式</label>
            <select
              value={format}
              onChange={(e) => {
                setFormat(e.target.value as "png" | "jpeg");
                setResults([]);
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
            >
              <option value="png">PNG（无损，透明）</option>
              <option value="jpeg">JPEG（体积小）</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              清晰度：{quality}x
            </label>
            <input
              type="range"
              min={1}
              max={4}
              step={0.5}
              value={quality}
              onChange={(e) => {
                setQuality(parseFloat(e.target.value));
                setResults([]);
              }}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* 结果 */}
      {results.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✅</span>
              <span className="font-medium text-gray-900 text-sm">
                转换完成，共 {results.length} 张图片
              </span>
            </div>
            <button
              onClick={downloadAll}
              className="text-xs text-orange-600 hover:text-orange-700 font-medium"
            >
              全部下载
            </button>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 max-h-80 overflow-y-auto">
            {results.map((r) => (
              <div key={r.page} className="relative group">
                <div className="aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <img
                    src={r.url}
                    alt={r.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[10px] rounded">
                  P{r.page}
                </div>
                <a
                  href={r.url}
                  download={r.name}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  下载
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      {file && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleConvert}
            disabled={processing || !pdfjsReady}
            className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {processing ? "转换中..." : "开始转换"}
          </button>
        </div>
      )}
    </div>
  );
}
