"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatTimeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import type { MyComment } from "./types";

interface MyCommentsTabProps {
  user: { id: string };
  token: string | null;
}

// /api/user/comments 返回结构（新接口，一次性获取当前用户评论，解决 N+1）
interface UserCommentsApiResponse {
  comments: RawCommentItem[];
  total: number;
  totalPages: number;
}

interface RawCommentItem {
  id: string | number;
  content: string;
  postId: string | number;
  postTitle: string;
  createdAt: string;
}

// /api/forum/comments?postId= 返回的嵌套评论结构（降级逻辑用）
interface RawNestedComment {
  id: string | number;
  content: string;
  postId: string | number;
  authorId?: string | number;
  author?: { id: string | number; username: string; avatar: string | null };
  replies?: RawNestedComment[];
  createdAt: string;
}

// ============ 骨架屏 ============
function CommentSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-full mb-2" />
      <div className="h-3 bg-gray-100 rounded w-1/3" />
    </div>
  );
}

export default function MyCommentsTab({ user, token }: MyCommentsTabProps) {
  const [comments, setComments] = useState<MyComment[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * 优先使用新接口 /api/user/comments 一次性获取当前用户评论，避免 N+1 查询。
   * 返回 true 表示成功；返回 false 表示接口不可用（如 404），需降级。
   */
  const fetchCommentsViaNewApi = useCallback(async (): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch("/api/user/comments?page=1&limit=20", {
        headers: { Authorization: `Bearer ${token}` },
      });
      // 新接口不存在（404）时降级为旧逻辑
      if (res.status === 404) return false;
      if (!res.ok) throw new Error("获取评论失败");
      const data: UserCommentsApiResponse = await res.json();
      const formatted: MyComment[] = (data.comments || []).map((c) => ({
        id: String(c.id),
        content: c.content,
        postId: String(c.postId),
        postTitle: c.postTitle,
        createdAt: c.createdAt,
      }));
      formatted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setComments(formatted);
      return true;
    } catch (err) {
      // 新接口调用异常，降级到旧逻辑
      console.warn(
        "[MyCommentsTab] 新接口 /api/user/comments 调用失败，降级为旧逻辑:",
        err instanceof Error ? err.message : err,
      );
      return false;
    }
  }, [token]);

  /**
   * 降级逻辑（旧逻辑）：存在 N+1 问题，仅在新接口 /api/user/comments 不可用时使用。
   * 1. 获取当前用户的全部帖子（limit=100）
   * 2. 对每个帖子请求评论列表（/api/forum/comments?postId=）
   * 3. 递归过滤出当前用户的评论
   * 注意：该方式只能获取用户在自己帖子下的评论，存在覆盖不全的问题。
   */
  const fetchCommentsViaFallback = useCallback(async () => {
    if (!user) return;
    try {
      const postsRes = await fetch(
        `/api/forum/posts?authorId=${user.id}&limit=100`,
      );
      if (!postsRes.ok) throw new Error("获取帖子失败");
      const postsData = await postsRes.json();
      const userPosts: { id: string | number; title: string }[] =
        postsData.posts || [];

      const allComments: MyComment[] = [];

      // 递归收集当前用户的评论（包含子回复）
      const collectUserComments = (
        list: RawNestedComment[],
        postId: string | number,
        postTitle: string,
      ) => {
        for (const c of list) {
          if (c.author && String(c.author.id) === String(user.id)) {
            allComments.push({
              id: String(c.id),
              content: c.content,
              postId: String(postId),
              postTitle,
              createdAt: c.createdAt,
            });
          }
          if (c.replies && c.replies.length > 0) {
            collectUserComments(c.replies, postId, postTitle);
          }
        }
      };

      for (const p of userPosts) {
        const commentsRes = await fetch(`/api/forum/comments?postId=${p.id}`);
        if (!commentsRes.ok) continue;
        const postComments: RawNestedComment[] = await commentsRes.json();
        collectUserComments(postComments, p.id, p.title);
      }

      allComments.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setComments(allComments);
    } catch (err) {
      const message = err instanceof Error ? err.message : "获取我的评论失败";
      toast.error(message);
    }
  }, [user]);

  const fetchComments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // 优先新接口，失败/不可用（404）则降级为旧逻辑
    const ok = await fetchCommentsViaNewApi();
    if (!ok) {
      await fetchCommentsViaFallback();
    }
    setLoading(false);
  }, [user, fetchCommentsViaNewApi, fetchCommentsViaFallback]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // 加载中：骨架屏
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <CommentSkeleton key={i} />
        ))}
      </div>
    );
  }

  // 空状态
  if (comments.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <div className="w-16 h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center text-3xl mb-4">
          💬
        </div>
        <p className="text-gray-500 mb-4">还没有发表过评论</p>
        <Link
          href="/forum"
          className="inline-block px-5 py-2.5 text-[13px] sm:text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
        >
          去论坛看看
        </Link>
      </div>
    );
  }

  // 评论列表：内容（3 行截断）+ 所属帖子标题（Link）+ 时间
  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
        >
          <p className="text-[11px] sm:text-sm text-gray-800 leading-relaxed mb-3 line-clamp-3">
            {comment.content}
          </p>
          <div className="flex items-center justify-between">
            <Link
              href={`/forum/post/${comment.postId}`}
              className="text-xs text-blue-600 hover:text-blue-700 hover:underline truncate max-w-[70%]"
            >
              📄 {comment.postTitle}
            </Link>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {formatTimeAgo(comment.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
