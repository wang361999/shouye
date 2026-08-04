"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import GithubCodeSearch from "./GithubCodeSearch";
import GithubCodeBlock from "./GithubCodeBlock";
import TagInput from "./TagInput";
import { parseGithubUrl, preprocessGithubShortcodes } from "@/lib/github-url";

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

type PostType = "discussion" | "question";

interface PostFormProps {
  categories: Category[];
  initialData?: Post;
  initialTags?: string[];
  initialPostType?: PostType;
  onSubmit: (data: { title: string; category: string; content: string; tags: string[]; postType: PostType }) => void;
  onCancel: () => void;
}

export default function PostForm({
  categories,
  initialData,
  initialTags = [],
  initialPostType = "discussion",
  onSubmit,
  onCancel,
}: PostFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [category, setCategory] = useState(initialData?.category ?? "");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [tags, setTags] = useState<string[]>(initialTags);
  const [postType, setPostType] = useState<PostType>(initialPostType);
  const [errors, setErrors] = useState<{ title?: string; category?: string; content?: string }>({});
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 在光标位置插入文本
  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + text);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = content.slice(0, start) + text + content.slice(end);
    setContent(newValue);
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + text.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  // 粘贴事件处理：自动检测 GitHub 文件链接并转换
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = e.clipboardData.getData("text/plain").trim();
      const parsed = parseGithubUrl(pastedText);
      if (parsed) {
        e.preventDefault();
        const markdown = `\n\`\`\`github-code\n${parsed.source}\n\`\`\`\n`;
        insertAtCursor(markdown);
      }
    },
    [content] // eslint-disable-line react-hooks/exhaustive-deps
  );

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
      onSubmit({ title: title.trim(), category, content: content.trim(), tags, postType });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      {/* 帖子类型切换 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          类型
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPostType("discussion")}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 text-sm font-medium rounded-lg border transition-colors touch-target",
              postType === "discussion"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            )}
          >
            💬 讨论
          </button>
          <button
            type="button"
            onClick={() => setPostType("question")}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 text-sm font-medium rounded-lg border transition-colors touch-target",
              postType === "question"
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            )}
          >
            ❓ 问答
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400 hidden sm:block">
          {postType === "question" ? "问答帖可以采纳最佳回答，提问者可标记满意答案" : "讨论帖用于分享观点和交流经验"}
        </p>
      </div>

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
          placeholder={postType === "question" ? "请输入你的问题..." : "请输入帖子标题..."}
          maxLength={100}
          className={cn(
            "w-full px-3 sm:px-4 py-2.5 text-base sm:text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-shadow",
            errors.title
              ? "border-red-300 focus:ring-red-500"
              : "border-gray-300 focus:ring-blue-500"
          )}
        />
        {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
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
            "w-full px-3 sm:px-4 py-2.5 text-base sm:text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-shadow appearance-none bg-white",
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
        {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category}</p>}
      </div>

      {/* 标签 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          标签
        </label>
        <TagInput value={tags} onChange={setTags} maxTags={5} />
      </div>

      {/* 内容 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-gray-700">
            内容 <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-0.5 sm:gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={cn(
                "px-3 sm:px-4 py-1.5 text-xs font-medium rounded-md transition-colors touch-target flex items-center",
                activeTab === "edit"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              ✏️ <span className="ml-1">编辑</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={cn(
                "px-3 sm:px-4 py-1.5 text-xs font-medium rounded-md transition-colors touch-target flex items-center",
                activeTab === "preview"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              👁 <span className="ml-1">预览</span>
            </button>
          </div>
        </div>
        {activeTab === "edit" ? (
          <>
            <div className="mb-2">
              <GithubCodeSearch onInsert={insertAtCursor} />
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (errors.content) setErrors((prev) => ({ ...prev, content: undefined }));
              }}
              onPaste={handlePaste}
              placeholder="请输入帖子内容...（支持 Markdown 格式）"
              rows={10}
              className={cn(
                "w-full px-3 sm:px-4 py-3 text-sm border rounded-lg resize-y focus:outline-none focus:ring-2 focus:border-transparent transition-shadow font-mono",
                errors.content
                  ? "border-red-300 focus:ring-red-500"
                  : "border-gray-300 focus:ring-blue-500"
              )}
            />
            <p className="mt-1.5 text-xs text-gray-400 hidden sm:block">
              💡 插入 GitHub 代码：直接粘贴文件链接自动识别，或使用上方搜索框引用
            </p>
          </>
        ) : (
          <div className="w-full min-h-[250px] sm:min-h-[300px] px-3 sm:px-4 py-3 text-sm border border-gray-300 rounded-lg bg-gray-50 overflow-auto">
            {content.trim() ? (
              <div className="prose prose-sm max-w-none markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || "");
                      const lang = match ? match[1] : "";
                      const text = String(children).replace(/\n$/, "");
                      if (lang === "github-code") {
                        const [rawPath, queryString] = text.split("?");
                        const params = new URLSearchParams(queryString || "");
                        return (
                          <GithubCodeBlock
                            source={rawPath.trim()}
                            ref={params.get("ref") || undefined}
                            lines={params.get("lines") || undefined}
                          />
                        );
                      }
                      return <code className={className} {...props}>{children}</code>;
                    },
                  }}
                >
                  {preprocessGithubShortcodes(content)}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-gray-400">暂无内容可预览...</p>
            )}
          </div>
        )}
        {errors.content && <p className="mt-1 text-xs text-red-500">{errors.content}</p>}
        <p className="mt-1 text-xs text-gray-400 sm:hidden">
          💡 支持 Markdown，可粘贴 GitHub 链接
        </p>
      </div>

      {/* 操作按钮 - 移动端固定底部栏 */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors touch-target"
        >
          取消
        </button>
        <button
          type="submit"
          className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors touch-target"
        >
          {initialData ? "保存修改" : postType === "question" ? "发布问题" : "发表帖子"}
        </button>
      </div>
    </form>
  );
}
