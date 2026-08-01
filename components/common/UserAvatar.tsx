"use client";
import { cn } from "@/lib/utils";

// 判断头像是否为图片 URL
function isImageAvatar(avatar: string): boolean {
  return /^(https?:|data:|\/|blob:)/.test(avatar);
}

interface UserAvatarProps {
  username: string;
  avatar?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export default function UserAvatar({ username, avatar, size = "sm", className }: UserAvatarProps) {
  const sizeMap = {
    xs: "w-6 h-6 text-xs",
    sm: "w-8 h-8 text-sm",
    md: "w-9 h-9 text-base",
    lg: "w-12 h-12 text-xl",
  };

  // 头像颜色（基于用户名首字母）
  const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-red-500"];
  const colorIndex = username.charCodeAt(0) % colors.length;
  const initial = username.charAt(0).toUpperCase();

  if (avatar) {
    if (isImageAvatar(avatar)) {
      // 图片 URL 头像
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={username} className={cn("rounded-full object-cover flex-shrink-0", sizeMap[size], className)} />
      );
    }
    // Emoji 头像
    return (
      <div className={cn("rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100", sizeMap[size], className)}>
        <span className="leading-none">{avatar}</span>
      </div>
    );
  }

  // 无头像：首字母 + 随机背景色
  return (
    <div className={cn("rounded-full flex items-center justify-center text-white font-medium flex-shrink-0", sizeMap[size], colors[colorIndex], className)}>
      {initial}
    </div>
  );
}
