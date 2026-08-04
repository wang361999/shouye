"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import GithubCodeBlock from "./GithubCodeBlock";
import { preprocessGithubShortcodes } from "@/lib/github-url";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function MarkdownCodeBlock({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);
  const label = language ? language.toUpperCase() : "CODE";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="not-prose group relative my-5 overflow-hidden rounded-xl bg-slate-950">
      {/* 语言标签 + 复制按钮：浮于右上角，不单独占一行 */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        {language && (
          <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide text-slate-400">
            {label}
          </span>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
        >
          {copied ? "✓ 已复制" : "复制"}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto bg-slate-950 px-4 py-4 pt-9 text-[13px] leading-6 text-slate-100">
        <code className={`language-${language || "text"} font-mono`}>
          {code}
        </code>
      </pre>
    </div>
  );
}

/**
 * 统一 Markdown 渲染器
 *
 * 支持 GFM 语法 + 自定义 github-code 代码块 + GitHub 短代码
 *
 * 支持的语法：
 *
 * 1. github-code 代码块：
 * ```github-code
 * owner/repo/path/to/file.ts
 * ```
 *
 * 2. 短代码：
 * [github]https://github.com/owner/repo/blob/main/file.ts[/github]
 *
 * 3. 裸 GitHub 链接（独立行自动转换）
 *
 * 可选参数（通过在路径后添加查询参数）：
 * ```github-code
 * owner/repo/path/to/file.ts?ref=v1.0.0&lines=10-30
 * ```
 */
export default function MarkdownRenderer({
  content,
  className = "",
}: MarkdownRendererProps) {
  // 预处理内容：将短代码和裸链接转换为 github-code 代码块
  const processedContent = useMemo(
    () => preprocessGithubShortcodes(content),
    [content]
  );

  return (
    <div className={`prose prose-sm sm:prose-base max-w-none markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 拦截 code 块，处理 github-code 语言
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const lang = match ? match[1] : "";
            const text = String(children).replace(/\n$/, "");

            // 处理 github-code 特殊语言
            if (lang === "github-code") {
              // 解析 source 路径和可选参数
              // 格式: owner/repo/path/to/file.ext?ref=main&lines=10-30
              const [rawPath, queryString] = text.split("?");
              const params = new URLSearchParams(queryString || "");
              const ref = params.get("ref") || undefined;
              const lines = params.get("lines") || undefined;

              return (
                <GithubCodeBlock
                  source={rawPath.trim()}
                  ref={ref}
                  lines={lines}
                />
              );
            }

            // 普通代码块：使用自定义技术社区风格渲染
            if (className || text.includes("\n")) {
              return <MarkdownCodeBlock language={lang} code={text} />;
            }

            // 行内代码
            return (
              <code
                className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-rose-600"
                {...props}
              >
                {children}
              </code>
            );
          },
          // 外部链接新窗口打开
          a({ node, href, children, ...props }: any) {
            const isExternal = href?.startsWith("http") && !href?.includes(window.location.hostname);
            return (
              <a
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                {...props}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
