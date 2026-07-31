"use client";

import { useState, useCallback, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";
import CommentItem from "./CommentItem";

interface Comment {
  id: string;
  content: string;
  author: { id: string; username: string; avatar: string | null };
  likeCount: number;
  createdAt: string;
  isApproved?: boolean;
  replies?: Comment[];
}

interface CommentListProps {
  comments: Comment[];
  postId: string;
}

export default function CommentList({ comments: initialComments, postId }: CommentListProps) {
  const { user, token } = useAppStore();
  const [content, setContent] = useState("");
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [submitting, setSubmitting] = useState(false);

  // 当外部 comments 变化时同步
  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  // 刷新评论列表
  const refreshComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/forum/comments?postId=${postId}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch {
      // 静默失败
    }
  }, [postId]);

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

  return (
    <div className="mt-8">
      {/* 标题 */}
      <div className="flex items-center space-x-2 mb-6 pb-3 border-b border-gray-200">
        <span className="text-lg font-semibold text-gray-800">
          💬 全部评论 ({comments.length})
        </span>
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
              onReplySuccess={handleReplySuccess}
              onDeleteSuccess={handleDeleteSuccess}
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
              placeholder="写下你的评论..."
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
                {submitting ? "发表中..." : "发表评论"}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">
              请先{" "}
              <a href="/admin/login" className="text-blue-600 hover:underline">
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
