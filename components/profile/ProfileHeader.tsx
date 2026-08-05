"use client";

import { cn, formatDate } from "@/lib/utils";
import type { UserProfile } from "./types";

interface ProfileHeaderProps {
  profile: UserProfile | null;
  loading: boolean;
  fallbackUser: { username: string; avatar?: string | null };
}

/**
 * 判断头像字符串是否为图片 URL
 * 与 AvatarPicker 保持一致的判定逻辑
 */
function isImageUrl(avatar: string): boolean {
  return /^(https?:|data:|\/|blob:)/.test(avatar);
}

// 微妙网格纹理样式（叠加在深色背景上，增加质感）
const GRID_TEXTURE_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
};

export default function ProfileHeader({
  profile,
  loading,
  fallbackUser,
}: ProfileHeaderProps) {
  // loading 骨架屏
  if (loading && !profile) {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900">
        <div
          className="absolute inset-0 pointer-events-none"
          style={GRID_TEXTURE_STYLE}
        />
        <div className="relative px-5 py-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-800 rounded w-32" />
              <div className="h-3 bg-slate-800/70 rounded w-48" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="text-center">
                <div className="h-6 bg-slate-800 rounded w-12 mx-auto" />
                <div className="h-3 bg-slate-800/70 rounded w-10 mx-auto mt-2" />
              </div>
            ))}
          </div>
          <div className="mt-4 h-1.5 bg-slate-800 rounded-full" />
        </div>
      </div>
    );
  }

  // 头像来源：profile → fallbackUser → 首字母
  const avatarValue =
    profile?.avatar || fallbackUser.avatar || "";
  const displayName = profile?.username || fallbackUser.username;
  const fallbackLetter = displayName.charAt(0).toUpperCase() || "?";
  const avatarIsUrl = avatarValue ? isImageUrl(avatarValue) : false;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900">
      {/* 网格纹理叠加层 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={GRID_TEXTURE_STYLE}
      />

      <div className="relative px-5 py-4">
        {/* ===== 顶部：头像 + 用户名 + 标签 ===== */}
        <div className="flex items-center gap-4">
          {/* 头像 64x64 */}
          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-white/10 bg-slate-800 flex items-center justify-center">
            {avatarValue && avatarIsUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarValue}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : avatarValue ? (
              <span className="text-3xl leading-none">{avatarValue}</span>
            ) : (
              <span className="text-2xl font-bold text-blue-300">
                {fallbackLetter}
              </span>
            )}
          </div>

          {/* 用户名 + 标签 + 邮箱 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-white truncate">
                {displayName}
              </h1>
              {profile && (
                <>
                  {/* 角色标签 */}
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full",
                      profile.role === "ADMIN"
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-slate-700/50 text-slate-300 border border-slate-600/50",
                    )}
                  >
                    {profile.role === "ADMIN" ? "管理员" : "普通用户"}
                  </span>
                  {/* 等级标签 */}
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                    {profile.level.icon} Lv.{profile.level.level}{" "}
                    {profile.level.title}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">
              {profile?.email || "—"}
              {profile && (
                <>
                  <span className="mx-1.5 text-slate-600">·</span>
                  注册于 {formatDate(profile.createdAt)}
                </>
              )}
            </p>
          </div>
        </div>

        {/* ===== 统计数据：3 列紧凑展示 ===== */}
        {profile && (
          <div className="mt-3 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-white">
                {profile.postCount}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">帖子</div>
            </div>
            <div className="text-center border-x border-slate-800">
              <div className="text-xl font-bold text-white">
                {profile.commentCount}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">评论</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">
                {profile.level.currentExp}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">互动数</div>
            </div>
          </div>
        )}

        {/* ===== 等级进度条（level < 6 时显示，更细 h-1.5） ===== */}
        {profile && profile.level.level < 6 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>
                {profile.level.icon} {profile.level.title}
              </span>
              <span>
                {profile.level.currentExp} / {profile.level.nextLevelExp}
              </span>
            </div>
            <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    (profile.level.currentExp / profile.level.nextLevelExp) *
                      100,
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* ===== 简介（如有，小字显示） ===== */}
        {profile?.bio && (
          <p className="mt-2 text-xs text-slate-400 leading-relaxed line-clamp-1">
            {profile.bio}
          </p>
        )}
      </div>
    </div>
  );
}
