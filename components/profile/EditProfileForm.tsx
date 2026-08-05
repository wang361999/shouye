"use client";

import { useState } from "react";
import AvatarPicker from "@/components/common/AvatarPicker";
import toast from "react-hot-toast";
import type { UserProfile } from "./types";

interface EditProfileFormProps {
  profile: UserProfile;
  token: string;
  user: { id: string; username: string; role: 'ADMIN' | 'USER'; avatar?: string | null };
  setAuth: (
    user: { id: string; username: string; role: 'ADMIN' | 'USER'; avatar?: string | null },
    token: string,
  ) => void;
  updateAvatar: (avatar: string | null) => void;
}

export default function EditProfileForm({
  profile,
  token,
  user,
  setAuth,
  updateAvatar,
}: EditProfileFormProps) {
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio || "");
  const [avatar, setAvatar] = useState(profile.avatar || "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    // 校验用户名
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      toast.error("用户名不能为空");
      return;
    }
    if (trimmedUsername.length > 20) {
      toast.error("用户名不能超过 20 个字符");
      return;
    }
    // 校验简介
    if (bio.length > 200) {
      toast.error("个人简介不能超过 200 个字符");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: trimmedUsername,
          bio: bio.trim(),
          avatar: avatar.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "保存失败");
      }

      toast.success(data.message || "资料更新成功");

      // 同步本地头像状态
      setAvatar(data.avatar || "");

      // 更新全局 store：用户名变化时整体 setAuth，否则仅更新头像
      if (data.username !== user.username) {
        setAuth(
          {
            id: user.id,
            username: data.username,
            role: user.role,
            avatar: data.avatar,
          },
          token,
        );
      } else {
        updateAvatar(data.avatar);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "保存失败，请稍后重试";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* 标题行 */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">✏️</span>
        <h2 className="text-lg font-semibold text-gray-900">编辑资料</h2>
      </div>
      <p className="text-[11px] sm:text-sm text-gray-500 mb-6">
        修改你的头像、用户名和个人简介
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 头像选择器 */}
        <div>
          <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
            头像
          </label>
          <AvatarPicker
            currentAvatar={avatar}
            username={username || profile.username}
            onAvatarChange={setAvatar}
          />
        </div>

        {/* 用户名 */}
        <div>
          <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
            用户名
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入用户名"
            maxLength={20}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 个人简介 */}
        <div>
          <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
            个人简介
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="介绍一下自己吧..."
            maxLength={200}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <p className="mt-1 text-xs text-gray-400 text-right">
            {bio.length}/200
          </p>
        </div>

        {/* 保存按钮 */}
        <div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-[13px] sm:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "保存中..." : "保存资料"}
          </button>
        </div>
      </form>
    </div>
  );
}
