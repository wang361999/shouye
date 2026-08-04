"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatTimeAgo, truncateText, stripMarkdown, cn, getCategoryDisplayName } from "@/lib/utils";
import UserAvatar from "@/components/common/UserAvatar";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

interface Post {
  id: string;
  title: string;
  content: string;
  author: { username: string; avatar?: string | null };
  category: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isEssence: boolean;
  createdAt: string;
  authorId?: string;
  postType?: string;
  isAIGenerated?: boolean;
  tags?: { tag: { id: string; name: string; slug: string } }[];
}

interface PostCardProps {
  post: Post;
  showActions?: boolean;
}

// 分类 → 颜色点 & 标签（去掉 emoji，用颜色圆点代替）
const categoryMap: Record<
  string,
  { dot: string; label: string; textClass: string }
> = {
  announcement: {
    dot: "bg-amber-500",
    label: "公告",
    textClass: "text-amber-700",
  },
  feedback: {
    dot: "bg-blue-500",
    label: "反馈",
    textClass: "text-blue-700",
  },
  tutorial: {
    dot: "bg-emerald-500",
    label: "教程",
    textClass: "text-emerald-700",
  },
  chat: {
    dot: "bg-violet-500",
    label: "闲聊",
    textClass: "text-violet-700",
  },
};

// SVG 图标组件
const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const HeartIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const CommentIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const PinIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M16 3l5 5-3 1-3 3-1 5-2-2-4 4-1-1 4-4-2-2 5-1 3-3 1-3z" />
  </svg>
);

const StarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

export default function PostCard({ post, showActions = false }: PostCardProps) {
  const router = useRouter();
  const { user, token } = useAppStore();
  const matchedCat = categoryMap[post.category];
  const category = matchedCat ?? {
    dot: "bg-gray-400",
    label: getCategoryDisplayName(post.category, post.category),
    textClass: "text-gray-600",
  };

  const canManage = showActions && user && (post.authorId === user.id || user.role === "ADMIN");

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) {
      toast.error("请先登录");
      return;
    }
    if (!confirm("确定要删除这篇帖子吗？删除后无法恢复。")) {
      return;
    }
    try {
      const res = await fetch(`/api/forum/posts/${post.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("帖子已删除");
        router.refresh();
      } else {
        const errData = await res.json();
        toast.error(errData.error || "删除失败");
      }
    } catch {
      toast.error("删除帖子失败");
    }
  };

  // 左侧强调条颜色
  const accentBar = post.isPinned
    ? "bg-red-500"
    : post.isEssence
      ? "bg-amber-500"
      : "";

  return (
    <article
      className={cn(
        "group relative bg-white rounded-xl border border-gray-200/80 transition-all duration-200 hover:border-gray-300 hover:shadow-sm",
        "overflow-hidden",
      )}
    >
      {/* 左侧强调条 — 置顶/精华 */}
      {accentBar && (
        <div className={cn("absolute left-0 top-0 bottom-0 w-1", accentBar)} />
      )}

      <div className="p-3 sm:p-5 pl-4 sm:pl-6">
        {/* 顶部：用户信息 */}
        <div className="flex items-center gap-2 sm:gap-2.5 mb-2">
          <UserAvatar
            username={post.author.username}
            avatar={post.author.avatar}
            size="sm"
            className="!w-6 !h-6 sm:!w-7 sm:!h-7 !text-[10px] sm:!text-xs"
          />
          <span className="text-[11px] sm:text-sm font-medium text-gray-700 truncate">
            {post.author.username}
          </span>
          <span className="text-gray-300 text-[11px] sm:text-xs">·</span>
          <span className="text-[11px] sm:text-xs text-gray-400 shrink-0">
            {formatTimeAgo(post.createdAt)}
          </span>

          {/* 右侧标签 — 移动端移到第二行 */}
          <div className="ml-auto hidden sm:flex items-center gap-1.5 shrink-0">
            {/* 分类标签 — 颜色点 + 文字 */}
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium", category.textClass)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", category.dot)} />
              {category.label}
            </span>

            {/* AI 创作 */}
            {post.isAIGenerated && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 bg-violet-50 rounded">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI 创作
              </span>
            )}

            {/* 置顶 */}
            {post.isPinned && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 bg-red-50 rounded">
                <PinIcon className="w-2.5 h-2.5" />
                置顶
              </span>
            )}

            {/* 精华 */}
            {post.isEssence && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 rounded">
                <StarIcon className="w-2.5 h-2.5" />
                精华
              </span>
            )}

            {/* 问答类型 */}
            {post.postType === "question" && (
              <>
                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded">
                  问答
                </span>
                {post.commentCount === 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 bg-blue-50 rounded">
                    待解答
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* 移动端标签行 */}
        <div className="flex sm:hidden flex-wrap items-center gap-1.5 mb-2">
          <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", category.textClass)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", category.dot)} />
            {category.label}
          </span>
          {post.isAIGenerated && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 bg-violet-50 rounded">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI 创作
            </span>
          )}
          {post.isPinned && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 bg-red-50 rounded">
              <PinIcon className="w-2.5 h-2.5" />
              置顶
            </span>
          )}
          {post.isEssence && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 rounded">
              <StarIcon className="w-2.5 h-2.5" />
              精华
            </span>
          )}
          {post.postType === "question" && (
            <>
              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded">
                问答
              </span>
              {post.commentCount === 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 bg-blue-50 rounded">
                  待解答
                </span>
              )}
            </>
          )}
        </div>

        {/* 标题 */}
        <h3 className="text-[13px] sm:text-base font-semibold text-gray-900 mb-1.5 leading-snug">
          <Link
            href={`/forum/post/${post.id}`}
            className="hover:text-indigo-600 transition-colors"
          >
            {post.title}
          </Link>
        </h3>

        {/* 正文预览 */}
        <p className="text-[11px] sm:text-sm text-gray-500 mb-3 leading-relaxed line-clamp-2">
          {truncateText(stripMarkdown(post.content), 120)}
        </p>

        {/* 标签 */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {post.tags.slice(0, 4).map(({ tag }) => (
              <Link
                key={tag.id}
                href={`/forum?tag=${encodeURIComponent(tag.slug)}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center px-2 py-0.5 text-[11px] sm:text-xs font-medium text-gray-500 bg-gray-50 border border-gray-100 rounded hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-colors"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        )}

        {/* 底部统计行 */}
        <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs text-gray-400">
          <span className="inline-flex items-center gap-1">
            <EyeIcon className="w-3.5 h-3.5" />
            {post.viewCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <HeartIcon className="w-3.5 h-3.5" />
            {post.likeCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <CommentIcon className="w-3.5 h-3.5" />
            {post.commentCount}
          </span>

          {/* 管理按钮 */}
          {canManage && (
            <div className="ml-auto flex items-center gap-2">
              <Link
                href={`/forum/post/${post.id}/edit`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors"
              >
                编辑
              </Link>
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors"
              >
                删除
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
