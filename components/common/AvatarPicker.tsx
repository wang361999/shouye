"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// 预设 Emoji 头像列表（约 30 个常用 emoji）
const PRESET_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅",
  "🙂", "😉", "😊", "😎", "🤓", "🥳",
  "😴", "🤔", "😇", "🥰", "🤩", "🧑‍💻",
  "🦸", "🧙", "👻", "🤖", "🐱", "🐶",
  "🦊", "🐼", "🐯", "🦄", "🚀", "⭐",
];

interface AvatarPickerProps {
  currentAvatar: string | null;
  username: string;
  onAvatarChange: (avatar: string) => void;
}

/**
 * 判断头像字符串是否为图片 URL
 * 支持 http(s)、data:、相对路径和 blob: 协议，其余视为 emoji 文本
 */
function isImageUrl(avatar: string): boolean {
  return /^(https?:|data:|\/|blob:)/.test(avatar);
}

export default function AvatarPicker({
  currentAvatar,
  username,
  onAvatarChange,
}: AvatarPickerProps) {
  // URL 输入框的值（仅当当前头像是图片 URL 时回填）
  const [urlInput, setUrlInput] = useState(
    currentAvatar && isImageUrl(currentAvatar) ? currentAvatar : "",
  );
  // 图片加载失败标记（用于回退到首字母预览，避免显示裂图）
  const [imgError, setImgError] = useState(false);

  // 当外部 currentAvatar 变化时（如首次加载资料），同步 URL 输入框并重置错误标记
  useEffect(() => {
    if (currentAvatar && isImageUrl(currentAvatar)) {
      setUrlInput(currentAvatar);
    } else {
      setUrlInput("");
    }
    setImgError(false);
  }, [currentAvatar]);

  // 预览头像值（空字符串表示无头像）
  const previewAvatar = currentAvatar || "";
  const previewIsUrl = previewAvatar && isImageUrl(previewAvatar);
  // 是否展示图片预览（URL 类型且未加载失败）
  const showImg = previewIsUrl && !imgError;
  // 回退首字母
  const fallbackLetter = username.charAt(0).toUpperCase() || "?";

  // 选中某个 emoji
  const handlePickEmoji = (emoji: string) => {
    setUrlInput("");
    onAvatarChange(emoji);
  };

  // 输入图片链接
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrlInput(value);
    const trimmed = value.trim();
    if (trimmed) {
      onAvatarChange(trimmed);
    }
  };

  // 清除头像
  const handleClear = () => {
    setUrlInput("");
    onAvatarChange("");
  };

  return (
    <div className="space-y-4">
      {/* 实时预览 */}
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-4xl flex-shrink-0 overflow-hidden border-2 border-blue-200">
          {showImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewAvatar}
              alt="头像预览"
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : previewAvatar && !previewIsUrl ? (
            <span className="leading-none">{previewAvatar}</span>
          ) : (
            <span className="text-2xl font-bold">{fallbackLetter}</span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">头像预览</p>
          <p className="text-xs text-gray-400 mt-0.5">
            选择下方 Emoji 或粘贴图片链接
          </p>
        </div>
      </div>

      {/* 预设 Emoji 头像 */}
      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">
          选择 Emoji 头像
        </p>
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
          {PRESET_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handlePickEmoji(emoji)}
              className={cn(
                "aspect-square flex items-center justify-center text-2xl rounded-lg border transition-all hover:bg-blue-50 hover:border-blue-300",
                currentAvatar === emoji
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                  : "border-gray-200",
              )}
              title={`选择 ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* 图片链接输入 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          或输入图片链接
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={handleUrlChange}
            placeholder="https://example.com/avatar.png"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {(currentAvatar || urlInput) && (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              清除
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          支持 https 图片链接，清除后将使用用户名首字母
        </p>
      </div>
    </div>
  );
}
