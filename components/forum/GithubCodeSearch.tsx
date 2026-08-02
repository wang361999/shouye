"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  name: string;
  path: string;
  repo: { name: string; url: string };
  htmlUrl: string;
  owner: string;
  repoName: string;
  filePath: string;
}

interface GithubCodeSearchProps {
  /** 选中文件后回调，返回可插入编辑器的 markdown 片段 */
  onInsert: (markdown: string) => void;
}

// 常用编程语言列表
const LANGUAGES = [
  { value: "", label: "全部语言" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "shell", label: "Shell" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "markdown", label: "Markdown" },
  { value: "yaml", label: "YAML" },
  { value: "json", label: "JSON" },
];

export default function GithubCodeSearch({ onInsert }: GithubCodeSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 筛选条件
  const [language, setLanguage] = useState("");
  const [repo, setRepo] = useState("");
  const [user, setUser] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // 执行搜索
  const doSearch = useCallback(
    async (q: string, p: number = 1, filters?: { language?: string; repo?: string; user?: string }) => {
      if (!q.trim() || q.trim().length < 2) return;
      setLoading(true);
      setError(null);
      setShowResults(true);

      try {
        const params = new URLSearchParams({
          q: q.trim(),
          page: String(p),
          per_page: "10",
        });

        const fl = filters || { language, repo, user };
        if (fl.language) params.set("language", fl.language);
        if (fl.repo) params.set("repo", fl.repo);
        if (fl.user) params.set("user", fl.user);

        const res = await fetch(`/api/github/search?${params}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "搜索失败");
        }

        setResults(data.results || []);
        setTotalCount(data.totalCount || 0);
        setPage(p);
      } catch (err: any) {
        setError(err.message || "搜索失败");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [language, repo, user]
  );

  // 防抖搜索
  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (value.trim().length >= 2) {
          doSearch(value, 1);
        } else {
          setShowResults(false);
          setResults([]);
        }
      }, 500);
    },
    [doSearch]
  );

  // 语言筛选变化时重新搜索
  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    if (query.trim().length >= 2) {
      doSearch(query, 1, { language: value, repo, user });
    }
  };

  // 仓库筛选变化时重新搜索
  const handleRepoChange = (value: string) => {
    setRepo(value);
  };

  // 用户筛选变化时重新搜索
  const handleUserChange = (value: string) => {
    setUser(value);
  };

  // 应用筛选条件重新搜索
  const applyFilters = () => {
    if (query.trim().length >= 2) {
      doSearch(query, 1, { language, repo, user });
    }
  };

  // 重置筛选
  const resetFilters = () => {
    setLanguage("");
    setRepo("");
    setUser("");
    if (query.trim().length >= 2) {
      doSearch(query, 1, { language: "", repo: "", user: "" });
    }
  };

  // 插入代码引用
  const handleInsert = (result: SearchResult) => {
    const source = `${result.owner}/${result.repoName}/${result.filePath}`;
    const markdown = `\n\`\`\`github-code\n${source}\n\`\`\`\n`;
    onInsert(markdown);
    setShowResults(false);
    setQuery("");
    setResults([]);
  };

  // 点击外部关闭
  const handleBlur = (e: React.FocusEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setTimeout(() => setShowResults(false), 200);
    }
  };

  // 当前激活的筛选条件数量
  const activeFilterCount = [language, repo, user].filter(Boolean).length;

  return (
    <div ref={containerRef} className="relative">
      {/* 搜索框 + 筛选按钮 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const input = document.getElementById("github-search-input");
            input?.focus();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          GitHub 代码
        </button>
        <input
          id="github-search-input"
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
          }}
          onBlur={handleBlur}
          placeholder="搜索 GitHub 开源代码..."
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {/* 筛选切换按钮 */}
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap",
            showFilters || activeFilterCount > 0
              ? "bg-blue-50 text-blue-600 border-blue-300"
              : "text-gray-600 border-gray-300 hover:bg-gray-50"
          )}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          筛选
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 text-xs text-white bg-blue-500 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* 筛选条件面板 */}
      {showFilters && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          {/* 语言选择 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">编程语言</label>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.value || "all"}
                  type="button"
                  onClick={() => handleLanguageChange(lang.value)}
                  className={cn(
                    "px-2 py-0.5 text-xs rounded-full border transition-colors",
                    language === lang.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* 仓库和用户筛选 */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">限定仓库 (owner/repo)</label>
              <input
                type="text"
                value={repo}
                onChange={(e) => handleRepoChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
                placeholder="如 facebook/react"
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">限定用户/组织</label>
              <input
                type="text"
                value={user}
                onChange={(e) => handleUserChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
                placeholder="如 facebook"
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={applyFilters}
              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              应用筛选
            </button>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-red-500 transition-colors"
              >
                重置筛选
              </button>
            )}
          </div>
        </div>
      )}

      {/* 搜索结果下拉 */}
      {showResults && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto">
          {/* 加载中 */}
          {loading && (
            <div className="flex items-center justify-center py-8 text-sm text-gray-400">
              <svg className="w-5 h-5 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              搜索中...
            </div>
          )}

          {/* 错误 */}
          {error && !loading && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-red-500">⚠️ {error}</p>
              {error.includes("GITHUB_TOKEN") && (
                <p className="mt-2 text-xs text-gray-400">
                  管理员请前往后台 → 安全设置 → GitHub API Token 中配置
                </p>
              )}
              {!error.includes("GITHUB_TOKEN") && (
                <p className="mt-2 text-xs text-gray-400">
                  提示：GitHub Code Search 搜索词需要包含至少一个搜索词
                </p>
              )}
            </div>
          )}

          {/* 当前筛选条件展示 */}
          {!loading && !error && results.length > 0 && activeFilterCount > 0 && (
            <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100 bg-blue-50/50 flex items-center gap-2 flex-wrap">
              <span>当前筛选:</span>
              {language && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  语言: {LANGUAGES.find((l) => l.value === language)?.label || language}
                </span>
              )}
              {repo && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  仓库: {repo}
                </span>
              )}
              {user && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  用户: {user}
                </span>
              )}
            </div>
          )}

          {/* 无结果 */}
          {!loading && !error && results.length === 0 && query.trim().length >= 2 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              未找到匹配的代码
            </div>
          )}

          {/* 结果列表 */}
          {!loading && !error && results.length > 0 && (
            <>
              <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                找到 {totalCount > 1000 ? "1000+" : totalCount} 个结果
              </div>
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => handleInsert(result)}
                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  {/* 仓库名 */}
                  <div className="flex items-center gap-1.5 text-sm">
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    <span className="font-medium text-gray-700 truncate">
                      {result.repo.name}
                    </span>
                  </div>
                  {/* 文件路径 */}
                  <div className="mt-1 text-xs text-gray-500 font-mono truncate">
                    {result.path}
                  </div>
                </button>
              ))}
              {/* 分页控制 */}
              {totalCount > 10 && (
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => doSearch(query, page - 1)}
                    className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <span>
                    第 {page} / {Math.ceil(Math.min(totalCount, 1000) / 10)} 页
                  </span>
                  <button
                    type="button"
                    disabled={page * 10 >= Math.min(totalCount, 1000) || loading}
                    onClick={() => doSearch(query, page + 1)}
                    className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
