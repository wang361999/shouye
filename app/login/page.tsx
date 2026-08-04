"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAppStore((s) => s.setAuth);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [sendingResetCode, setSendingResetCode] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(0);

  // 处理 GitHub 登录失败回调的提示
  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "github") {
      toast.error("GitHub 登录失败，请稍后重试或使用账号登录");
    }
  }, [searchParams]);

  useEffect(() => {
    if (resetCountdown <= 0) return;
    const timer = window.setTimeout(() => setResetCountdown((v) => v - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resetCountdown]);

  function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function handleSendResetCode() {
    const email = resetEmail.trim();
    if (!isValidEmail(email)) {
      toast.error("请输入正确的邮箱地址");
      return;
    }

    try {
      setSendingResetCode(true);
      const res = await fetch("/api/auth/email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "reset_password" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "验证码发送失败");
        return;
      }
      toast.success(data.message || "如果邮箱存在，验证码将发送到该邮箱");
      setResetCountdown(60);
    } catch {
      toast.error("验证码发送失败，请稍后重试");
    } finally {
      setSendingResetCode(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    const email = resetEmail.trim();
    const code = resetCode.trim();

    if (!isValidEmail(email)) {
      toast.error("请输入正确的邮箱地址");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      toast.error("请输入 6 位邮箱验证码");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("新密码长度至少 6 位");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          emailCode: code,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "密码重置失败");
        return;
      }

      toast.success(data.message || "密码已重置，请使用新密码登录");
      setResetMode(false);
      setUsername(email);
      setPassword("");
      setResetCode("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      toast.error("请输入用户名和密码");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "登录失败");
        return;
      }

      setAuth(data.user, data.token);
      toast.success("登录成功");

      // 优先跳转到 redirect 参数指定的地址（用于 OAuth 授权流程）
      const redirect = searchParams.get("redirect");
      if (redirect && redirect.startsWith("/")) {
        router.push(redirect);
      } else if (data.user.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/");
      }
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
            <div className="text-5xl mb-3">{resetMode ? "🔑" : "🚪"}</div>
            <h1 className="text-2xl font-bold text-gray-900">
              {resetMode ? "找回密码" : "用户登录"}
            </h1>
            <p className="text-gray-500 text-[11px] sm:text-sm mt-1">
              {resetMode ? "通过邮箱验证码重置账号密码" : "登录后享受更多功能"}
            </p>
          </div>

          {/* 表单 */}
          {resetMode ? (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                  注册邮箱
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="请输入注册邮箱"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                  邮箱验证码
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6 位验证码"
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    onClick={handleSendResetCode}
                    disabled={sendingResetCode || resetCountdown > 0}
                    className="px-4 py-2.5 bg-blue-50 text-blue-600 text-[13px] sm:text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {sendingResetCode
                      ? "发送中..."
                      : resetCountdown > 0
                        ? `${resetCountdown}s`
                        : "获取验证码"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                  新密码
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 6 位"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                  确认新密码
                </label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "重置中..." : "重置密码"}
              </button>

              <button
                type="button"
                onClick={() => setResetMode(false)}
                className="w-full text-[11px] sm:text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                返回登录
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "登录中..." : "登 录"}
            </button>

            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setResetEmail(username.includes("@") ? username : "");
                  setResetMode(true);
                }}
                className="text-[13px] sm:text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                忘记密码？
              </button>
            </div>
          </form>
          )}

          {/* 分隔线 */}
          {!resetMode && <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="px-3 text-xs text-gray-400">或</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>}

          {/* GitHub 登录 */}
          {!resetMode && <a
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
            GitHub 登录
          </a>}

          {/* 注册链接 */}
          {!resetMode && <div className="mt-6 text-center text-[11px] sm:text-sm text-gray-500">
            没有账号？
            <Link
              href="/register"
              className="text-blue-600 hover:text-blue-700 font-medium ml-1"
            >
              立即注册
            </Link>
          </div>}

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

export default function LoginPage() {
  // useSearchParams 需要包裹在 Suspense 边界中，避免构建时报错
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
