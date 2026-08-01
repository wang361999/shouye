"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

// ============ Prism 动态导入 ============
// 只在客户端加载，避免 SSR 问题
let prismLoaded = false;
async function loadPrism(language: string) {
  if (typeof window === "undefined") return null;

  const Prism = (await import("prismjs")).default;

  // 按需加载语言组件
  if (!prismLoaded) {
    // 加载常用语言
    const languages = [
      "javascript", "typescript", "jsx", "tsx", "python", "ruby",
      "go", "rust", "java", "c", "cpp", "csharp", "php", "swift",
      "kotlin", "bash", "yaml", "json", "xml", "html", "css",
      "scss", "sql", "markdown",
    ];
    for (const lang of languages) {
      try {
        await import(`prismjs/components/prism-${lang}`);
      } catch {
        // 某些语言可能不存在，忽略
      }
    }
    prismLoaded = true;
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

  // 加载中
  if (loading) {
    return (
      <div className="my-4 rounded-lg border border-gray-200 overflow-hidden">
        {showHeader && (
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="font-mono text-xs">{source}</span>
          </div>
        )}
        <div className="p-4 bg-gray-900">
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-gray-700 rounded w-3/4" />
            <div className="h-3 bg-gray-700 rounded w-full" />
            <div className="h-3 bg-gray-700 rounded w-5/6" />
            <div className="h-3 bg-gray-700 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className="my-4 rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2 text-sm text-red-600">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
        <div className="mt-2 text-xs text-gray-400 font-mono">{source}</div>
      </div>
    );
  }

  // 正常渲染
  return (
    <div className="my-4 rounded-lg border border-gray-200 overflow-hidden">
      {/* 文件头 */}
      {showHeader && data && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2 min-w-0">
            {/* GitHub 图标 */}
            <svg className="w-4 h-4 flex-shrink-0 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span className="text-sm font-medium text-gray-700 truncate">
              {data.owner}/{data.repo}
            </span>
            <span className="text-gray-300">/</span>
            <span className="text-xs text-gray-500 font-mono truncate">
              {data.path}
            </span>
            {lines && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-xs bg-blue-50 text-blue-600 rounded font-mono">
                L{startLine}{endLine > 0 ? `-L${endLine}` : ""}
              </span>
            )}
          </div>
          <a
            href={data.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
          >
            查看
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}

      {/* 代码内容 */}
      <div className="relative">
        {/* 行号侧边栏 + 代码 */
        data && (
          <div className="flex bg-gray-900 text-gray-300 text-xs overflow-x-auto">
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
                  <div className="flex-shrink-0 py-3 px-3 text-right select-none border-r border-gray-700 bg-gray-800 text-gray-500 font-mono">
                    {lineNumbers.map((n) => (
                      <div key={n} className="leading-5">{n}</div>
                    ))}
                  </div>
                  <pre className="flex-1 py-3 px-4 overflow-x-auto">
                    <code
                      ref={codeRef as any}
                      className={`language-${getLanguageFromPath(data.path)} font-mono leading-5`}
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

      {/* Prism 主题样式 */
      }
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
