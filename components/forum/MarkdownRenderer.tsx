"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import GithubCodeBlock from "./GithubCodeBlock";
import { preprocessGithubShortcodes } from "@/lib/github-url";

interface MarkdownRendererProps {
  content: string;
  className?: string;
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

            // 普通代码块：使用默认渲染
            return (
              <code className={className} {...props}>
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
