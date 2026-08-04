"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

/** 邮箱格式校验 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAppStore((s) => s.setAuth);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailVerifyEnabled, setEmailVerifyEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setEmailVerifyEnabled(Boolean(data?.email_verify)))
      .catch(() => setEmailVerifyEnabled(false));
  }, []);

  useEffect(() => {
    if (codeCountdown <= 0) return;
    const timer = window.setTimeout(() => setCodeCountdown((v) => v - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [codeCountdown]);

  async function handleSendCode() {
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      toast.error("请先输入正确的邮箱地址");
      return;
    }

    try {
      setSendingCode(true);
      const res = await fetch("/api/auth/email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, purpose: "register" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "验证码发送失败");
        return;
      }
      toast.success(data.message || "验证码已发送，请查收邮箱");
      setCodeCountdown(60);
    } catch {
      toast.error("验证码发送失败，请稍后重试");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    // ---- 表单验证 ----
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      toast.error("用户名长度需为 3-20 个字符");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      toast.error("邮箱格式不正确");
      return;
    }
    if (password.length < 6) {
      toast.error("密码长度至少 6 位");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("两次输入的密码不一致");
      return;
    }
    if (emailVerifyEnabled && !/^\d{6}$/.test(emailCode.trim())) {
      toast.error("请输入 6 位邮箱验证码");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmedUsername,
          email: trimmedEmail,
          password,
          emailCode: emailCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "注册失败");
        return;
      }

      // 注册成功后自动登录并跳转首页
      setAuth(data.user, data.token);
      toast.success("注册成功，欢迎加入！");
      router.push("/");
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Logo + 标题 */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">📝</div>
            <h1 className="text-2xl font-bold text-gray-900">注册账号</h1>
            <p className="text-gray-500 text-[11px] sm:text-sm mt-1">加入 Gitd 社区</p>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="3-20 个字符"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                autoComplete="email"
              />
            </div>

            {emailVerifyEnabled && (
              <div>
                <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                  邮箱验证码
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6 位验证码"
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sendingCode || codeCountdown > 0}
                    className="px-4 py-2.5 bg-blue-50 text-blue-600 text-[13px] sm:text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {sendingCode
                      ? "发送中..."
                      : codeCountdown > 0
                        ? `${codeCountdown}s`
                        : "获取验证码"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  后台已开启邮件验证，注册前需要先验证邮箱。
                </p>
              </div>
            )}

            <div>
              <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                确认密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入密码"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "注册中..." : "注 册"}
            </button>
          </form>

          {/* 分隔线 */}
          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="px-3 text-xs text-gray-400">或</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* GitHub 注册 */}
          <a
            href="/api/auth/github"
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            GitHub 注册
          </a>

          {/* 登录链接 */}
          <div className="mt-6 text-center text-[11px] sm:text-sm text-gray-500">
            已有账号？
            <Link
              href="/login"
              className="text-blue-600 hover:text-blue-700 font-medium ml-1"
            >
              去登录
            </Link>
          </div>

          {/* 返回首页 */}
          <div className="mt-4 text-center">
            <Link
              href="/"
              className="text-[11px] sm:text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              返回首页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
