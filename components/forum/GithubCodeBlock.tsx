"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

// ============ Prism 动态导入（按需加载语言）============
// 只在客户端加载，避免 SSR 问题
// 优化：只加载当前代码块实际用到的语言，而非全量 24 种
let prismCoreLoaded = false;
const loadedLanguages = new Set<string>();

// 常用语言（优先加载，覆盖 90% 以上场景）
const COMMON_LANGS = ["javascript", "typescript", "jsx", "tsx", "python", "bash", "json", "css", "html", "markdown", "yaml"];

async function loadPrism(language: string) {
  if (typeof window === "undefined") return null;

  // 1. 加载 Prism 核心
  const Prism = (await import("prismjs")).default;

  if (!prismCoreLoaded) {
    // 首次加载：批量加载常用语言（一次性网络开销，覆盖大多数场景）
    await Promise.all(
      COMMON_LANGS.map(async (lang) => {
        try {
          await import(`prismjs/components/prism-${lang}`);
          loadedLanguages.add(lang);
        } catch {
          // 忽略加载失败的语言
        }
      })
    );
    prismCoreLoaded = true;
  }

  // 2. 如果目标语言不在常用列表中，按需单独加载
  const targetLang = language.toLowerCase();
  if (targetLang && !loadedLanguages.has(targetLang)) {
    try {
      await import(`prismjs/components/prism-${targetLang}`);
      loadedLanguages.add(targetLang);
    } catch {
      // 语言不存在，降级使用纯文本
    }
  }

  return Prism;
}

// ============ 文件扩展名到 Prism 语言映射 ============
const EXT_TO_LANG: Record<string, string> = {
  js: "javascript", jsx: "jsx", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "tsx",mts: "typescript", cts: "typescript",
  py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
  c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp", cs: "csharp",
  php: "php", swift: "swift", kt: "kotlin", kts: "kotlin",
  sh: "bash", bash: "bash", zsh: "bash", fish: "bash",
  yml: "yaml", yaml: "yaml", json: "json", xml: "xml",
  html: "html", htm: "html", css: "css", scss: "scss", sass: "scss",
  sql: "sql", md: "markdown", vue: "markup", svelte: "markup",
  toml: "toml", ini: "ini", conf: "bash", gradle: "groovy",
  Dockerfile: "docker", dockerfile: "docker",
};

function getLanguageFromPath(path: string): string {
  // 处理 Dockerfile 等无扩展名文件
  const basename = path.split("/").pop() || "";
  if (basename.toLowerCase() === "dockerfile") return "docker";
  if (basename.toLowerCase() === "makefile") return "makefile";

  const ext = basename.split(".").pop()?.toLowerCase() || "";
  return EXT_TO_LANG[ext] || "plaintext";
}

interface GithubCodeBlockProps {
  /** GitHub 文件路径，格式: owner/repo/path/to/file.ext */
  source: string;
  /** 可选：指定分支/tag/commit，默认 HEAD */
  ref?: string;
  /** 可选：只显示指定行范围，如 "10-30" */
  lines?: string;
  /** 可选：是否显示文件头信息，默认 true */
  showHeader?: boolean;
}

interface FileData {
  content: string;
  language: string;
  htmlUrl: string;
  owner: string;
  repo: string;
  path: string;
  ref: string;
}

