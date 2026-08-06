"use client";
import Image from 'next/image';
import { cn } from "@/lib/utils";

// 判断头像是否为图片 URL
function isImageAvatar(avatar: string): boolean {
  return /^(https?:|\/|blob:)/.test(avatar);
}

// 判断是否为 data URI（next/image 不优化 data URI，用原生 img）
function isDataUri(avatar: string): boolean {
  return /^data:/.test(avatar);
}

interface UserAvatarProps {
  username: string;
  avatar?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

// size 映射到像素尺寸（用于 next/image 的 width/height）
const SIZE_PIXELS: Record<string, number> = {
  xs: 24,
  sm: 32,
  md: 36,
  lg: 48,
};

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
  const pixelSize = SIZE_PIXELS[size] || 32;

  if (avatar) {
    if (isImageAvatar(avatar)) {
      // data URI 用原生 img（next/image 不优化 data URI）
      if (isDataUri(avatar)) {
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt={username}
            loading="lazy"
            className={cn("rounded-full object-cover flex-shrink-0", sizeMap[size], className)}
          />
        );
      }

      // 外部 URL 图片用 next/image 优化（自动 WebP/AVIF、尺寸适配）
      return (
        <Image
          src={avatar}
          alt={username}
          width={pixelSize}
          height={pixelSize}
          className={cn("rounded-full object-cover flex-shrink-0", sizeMap[size], className)}
          loading="lazy"
          // 头像尺寸小，用较低质量即可（减少体积）
          quality={75}
          // 加载失败时降级显示首字母
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = 'none';
          }}
        />
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
