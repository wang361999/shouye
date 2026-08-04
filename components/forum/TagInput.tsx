"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  error?: string;
}

interface TagSuggestion {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

export default function TagInput({ value, onChange, maxTags = 5, error }: TagInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 搜索标签建议（防抖）
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/forum/tags?search=${encodeURIComponent(input.trim())}`);
        if (res.ok) {
          const data = await res.json();
          // 过滤已选中的标签
          setSuggestions(data.filter((t: TagSuggestion) => !value.includes(t.name)));
        }
      } catch {
        // 静默失败
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [input, value]);

  // 点击外部关闭建议
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addTag = useCallback(
    (tagName: string) => {
      const trimmed = tagName.trim();
      if (!trimmed) return;
      if (value.length >= maxTags) return;
      if (value.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
      onChange([...value, trimmed]);
      setInput("");
      setShowSuggestions(false);
      setActiveIndex(-1);
    },
    [value, onChange, maxTags]
  );

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        addTag(suggestions[activeIndex].name);
      } else if (input.trim()) {
        addTag(input);
      }
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeTag(value.length - 1);
    } else if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div>
      <div ref={containerRef} className="relative">
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 min-h-[42px] px-2.5 sm:px-3 py-2 border rounded-lg cursor-text transition-shadow",
            error
              ? "border-red-300 focus-within:ring-2 focus-within:ring-red-500"
              : "border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent"
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {value.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-full"
            >
              {tag}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(index);
                }}
                className="text-blue-400 hover:text-blue-600"
              >
                ✕
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(true);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder={value.length === 0 ? "输入标签，按回车添加" : ""}
            disabled={value.length >= maxTags}
            className="flex-1 min-w-[80px] sm:min-w-[120px] text-[16px] sm:text-sm bg-transparent outline-none disabled:cursor-not-allowed"
          />
        </div>

        {/* 标签建议下拉框 */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((sug, idx) => (
              <button
                key={sug.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(sug.name);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors text-left",
                  idx === activeIndex ? "bg-blue-50" : "hover:bg-gray-50"
                )}
              >
                <span className="font-medium text-gray-700">{sug.name}</span>
                <span className="text-xs text-gray-400">{sug.postCount} 篇帖子</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <p className="mt-1 text-xs text-gray-400">
        {value.length}/{maxTags} 个标签 · 按回车或逗号添加
      </p>
    </div>
  );
}