export default function GithubCodeBlock({
  source,
  ref: gitRef,
  lines,
  showHeader = true,
}: GithubCodeBlockProps) {
  const [data, setData] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  // 解析 source: owner/repo/path/to/file.ext
  const parts = source.trim().split("/");
  const owner = parts[0] || "";
  const repo = parts[1] || "";
  const filePath = parts.slice(2).join("/");

  // 解析行范围
  let startLine = 1;
  let endLine = 0;
  if (lines) {
    const match = lines.match(/(\d+)(?:\s*[-~]\s*(\d+))?/);
    if (match) {
      startLine = parseInt(match[1]);
      endLine = match[2] ? parseInt(match[2]) : startLine;
    }
  }

  // 获取文件内容
  useEffect(() => {
    if (!owner || !repo || !filePath) {
      setError("路径格式错误，应为 owner/repo/path/to/file.ext");
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      owner,
      repo,
      path: filePath,
    });
    if (gitRef) params.set("ref", gitRef);

    fetch(`/api/github/file?${params}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "获取文件失败");
        }
        return res.json();
      })
      .then(async (fileData: FileData) => {
        if (!active) return;

        // 提取指定行范围
        let displayContent = fileData.content;
        if (endLine > 0 || startLine > 1) {
          const allLines = fileData.content.split("\n");
          const end = endLine > 0 ? endLine : allLines.length;
          displayContent = allLines
            .slice(startLine - 1, end)
            .join("\n");
        }

        setData({ ...fileData, content: displayContent });

        // 语法高亮
        const lang = getLanguageFromPath(fileData.path);
        try {
          const Prism = await loadPrism(lang);
          if (Prism && active) {
            const grammar = Prism.languages[lang];
            if (grammar) {
              const html = Prism.highlight(displayContent, grammar, lang);
              setHighlighted(html);
            } else {
              // 无对应语法，转义后直接显示
              setHighlighted(escapeHtml(displayContent));
            }
          } else {
            setHighlighted(escapeHtml(displayContent));
          }
        } catch {
          setHighlighted(escapeHtml(displayContent));
        }
      })
      .catch((err) => {
        if (active) setError(err.message || "获取文件失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [owner, repo, filePath, gitRef, startLine, endLine]);

  async function handleCopy() {
    if (!data?.content) return;
    try {
      await navigator.clipboard.writeText(data.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  // 加载中
  if (loading) {
    return (
      <div className="my-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-lg shadow-slate-900/10">
        {showHeader && (
          <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-300">
            <svg className="w-4 h-4 animate-spin text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="truncate font-mono text-xs">{source}</span>
          </div>
        )}
        <div className="bg-slate-950 p-4">
          <div className="space-y-2 animate-pulse">
            <div className="h-3 rounded bg-slate-800 w-3/4" />
            <div className="h-3 rounded bg-slate-800 w-full" />
            <div className="h-3 rounded bg-slate-800 w-5/6" />
            <div className="h-3 rounded bg-slate-800 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className="my-5 rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-red-600">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
        <div className="mt-2 text-xs text-gray-400 font-mono">{source}</div>
      </div>
    );
  }

  // 正常渲染
  return (
    <div className="my-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-lg shadow-slate-900/10">
      {/* 文件头 */}
      {showHeader && data && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="hidden sm:flex items-center gap-1.5 mr-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            {/* GitHub 图标 */}
            <svg className="w-4 h-4 flex-shrink-0 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span className="text-sm font-semibold text-slate-100 truncate">
              {data.owner}/{data.repo}
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-xs text-slate-400 font-mono truncate">
              {data.path}
            </span>
            {lines && (
              <span className="flex-shrink-0 rounded-md border border-blue-400/30 bg-blue-400/10 px-1.5 py-0.5 font-mono text-xs text-blue-200">
                L{startLine}{endLine > 0 ? `-L${endLine}` : ""}
              </span>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:border-blue-400 hover:text-blue-200"
            >
              {copied ? "已复制" : "复制"}
            </button>
            <a
              href={data.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:border-blue-400 hover:text-blue-200"
            >
              查看
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      )}

      {/* 代码内容 */}
      <div className="relative">
        {/* 行号侧边栏 + 代码 */
        data && (
          <div className="flex overflow-x-auto bg-slate-950 text-xs text-slate-300">
            {/* 行号 */
            (() => {
              const codeLines = data.content.split("\n");
              const lineCount = codeLines.length;
              const lineNumbers = [];
              for (let i = 0; i < lineCount; i++) {
                lineNumbers.push(startLine + i);
              }
              return (
                <>
                  <div className="flex-shrink-0 select-none border-r border-slate-800 bg-slate-900 px-3 py-4 text-right font-mono text-slate-500">
                    {lineNumbers.map((n) => (
                      <div key={n} className="leading-6">{n}</div>
                    ))}
                  </div>
                  <pre className="flex-1 overflow-x-auto px-4 py-4">
                    <code
                      ref={codeRef as any}
                      className={`language-${getLanguageFromPath(data.path)} font-mono leading-6`}
                      dangerouslySetInnerHTML={{
                        __html: highlighted || escapeHtml(data.content),
                      }}
                    />
                  </pre>
                </>
              );
            })()
            }
          </div>
        )}
      </div>

      {/* Prism 主题样式 */}
      <style dangerouslySetInnerHTML={{ __html: prismTheme }} />
    </div>
  );
}

// ============ HTML 转义 ============
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============ Prism 暗色主题（内联，避免额外 CSS 文件） ============
const prismTheme = `
/* Prism 暗色主题 - 适配 GitHub Dark */
code[class*="language-"], pre[class*="language-"] {
  color: #e1e4e8;
  background: none;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  text-align: left;
  white-space: pre;
  word-spacing: normal;
  word-break: normal;
  line-height: 1.5;
  tab-size: 2;
  hyphens: none;
}
.token.comment, .token.prolog, .token.doctype, .token.cdata { color: #6a737d; }
.token.punctuation { color: #e1e4e8; }
.token.namespace { opacity: .7; }
.token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol, .token.deleted { color: #79b8ff; }
.token.selector, .token.attr-name, .token.string, .token.char, .token.builtin, .token.inserted { color: #85e89d; }
.token.operator, .token.entity, .token.url, .language-css .token.string, .style .token.string { color: #e1e4e8; }
.token.atrule, .token.attr-value, .token.keyword { color: #b392f0; }
.token.function, .token.class-name { color: #f6c85f; }
.token.regex, .token.important, .token.variable { color: #ffab70; }
.token.important, .token.bold { font-weight: bold; }
.token.italic { font-style: italic; }
.token.entity { cursor: help; }
`;
