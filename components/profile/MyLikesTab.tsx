"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import PostCard from "./PostCard";
import type { MyPost } from "./types";

interface MyLikesTabProps {
  user: { id: string };
  token: string | null;
}

// /api/user/likes 返回的原始点赞帖子结构
interface RawLikedPost {
  id: string | number;
  title: string;
  summary?: string;
  category?: { id: string | number; name: string; slug: string } | null;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  isPinned?: boolean;
  isEssence?: boolean;
  createdAt: string;
}

interface LikesApiResponse {
  posts: RawLikedPost[];
  total: number;
  page: number;
  totalPages: number;
}

// ============ 分页控件（内部组件，与 MyPostsTab 保持一致）============
interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 pt-6">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className={cn(
          "px-3 py-1.5 text-[11px] sm:text-sm rounded-md border transition-colors",
          page <= 1
            ? "text-gray-300 border-gray-200 cursor-not-allowed"
            : "text-gray-600 border-gray-300 hover:bg-gray-50",
        )}
      >
        上一页
      </button>
      <span className="px-3 py-1.5 text-[11px] sm:text-sm text-gray-600">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className={cn(
          "px-3 py-1.5 text-[11px] sm:text-sm rounded-md border transition-colors",
          page >= totalPages
            ? "text-gray-300 border-gray-200 cursor-not-allowed"
            : "text-gray-600 border-gray-300 hover:bg-gray-50",
        )}
      >
        下一页
      </button>
    </div>
  );
}

// ============ 骨架屏 ============
function PostCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
      <div className="h-3 bg-gray-100 rounded w-full mb-2" />
      <div className="h-3 bg-gray-100 rounded w-1/3" />
    </div>
  );
}

export default function MyLikesTab({ user, token }: MyLikesTabProps) {
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLikes = useCallback(
    async (currentPage: number) => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/user/likes?page=${currentPage}&limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("获取点赞列表失败");
        const data: LikesApiResponse = await res.json();
        const formatted: MyPost[] = (data.posts || []).map((p) => ({
          id: String(p.id),
          title: p.title,
          summary: p.summary || "",
          category: p.category
            ? {
                id: String(p.category.id),
                name: p.category.name,
                slug: p.category.slug,
              }
            : null,
          viewCount: p.viewCount || 0,
          likeCount: p.likeCount || 0,
          commentCount: p.commentCount || 0,
          isPinned: p.isPinned || false,
          isEssence: p.isEssence || false,
          createdAt: p.createdAt,
        }));
        setPosts(formatted);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        const message = err instanceof Error ? err.message : "获取点赞列表失败";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!user || !token) {
      setLoading(false);
      return;
    }
    fetchLikes(page);
  }, [page, user, token, fetchLikes]);

  const handlePageChange = (next: number) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 加载中：骨架屏
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // 空状态
  if (posts.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <div className="w-16 h-16 mx-auto bg-red-50 rounded-full flex items-center justify-center text-3xl mb-4">
          ❤️
        </div>
        <p className="text-gray-500 mb-4">还没有点赞过帖子</p>
        <Link
          href="/forum"
          className="inline-block px-5 py-2.5 text-[13px] sm:text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
        >
          去论坛看看
        </Link>
      </div>
    );
  }

  // 点赞帖子列表 + 分页（showActions=false）
  return (
    <>
      <div className="space-y-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </>
  );
}
