"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  author: { username: string };
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isEssence: boolean;
  createdAt: string;
}

interface PostFormProps {
  categories: Category[];
  initialData?: Post;
  onSubmit: (data: { title: string; category: string; content: string }) => void;
  onCancel: () => void;
}

export default function PostForm({
  categories,
  initialData,
  onSubmit,
  onCancel,
}: PostFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [category, setCategory] = useState(initialData?.category ?? "");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [errors, setErrors] = useState<{ title?: string; category?: string; content?: string }>({});
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!title.trim()) {
      newErrors.title = "请输入标题";
    } else if (title.trim().length < 2) {
      newErrors.title = "标题至少需要 2 个字符";
    } else if (title.trim().length > 100) {
      newErrors.title = "标题不能超过 100 个字符";
    }

    if (!category) {
      newErrors.category = "请选择分类";
    }

    if (!content.trim()) {
      newErrors.content = "请输入内容";
    } else if (content.trim().length < 10) {
      newErrors.content = "内容至少需要 10 个字符";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({ title: title.trim(), category, content: content.trim() });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 标题 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          标题 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
          }}
          placeholder="请输入帖子标题..."
          maxLength={100}
          className={cn(
            "w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-shadow",
            errors.title
              ? "border-red-300 focus:ring-red-500"
              : "border-gray-300 focus:ring-blue-500"
          )}
        />
        {errors.title && (
          <p className="mt-1 text-xs text-red-500">{errors.title}</p>
        )}
        <p className="mt-1 text-xs text-gray-400 text-right">{title.length}/100</p>
      </div>

      {/* 分类 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          分类 <span className="text-red-500">*</span>
        </label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            if (errors.category) setErrors((prev) => ({ ...prev, category: undefined }));
          }}
          className={cn(
            "w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-shadow appearance-none bg-white",
            errors.category
              ? "border-red-300 focus:ring-red-500"
              : "border-gray-300 focus:ring-blue-500"
          )}
        >
          <option value="">请选择分类</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className="mt-1 text-xs text-red-500">{errors.category}</p>
        )}
      </div>

      {/* 内容 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-gray-700">
            内容 <span className="text-red-500">*</span>
          </label>
          {/* 编辑/预览切换 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                activeTab === "edit"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              ✏️ 编辑
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                activeTab === "preview"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              👁 预览
            </button>
          </div>
        </div>
        {activeTab === "edit" ? (
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (errors.content) setErrors((prev) => ({ ...prev, content: undefined }));
            }}
            placeholder="请输入帖子内容...（支持 Markdown 格式）"
            rows={12}
            className={cn(
              "w-full px-4 py-3 text-sm border rounded-lg resize-y focus:outline-none focus:ring-2 focus:border-transparent transition-shadow font-mono",
              errors.content
                ? "border-red-300 focus:ring-red-500"
                : "border-gray-300 focus:ring-blue-500"
            )}
          />
        ) : (
          <div className="w-full min-h-[300px] px-4 py-3 text-sm border border-gray-300 rounded-lg bg-gray-50 overflow-auto">
            {content.trim() ? (
              <div className="prose prose-sm max-w-none markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-gray-400">暂无内容可预览...</p>
            )}
          </div>
        )}
        {errors.content && (
          <p className="mt-1 text-xs text-red-500">{errors.content}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          💡 支持使用 Markdown 语法编写内容
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end space-x-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {initialData ? "保存修改" : "发表帖子"}
        </button>
      </div>
    </form>
  );
}
