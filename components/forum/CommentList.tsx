"use client";

import { useState, useCallback, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";
import CommentItem from "./CommentItem";

interface Comment {
  id: string;
  content: string;
  author: { id: string; username: string; avatar: string | null; reputation?: number; badge?: string | null };
  likeCount: number;
  createdAt: string;
  isApproved?: boolean;
  isAccepted?: boolean;
  replies?: Comment[];
}

interface CommentListProps {
  comments: Comment[];
  postId: string;
  postAuthorId?: string;
  postType?: string;
  acceptedCommentId?: string | null;
}

const fallbackAuthor = {
  id: "",
  username: "未知用户",
  avatar: null,
  reputation: 0,
  badge: null,
};

function normalizeComment(comment: any): Comment {
  const author = comment?.author && typeof comment.author === "object"
    ? {
        ...fallbackAuthor,
        ...comment.author,
        id: String(comment.author.id || ""),
        username: comment.author.username || "未知用户",
      }
    : fallbackAuthor;

  return {
    id: String(comment?.id || ""),
    content: typeof comment?.content === "string" ? comment.content : "",
    author,
    likeCount: Number(comment?.likeCount || 0),
    createdAt: comment?.createdAt || new Date().toISOString(),
    isApproved: comment?.isApproved,
    isAccepted: comment?.isAccepted,
    replies: Array.isArray(comment?.replies)
      ? comment.replies.map(normalizeComment).filter((reply: Comment) => reply.id)
      : [],
  };
}

function normalizeComments(comments: unknown): Comment[] {
  return Array.isArray(comments)
    ? comments.map(normalizeComment).filter((comment) => comment.id)
    : [];
}

export default function CommentList({
  comments: initialComments,
  postId,
  postAuthorId,
  postType,
  acceptedCommentId,
}: CommentListProps) {
  const { user, token } = useAppStore();
  const [content, setContent] = useState("");
  const [comments, setComments] = useState<Comment[]>(() => normalizeComments(initialComments));
  const [submitting, setSubmitting] = useState(false);
  const [currentAcceptedId, setCurrentAcceptedId] = useState<string | null>(acceptedCommentId || null);

  // 当外部 comments 变化时同步
  useEffect(() => {
    setComments(normalizeComments(initialComments));
  }, [initialComments]);

  useEffect(() => {
    setCurrentAcceptedId(acceptedCommentId || null);
  }, [acceptedCommentId]);

  // 刷新评论列表
  const refreshComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/forum/comments?postId=${postId}`);
      if (res.ok) {
        const data = await res.json();
        setComments(normalizeComments(data));
      }
    } catch {
      // 静默失败
    }
  }, [postId]);

  // 挂载时主动从评论 API 获取全部评论（帖子详情 API 只返回 10 条）
  useEffect(() => {
    refreshComments();
  }, [refreshComments]);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    if (!token) {
      toast.error("请先登录");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/forum/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postId, content: content.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "发表评论失败");
        return;
      }

      // 检查是否待审核
      if (data.message && data.isApproved === false) {
        toast.success("评论已提交，等待审核");
      } else {
        toast.success("评论发表成功");
      }

      setContent("");
      // 刷新评论列表
      await refreshComments();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  // 回复成功后的回调
  const handleReplySuccess = useCallback(() => {
    refreshComments();
  }, [refreshComments]);

  // 删除评论后的回调
  const handleDeleteSuccess = useCallback(() => {
    refreshComments();
  }, [refreshComments]);

  // 采纳成功后刷新
  const handleAcceptSuccess = useCallback(() => {
    refreshComments();
    // 重新获取帖子详情以更新 acceptedCommentId
    fetch(`/api/forum/posts/${postId}`)
      .then((res) => res.json())
      .then((data) => {
        setCurrentAcceptedId(data.acceptedCommentId || null);
      })
      .catch(() => {});
  }, [postId, refreshComments]);

  return (
    <div className="mt-8">
      {/* 标题 */}
      <div className="flex items-center space-x-2 mb-6 pb-3 border-b border-gray-200">
        <span className="text-lg font-semibold text-gray-800">
          💬 全部评论 ({comments.length})
        </span>
        {postType === "question" && currentAcceptedId && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
            已有采纳答案
          </span>
        )}
      </div>

      {/* 评论列表 */}
      {comments.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p className="text-lg mb-2">💭</p>
          <p>暂无评论，快来抢沙发吧~</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              currentUserId={user?.id}
              isAdmin={user?.role === "ADMIN"}
              postAuthorId={postAuthorId}
              postType={postType}
              isAcceptedComment={currentAcceptedId === comment.id}
              acceptedCommentId={currentAcceptedId}
              onReplySuccess={handleReplySuccess}
              onDeleteSuccess={handleDeleteSuccess}
              onAcceptSuccess={handleAcceptSuccess}
              depth={0}
            />
          ))}
        </div>
      )}

      {/* 底部评论输入区 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        {user ? (
          <div className="space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={postType === "question" ? "写下你的回答..." : "写下你的评论..."}
              rows={3}
              className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">支持 Markdown 格式</p>
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || submitting}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
                  content.trim() && !submitting
                    ? "text-white bg-blue-600 hover:bg-blue-700"
                    : "text-gray-300 bg-gray-100 cursor-not-allowed"
                }`}
              >
                {submitting ? "发表中..." : postType === "question" ? "发表回答" : "发表评论"}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">
              请先{" "}
              <a href="/login" className="text-blue-600 hover:underline">
                登录
              </a>{" "}
              后再发表评论
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
