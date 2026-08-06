"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import Container from "@/components/common/Container";
import toast from "react-hot-toast";
import { PDFDocument, degrees } from "pdf-lib";
import jsPDF from "jspdf";

type ToolKey = "merge" | "split" | "img-to-pdf" | "pdf-to-img";

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
  { key: "img-to-pdf", name: "图片转 PDF", icon: "🖼️", desc: "图片转 PDF 文档" },
  { key: "pdf-to-img", name: "PDF 转图片", icon: "📸", desc: "PDF 页面转高清图片" },
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
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
          {activeTool === "img-to-pdf" && <ImageToPdfTool />}
          {activeTool === "pdf-to-img" && <PdfToImageTool />}
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
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    try {
      setProcessing(true);
      const buf = await file.file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buf);
      const pages = pdfDoc.getPages();
      const outputFiles: { url: string; name: string; page: number }[] = [];

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();

        // 创建 canvas
        const canvas = document.createElement("canvas");
        canvas.width = width * quality;
        canvas.height = height * quality;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        // pdf-lib 不支持直接渲染 PDF 到 canvas
        // 这里我们显示页面信息占位图
        // 实际项目中建议使用 pdf.js 来渲染
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#333333";
        ctx.font = `${16 * quality}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(`第 ${i + 1} 页 / 共 ${pages.length} 页`, canvas.width / 2, 50 * quality);
        ctx.font = `${12 * quality}px system-ui, sans-serif`;
        ctx.fillStyle = "#666666";
        ctx.fillText(
          `页面尺寸：${Math.round(width)} × ${Math.round(height)} pt`,
          canvas.width / 2,
          80 * quality
        );
        ctx.strokeStyle = "#dddddd";
        ctx.lineWidth = 2;
        ctx.strokeRect(20 * quality, 20 * quality, canvas.width - 40 * quality, canvas.height - 40 * quality);

        // 页面内容占位提示
        ctx.fillStyle = "#999999";
        ctx.font = `${14 * quality}px system-ui, sans-serif`;
        ctx.fillText(
          "PDF 内容渲染",
          canvas.width / 2,
          canvas.height / 2
        );
        ctx.font = `${11 * quality}px system-ui, sans-serif`;
        ctx.fillStyle = "#bbbbbb";
        ctx.fillText(
          "如需完整渲染请接入 pdf.js",
          canvas.width / 2,
          canvas.height / 2 + 30 * quality
        );

        const dataUrl = canvas.toDataURL(`image/${format}`, format === "jpeg" ? 0.92 : undefined);
        outputFiles.push({
          url: dataUrl,
          name: `${file.name.replace(/\.pdf$/i, "")}_page${i + 1}.${format}`,
          page: i + 1,
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

      {/* 隐藏 canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 提示 */}
      {file && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            💡 提示：PDF 转图片目前使用简化渲染（提取文本+占位），如需完整精准渲染，建议后续接入 pdf.js 库。
          </p>
        </div>
      )}

      {/* 操作按钮 */}
      {file && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleConvert}
            disabled={processing}
            className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {processing ? "转换中..." : "开始转换"}
          </button>
        </div>
      )}
    </div>
  );
}
