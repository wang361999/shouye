"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { formatTimeAgo, cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Reply {
  id: string;
  content: string;
  author: { id: string; username: string; avatar: string | null };
  likeCount: number;
  createdAt: string;
  isApproved?: boolean;
  replies?: Reply[];
}

interface CommentItemProps {
  comment: Reply;
  postId: string;
  currentUserId?: string;
  isAdmin?: boolean;
  onReplySuccess?: () => void;
  onDeleteSuccess?: () => void;
  depth?: number;
}

// 根据用户名首字母生成背景色
function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-red-500",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

export default function CommentItem({
  comment,
  postId,
  currentUserId,
  isAdmin,
  onReplySuccess,
  onDeleteSuccess,
  depth = 0,
}: CommentItemProps) {
  const { token } = useAppStore();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replying, setReplying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
  };

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    if (!token) {
      toast.error("请先登录");
      return;
    }

    setReplying(true);
    try {
      const res = await fetch("/api/forum/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId,
          content: replyContent.trim(),
          parentId: comment.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "回复失败");
        return;
      }

      if (data.message && data.isApproved === false) {
        toast.success("回复已提交，等待审核");
      } else {
        toast.success("回复成功");
      }

      setReplyContent("");
      setShowReplyInput(false);
      // 通知父组件刷新
      if (onReplySuccess) {
        onReplySuccess();
      }
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setReplying(false);
    }
  };

  const handleDelete = async () => {
    if (!token) {
      toast.error("请先登录");
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/forum/comments", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ commentId: comment.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "删除失败");
        return;
      }

      toast.success("评论已删除");
      setShowDeleteConfirm(false);
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setDeleting(false);
    }
  };

  const maxDepth = 3; // 最大递归深度
  const initial = comment.author.username.charAt(0).toUpperCase();
  const canDelete = currentUserId && (comment.author.id === currentUserId || isAdmin);

  return (
    <div className={cn(depth > 0 && "ml-6 sm:ml-10 border-l-2 border-gray-100 pl-4")}>
      <div className="flex space-x-3 py-3">
        {/* 头像 */}
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium",
            getAvatarColor(comment.author.username)
          )}
        >
          {initial}
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-w-0">
          {/* 用户名 + 时间 */}
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-sm font-semibold text-gray-800">
              {comment.author.username}
            </span>
            {comment.author.id === currentUserId && (
              <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">我</span>
            )}
            <span className="text-xs text-gray-400">
              {formatTimeAgo(comment.createdAt)}
            </span>
          </div>

          {/* 评论内容 */}
          <p className="text-sm text-gray-600 leading-relaxed mb-2 whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* 操作按钮 */}
          <div className="flex items-center space-x-4">
            <button
              onClick={handleLike}
              className={cn(
                "flex items-center space-x-1 text-xs transition-colors",
                liked ? "text-red-500" : "text-gray-400 hover:text-red-400"
              )}
            >
              <span>{liked ? "❤️" : "🤍"}</span>
              <span>{likeCount}</span>
            </button>

            {depth < maxDepth && (
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="flex items-center space-x-1 text-xs text-gray-400 hover:text-blue-500 transition-colors"
              >
                <span>💬</span>
                <span>回复</span>
              </button>
            )}

            {canDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center space-x-1 text-xs text-gray-400 hover:text-red-400 transition-colors"
              >
                <span>🗑️</span>
                <span>删除</span>
              </button>
            )}
          </div>

          {/* 删除确认 */}
          {showDeleteConfirm && (
            <div className="mt-2 inline-flex items-center gap-2 text-xs bg-red-50 rounded-lg px-3 py-2">
              <span className="text-red-600">确认删除这条评论？</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-1 text-white bg-red-500 rounded hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? "删除中..." : "确认"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 text-gray-500 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
            </div>
          )}

          {/* 回复输入框 */}
          {showReplyInput && (
            <div className="mt-3 flex space-x-2">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={`回复 ${comment.author.username}...`}
                rows={2}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="flex flex-col space-y-1">
                <button
                  onClick={handleReply}
                  disabled={!replyContent.trim() || replying}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                    replyContent.trim() && !replying
                      ? "text-white bg-blue-600 hover:bg-blue-700"
                      : "text-gray-300 bg-gray-100 cursor-not-allowed"
                  )}
                >
                  {replying ? "发送中..." : "发送"}
                </button>
                <button
                  onClick={() => setShowReplyInput(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* 子评论（递归渲染） */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-1">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onReplySuccess={onReplySuccess}
                  onDeleteSuccess={onDeleteSuccess}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
