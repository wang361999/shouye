"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

export default function SecuritySettingsPage() {
  const { token } = useAppStore();

  const [form, setForm] = useState({
    admin_path: "",
    login_fail_limit: "5",
    login_lock_minutes: "10",
    email_verify: false,
    captcha: false,
    smtp_host: "",
    smtp_port: "587",
    smtp_user: "",
    smtp_pass: "",
    smtp_from_name: "",
    smtp_secure: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailAddr, setTestEmailAddr] = useState("");
  const [githubForm, setGithubForm] = useState({
    github_client_id: "",
    github_client_secret: "",
    github_oauth_enabled: false,
  });
  const [githubSecretSet, setGithubSecretSet] = useState(false);
  const [savingGithub, setSavingGithub] = useState(false);

  // GitHub API Token（用于代码搜索和嵌入功能）
  const [githubApiToken, setGithubApiToken] = useState("");
  const [githubApiTokenSet, setGithubApiTokenSet] = useState(false);
  const [savingGithubToken, setSavingGithubToken] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setForm({
        admin_path: data.admin_path || "",
        login_fail_limit: data.login_fail_limit || "5",
        login_lock_minutes: data.login_lock_minutes || "10",
        email_verify: data.email_verify === "true",
        captcha: data.captcha === "true",
        smtp_host: data.smtp_host || "",
        smtp_port: data.smtp_port || "587",
        smtp_user: data.smtp_user || "",
        smtp_pass: data.smtp_pass || "",
        smtp_from_name: data.smtp_from_name || "",
        smtp_secure: data.smtp_secure === "true",
      });
      // 检查 GitHub API Token 是否已配置（不返回实际值，仅标记）
      setGithubApiTokenSet(!!data.github_token);
    } catch {
      toast.error("获取设置失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchSettings();
      fetchGithubConfig();
    }
  }, [token, fetchSettings]);

  const fetchGithubConfig = async () => {
    try {
      const res = await fetch("/api/admin/oauth-config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setGithubForm({
        github_client_id: data.github_client_id || "",
        github_client_secret: "",
        github_oauth_enabled: data.github_oauth_enabled || false,
      });
      setGithubSecretSet(data.github_client_secret_set || false);
    } catch {
      // 静默失败
    }
  };

  async function handleSaveGithub() {
    try {
      setSavingGithub(true);
      const body: Record<string, unknown> = {
        github_client_id: githubForm.github_client_id,
        github_oauth_enabled: githubForm.github_oauth_enabled,
      };
      // 仅在用户输入了新 secret 时才提交
      if (githubForm.github_client_secret) {
        body.github_client_secret = githubForm.github_client_secret;
      }
      const res = await fetch("/api/admin/oauth-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "保存失败");
        return;
      }
      toast.success("GitHub OAuth 配置已保存");
      setGithubForm((prev) => ({ ...prev, github_client_secret: "" }));
      setGithubSecretSet(true);
    } catch {
      toast.error("保存失败，请稍后重试");
    } finally {
      setSavingGithub(false);
    }
  }

  // 保存 GitHub API Token
  async function handleSaveGithubToken() {
    if (!githubApiToken.trim()) {
      toast.error("请输入 GitHub Token");
      return;
    }
    try {
      setSavingGithubToken(true);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          settings: {
            github_token: githubApiToken.trim(),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "保存失败");
        return;
      }
      toast.success("GitHub API Token 已保存");
      setGithubApiToken("");
      setGithubApiTokenSet(true);
    } catch {
      toast.error("保存失败，请稍后重试");
    } finally {
      setSavingGithubToken(false);
    }
  }

  // 删除 GitHub API Token
  async function handleDeleteGithubToken() {
    if (!confirm("确定要删除 GitHub API Token 吗？删除后代码搜索功能将不可用。")) {
      return;
    }
    try {
      setSavingGithubToken(true);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          settings: {
            github_token: "",
          },
        }),
      });
      if (!res.ok) {
        toast.error("删除失败");
        return;
      }
      toast.success("GitHub API Token 已删除");
      setGithubApiToken("");
      setGithubApiTokenSet(false);
    } catch {
      toast.error("删除失败，请稍后重试");
    } finally {
      setSavingGithubToken(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          settings: {
            ...form,
            email_verify: String(form.email_verify),
            captcha: String(form.captcha),
            smtp_secure: String(form.smtp_secure),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "保存失败");
        return;
      }
      toast.success("设置已保存");
    } catch {
      toast.error("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    if (!testEmailAddr.trim()) {
      toast.error("请输入测试邮箱地址");
      return;
    }
    if (!form.smtp_host || !form.smtp_user) {
      toast.error("请先填写并保存 SMTP 配置");
      return;
    }
    try {
      setTestingEmail(true);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          settings: {
            ...form,
            email_verify: String(form.email_verify),
            captcha: String(form.captcha),
            smtp_secure: String(form.smtp_secure),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "保存失败");
        return;
      }
      // 调用测试发送 API
      const testRes = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to: testEmailAddr.trim() }),
      });
      const testData = await testRes.json();
      if (testRes.ok) {
        toast.success("测试邮件已发送，请查收");
      } else {
        toast.error(testData.error || "测试邮件发送失败");
      }
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setTestingEmail(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout activeKey="settings-security">
        <div className="flex items-center justify-center py-20">
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeKey="settings-security">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">&#128272; 安全设置</h1>

        {/* ========== 安全防护设置 ========== */}
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-3">
            🛡️ 安全防护
          </h2>

          {/* 后台路径 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              后台路径
            </label>
            <input
              type="text"
              value={form.admin_path}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, admin_path: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="admin"
            />
            <p className="mt-1 text-xs text-amber-500">
              修改后需使用新路径访问后台，请牢记新路径
            </p>
          </div>

          {/* 登录失败限制 */}
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-500 mb-1.5">
                登录失败限制
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={form.login_fail_limit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      login_fail_limit: e.target.value,
                    }))
                  }
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-sm text-gray-500">次后锁定</span>
                <input
                  type="number"
                  min="1"
                  value={form.login_lock_minutes}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      login_lock_minutes: e.target.value,
                    }))
                  }
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-sm text-gray-500">分钟</span>
              </div>
            </div>
          </div>

          {/* 开启邮件验证 */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-0.5">
                开启邮件验证
              </label>
              <p className="text-xs text-gray-400">注册时需要验证邮箱</p>
            </div>
            <Switch
              checked={form.email_verify}
              onChange={(checked) =>
                setForm((prev) => ({ ...prev, email_verify: checked }))
              }
            />
          </div>

          {/* 开启验证码 */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-0.5">
                开启验证码
              </label>
              <p className="text-xs text-gray-400">登录时需要输入验证码</p>
            </div>
            <Switch
              checked={form.captcha}
              onChange={(checked) =>
                setForm((prev) => ({ ...prev, captcha: checked }))
              }
            />
          </div>

          {/* 操作日志 */}
          <div className="flex items-center justify-between py-2 border-t border-gray-100">
            <div>
              <span className="text-sm font-medium text-gray-700">
                操作日志
              </span>
              <p className="text-xs text-gray-400 mt-0.5">
                查看系统操作日志记录
              </p>
            </div>
            <Link
              href="/admin/users/logs"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              查看全部日志
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>

        {/* ========== 邮箱 SMTP 配置 ========== */}
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-base font-semibold text-gray-800">
              📧 邮箱服务配置 (SMTP)
            </h2>
            <span className="text-xs text-gray-400">
              用于邮件验证、通知等功能的邮件发送服务
            </span>
          </div>

          {/* SMTP 主机 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              SMTP 服务器地址
            </label>
            <input
              type="text"
              value={form.smtp_host}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, smtp_host: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例如: smtp.qq.com"
            />
            <p className="mt-1 text-xs text-gray-400">
              常见邮箱: smtp.qq.com | smtp.163.com | smtp.gmail.com | smtp.exmail.qq.com
            </p>
          </div>

          {/* SMTP 端口 + 加密方式 */}
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-500 mb-1.5">
                SMTP 端口
              </label>
              <input
                type="number"
                value={form.smtp_port}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, smtp_port: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="587"
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch
                checked={form.smtp_secure}
                onChange={(checked) =>
                  setForm((prev) => ({ ...prev, smtp_secure: checked }))
                }
              />
              <span className="text-sm text-gray-600">SSL/TLS 加密</span>
            </div>
          </div>

          {/* SMTP 用户名 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              SMTP 用户名（发件邮箱）
            </label>
            <input
              type="text"
              value={form.smtp_user}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, smtp_user: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例如: your_email@qq.com"
            />
          </div>

          {/* SMTP 密码/授权码 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              SMTP 密码 / 授权码
            </label>
            <input
              type="password"
              value={form.smtp_pass}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, smtp_pass: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="邮箱密码或SMTP授权码"
            />
            <p className="mt-1 text-xs text-amber-500">
              ⚠️ QQ邮箱、163邮箱等需要使用授权码，不是登录密码。请在对应邮箱设置中开启SMTP服务并获取授权码。
            </p>
          </div>

          {/* 发件人名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              发件人名称
            </label>
            <input
              type="text"
              value={form.smtp_from_name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, smtp_from_name: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例如: ET Studio"
            />
            <p className="mt-1 text-xs text-gray-400">
              收件人看到的发件人名称，留空则使用邮箱地址
            </p>
          </div>

          {/* 测试邮件发送 */}
          <div className="border-t border-gray-100 pt-4">
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              发送测试邮件
            </label>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={testEmailAddr}
                onChange={(e) => setTestEmailAddr(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="输入收件邮箱地址"
              />
              <button
                onClick={handleTestEmail}
                disabled={testingEmail || !form.smtp_host}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {testingEmail ? "发送中..." : "发送测试"}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              保存配置后可发送测试邮件验证配置是否正确
            </p>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>

        {/* ========== GitHub API Token 配置 ========== */}
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-base font-semibold text-gray-800">
              🐙 GitHub API Token
            </h2>
            <span className="text-xs text-gray-400">
              用于帖子中的 GitHub 代码搜索和嵌入功能
            </span>
          </div>

          {/* Token 状态 */}
          <div className={`rounded-lg p-4 ${githubApiTokenSet ? "bg-green-50" : "bg-amber-50"}`}>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${githubApiTokenSet ? "text-green-700" : "text-amber-700"}`}>
                {githubApiTokenSet ? "✓ Token 已配置" : "⚠️ Token 未配置"}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {githubApiTokenSet
                ? "GitHub 代码搜索功能可用，速率限制 5000 次/小时"
                : "未配置 Token 时代码搜索功能不可用（GitHub Code Search API 强制要求认证）"}
            </p>
          </div>

          {/* Token 输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              GitHub Personal Access Token
            </label>
            <input
              type="password"
              value={githubApiToken}
              onChange={(e) => setGithubApiToken(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              placeholder={githubApiTokenSet ? "已配置，如需更换请输入新 Token" : "ghp_xxxxxxxxxxxx"}
            />
          </div>

          {/* 配置指引 */}
          <div className="bg-blue-50 rounded-lg p-4 space-y-2">
            <p className="text-xs font-medium text-blue-700">📋 获取 Token 步骤：</p>
            <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
              <li>前往 GitHub → Settings → Developer settings → Personal access tokens</li>
              <li>选择 Tokens (classic) → Generate new token (classic)</li>
              <li>只需勾选 public_repo（只读公开仓库权限）即可</li>
              <li>复制生成的 Token 粘贴到上方输入框，点击保存</li>
            </ol>
            <p className="text-xs text-blue-500 mt-2">
              💡 Token 保存在数据库中，仅用于服务端调用 GitHub API，不会暴露给前端
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
            <button
              onClick={handleSaveGithubToken}
              disabled={savingGithubToken || !githubApiToken.trim()}
              className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingGithubToken ? "保存中..." : "保存 Token"}
            </button>
            {githubApiTokenSet && (
              <button
                onClick={handleDeleteGithubToken}
                disabled={savingGithubToken}
                className="px-4 py-2.5 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                删除 Token
              </button>
            )}
          </div>
        </div>

        {/* ========== GitHub OAuth 配置 ========== */}
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-base font-semibold text-gray-800">
              🔗 第三方登录配置 (GitHub OAuth)
            </h2>
            <span className="text-xs text-gray-400">
              配置后用户可通过 GitHub 账号登录
            </span>
          </div>

          {/* 启用开关 */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-0.5">
                启用 GitHub 登录
              </label>
              <p className="text-xs text-gray-400">开启后登录/注册页显示 GitHub 按钮</p>
            </div>
            <Switch
              checked={githubForm.github_oauth_enabled}
              onChange={(checked) =>
                setGithubForm((prev) => ({ ...prev, github_oauth_enabled: checked }))
              }
            />
          </div>

          {/* Client ID */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              GitHub Client ID
            </label>
            <input
              type="text"
              value={githubForm.github_client_id}
              onChange={(e) =>
                setGithubForm((prev) => ({ ...prev, github_client_id: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="GitHub OAuth App 的 Client ID"
            />
          </div>

          {/* Client Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">
              GitHub Client Secret
            </label>
            <input
              type="password"
              value={githubForm.github_client_secret}
              onChange={(e) =>
                setGithubForm((prev) => ({ ...prev, github_client_secret: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={githubSecretSet ? "已设置，如需修改请输入新值" : "请输入 Client Secret"}
            />
            {githubSecretSet && (
              <p className="mt-1 text-xs text-green-500">
                ✓ Secret 已配置，留空则不修改
              </p>
            )}
          </div>

          {/* 配置指引 */}
          <div className="bg-blue-50 rounded-lg p-4 space-y-2">
            <p className="text-xs font-medium text-blue-700">📋 配置步骤：</p>
            <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
              <li>前往 GitHub → Settings → Developer settings → OAuth Apps → New OAuth App</li>
              <li>Homepage URL 填写站点地址（如 https://your-domain.com）</li>
              <li>Authorization callback URL 填写：https://your-domain.com/api/auth/github/callback</li>
              <li>创建后复制 Client ID 和 Client Secret 填入上方</li>
            </ol>
          </div>

          {/* GitHub OAuth 保存按钮 */}
          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button
              onClick={handleSaveGithub}
              disabled={savingGithub}
              className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingGithub ? "保存中..." : "保存 GitHub 配置"}
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

// ============ Switch 开关组件 ============
function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? "bg-blue-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
