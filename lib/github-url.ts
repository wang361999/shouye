/**
 * GitHub URL 解析工具
 *
 * 支持解析以下格式：
 * 1. GitHub Blob URL: https://github.com/owner/repo/blob/branch/path/to/file.ts
 * 2. GitHub Raw URL: https://raw.githubusercontent.com/owner/repo/branch/path/to/file.ts
 * 3. 短代码: [github]https://github.com/owner/repo/blob/main/file.ts[/github]
 */

export interface ParsedGithubUrl {
  owner: string;
  repo: string;
  path: string;
  ref: string;
  /** 转换为 github-code 代码块格式: owner/repo/path?ref=xxx */
  source: string;
}

/**
 * 解析 GitHub URL 为结构化数据
 *
 * 支持的 URL 格式：
 * - https://github.com/{owner}/{repo}/blob/{ref}/{path}
 * - https://github.com/{owner}/{repo}/blob/{ref}/{path}?lines=10-20
 * - https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}
 *
 * @returns 解析结果，无法解析时返回 null
 */
export function parseGithubUrl(url: string): ParsedGithubUrl | null {
  const trimmed = url.trim();

  try {
    // 格式1: https://github.com/owner/repo/blob/branch/path/to/file.ts
    const blobMatch = trimmed.match(
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/
    );
    if (blobMatch) {
      const [, owner, repo, ref, path] = blobMatch;
      // 去除 URL 查询参数（如 ?lines=10-20）
      const cleanPath = path.split("?")[0];
      const queryString = path.includes("?") ? path.split("?")[1] : "";
      const source = `${owner}/${repo}/${cleanPath}${queryString ? `?${queryString}` : `?ref=${ref}`}`;
      return {
        owner,
        repo,
        path: cleanPath,
        ref,
        source: queryString
          ? `${owner}/${repo}/${cleanPath}?${queryString}&ref=${ref}`
          : `${owner}/${repo}/${cleanPath}?ref=${ref}`,
      };
    }

    // 格式2: https://raw.githubusercontent.com/owner/repo/branch/path/to/file.ts
    const rawMatch = trimmed.match(
      /^https?:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)$/
    );
    if (rawMatch) {
      const [, owner, repo, ref, path] = rawMatch;
      const cleanPath = path.split("?")[0];
      return {
        owner,
        repo,
        path: cleanPath,
        ref,
        source: `${owner}/${repo}/${cleanPath}?ref=${ref}`,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 判断字符串是否为 GitHub 文件链接
 */
export function isGithubFileUrl(url: string): boolean {
  return parseGithubUrl(url) !== null;
}

/**
 * 将 GitHub URL 转换为 github-code 代码块格式的 source 字符串
 * 格式: owner/repo/path/to/file.ts?ref=main
 *
 * @returns source 字符串，无法解析时返回 null
 */
export function githubUrlToSource(url: string): string | null {
  const parsed = parseGithubUrl(url);
  return parsed?.source || null;
}

/**
 * 预处理 Markdown 内容，将 [github]URL[/github] 短代码和裸 GitHub 链接
 * 转换为 github-code 代码块
 *
 * 转换规则：
 * 1. [github]https://github.com/owner/repo/blob/main/file.ts[/github]
 *    → ```github-code\nowner/repo/file.ts?ref=main\n```
 *
 * 2. 独立行的 GitHub blob 链接（非在代码块或链接中）
 *    → ```github-code\nowner/repo/file.ts?ref=main\n```
 *
 * @param content 原始 Markdown 内容
 * @returns 预处理后的内容
 */
export function preprocessGithubShortcodes(content: string): string {
  if (!content) return content;

  let result = content;

  // 1. 处理 [github]URL[/github] 短代码
  // 支持多行匹配，非贪婪
  const shortcodeRegex = /\[github\]\s*(https?:\/\/[^\s\]]+)\s*\[\/github\]/gi;
  result = result.replace(shortcodeRegex, (match, url) => {
    const source = githubUrlToSource(url);
    if (source) {
      return `\n\`\`\`github-code\n${source}\n\`\`\`\n`;
    }
    // 无法解析的 URL，保持原样
    return match;
  });

  // 2. 处理裸 GitHub blob 链接（独立行，非在代码块或链接语法中）
  // 匹配独立行上的 GitHub blob URL（前面不是 [ 或 ( ）
  // 使用行级匹配避免破坏代码块内的链接
  const lines = result.split("\n");
  const processedLines = lines.map((line) => {
    // 跳过代码块标记行
    if (line.trim().startsWith("```")) return line;
    // 跳过 Markdown 链接行 [text](url)
    if (/^\[.*\]\(.*\)/.test(line.trim())) return line;
    // 跳过行内代码中的链接
    if (line.includes("`") && line.includes("github.com")) return line;

    // 检查整行是否就是一个 GitHub blob URL
    const trimmedLine = line.trim();
    if (
      trimmedLine.startsWith("https://github.com/") &&
      trimmedLine.includes("/blob/")
    ) {
      const source = githubUrlToSource(trimmedLine);
      if (source) {
        return `\n\`\`\`github-code\n${source}\n\`\`\`\n`;
      }
    }

    return line;
  });

  return processedLines.join("\n");
}
