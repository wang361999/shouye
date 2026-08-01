"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { formatTimeAgo, cn } from "@/lib/utils";
import UserAvatar from "@/components/common/UserAvatar";
import { ReputationBadge } from "./ReputationBadge";
import toast from "react-hot-toast";

interface Reply {
  id: string;
  content: string;
  author: { id: string; username: string; avatar: string | null; reputation?: number; badge?: string | null };
  likeCount: number;
  createdAt: string;
  isApproved?: boolean;
  isAccepted?: boolean;
  replies?: Reply[];
}

interface CommentItemProps {
  comment: Reply;
  postId: string;
  currentUserId?: string;
  isAdmin?: boolean;
  postAuthorId?: string;
  postType?: string;
  isAcceptedComment?: boolean;
  onReplySuccess?: () => void;
  onDeleteSuccess?: () => void;
  onAcceptSuccess?: () => void;
  depth?: number;
}

export default function CommentItem({
  comment,
  postId,
  currentUserId,
  isAdmin,
  postAuthorId,
  postType,
  isAcceptedComment,
  onReplySuccess,
  onDeleteSuccess,
  onAcceptSuccess,
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
  const [showReportModal, setShowReportModal] = useState(false);
  const [accepting, setAccepting] = useState(false);

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

  // 采纳回答（仅问答帖作者可操作）
  const handleAccept = async () => {
    if (!token) {
      toast.error("请先登录");
      return;
    }
    setAccepting(true);
    try {
      const res = await fetch("/api/forum/posts/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postId, commentId: comment.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "采纳失败");
        return;
      }
      toast.success("已采纳该回答");
      if (onAcceptSuccess) {
        onAcceptSuccess();
      }
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setAccepting(false);
    }
  };

  // 举报
  const handleReport = async (reason: string, description: string) => {
    if (!token) {
      toast.error("请先登录");
      return;
    }
    try {
      const res = await fetch("/api/forum/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType: "comment",
          targetId: comment.id,
          reason,
          description: description || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "举报失败");
        return;
      }
      toast.success("举报已提交，管理员将尽快处理");
      setShowReportModal(false);
    } catch {
      toast.error("网络错误，请稍后重试");
    }
  };

  const maxDepth = 3;
  const canDelete = currentUserId && (comment.author.id === currentUserId || isAdmin);
  const canAccept = postType === "question" && currentUserId === postAuthorId && !isAcceptedComment && comment.author.id !== currentUserId;

  return (
    <div className={cn(depth > 0 && "ml-6 sm:ml-10 border-l-2 border-gray-100 pl-4")}>
      <div className={cn("flex space-x-3 py-3", isAcceptedComment && "bg-green-50/50 -mx-4 px-4 rounded-lg")}>
        {/* 头像 */}
        <UserAvatar username={comment.author.username} avatar={comment.author.avatar} size="sm" />

        {/* 内容区 */}
        <div className="flex-1 min-w-0">
          {/* 用户名 + 时间 + 声望 */}
          <div className="flex items-center space-x-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">
              {comment.author.username}
            </span>
            {comment.author.id === currentUserId && (
              <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">我</span>
            )}
            {comment.author.reputation !== undefined && (
              <ReputationBadge reputation={comment.author.reputation} badge={comment.author.badge} size="xs" />
            )}
            <span className="text-xs text-gray-400">
              {formatTimeAgo(comment.createdAt)}
            </span>
            {isAcceptedComment && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full font-medium">
                ✓ 已采纳
              </span>
            )}
          </div>

          {/* 评论内容 */}
          <p className="text-sm text-gray-600 leading-relaxed mb-2 whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* 操作按钮 */}
          <div className="flex items-center space-x-4 flex-wrap">
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

            {/* 采纳按钮 */}
            {canAccept && (
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="flex items-center space-x-1 text-xs text-green-500 hover:text-green-600 transition-colors disabled:opacity-50"
              >
                <span>✓</span>
                <span>{accepting ? "采纳中..." : "采纳"}</span>
              </button>
            )}

            {/* 举报按钮 */}
            {currentUserId && comment.author.id !== currentUserId && (
              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center space-x-1 text-xs text-gray-400 hover:text-orange-500 transition-colors"
              >
                <span>🚩</span>
                <span>举报</span>
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

          {/* 举报弹窗 */}
          {showReportModal && (
            <ReportModal
              onClose={() => setShowReportModal(false)}
              onSubmit={handleReport}
            />
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
                  postAuthorId={postAuthorId}
                  postType={postType}
                  isAcceptedComment={isAcceptedComment && reply.id === comment.id}
                  onReplySuccess={onReplySuccess}
                  onDeleteSuccess={onDeleteSuccess}
                  onAcceptSuccess={onAcceptSuccess}
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

// 举报弹窗组件
function ReportModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (reason: string, description: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  const reasons = [
    { value: "spam", label: "垃圾广告 / 推广", icon: "📢" },
    { value: "abuse", label: "辱骂 / 人身攻击", icon: "💢" },
    { value: "inappropriate", label: "不当内容", icon: "⚠️" },
    { value: "other", label: "其他", icon: "📋" },
  ];

  return (
    <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">🚩 举报此评论</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {reasons.map((r) => (
          <button
            key={r.value}
            onClick={() => setReason(r.value)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-colors text-left",
              reason === r.value
                ? "bg-orange-50 text-orange-600 border-orange-300"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            <span>{r.icon}</span>
            <span>{r.label}</span>
          </button>
        ))}
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="补充说明（可选）"
        rows={2}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          取消
        </button>
        <button
          onClick={() => reason && onSubmit(reason, description)}
          disabled={!reason}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
            reason
              ? "text-white bg-orange-500 hover:bg-orange-600"
              : "text-gray-300 bg-gray-200 cursor-not-allowed"
          )}
        >
          提交举报
        </button>
      </div>
    </div>
  );
}
