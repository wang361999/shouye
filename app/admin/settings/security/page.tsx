"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import toast from "react-hot-toast";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  FormField,
  Switch,
  ConfirmDialog,
  Spinner,
  Icons,
} from "@/components/admin/ui";

export default function SecuritySettingsPage() {
  const { token } = useAppStore();

  const [form, setForm] = useState({
    admin_path: "",
    login_fail_limit: "5",
    login_lock_minutes: "10",
    email_verify: false,
    captcha: false,
    resend_api_key: "",
    resend_from_email: "",
    ai_agent_daily_limit: "10",
    ai_agent_inactive_days: "7",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailAddr, setTestEmailAddr] = useState("");
  const [emailRuntime, setEmailRuntime] = useState({
    resend_configured: false,
    resend_from_email: "",
    active_email_provider: "none",
  });
  // AI Agent 清理
  const [cleanupPreview, setCleanupPreview] = useState<any>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [githubForm, setGithubForm] = useState({
    github_client_id: "",
    github_client_secret: "",
    github_oauth_enabled: false,
  });
  const [githubSecretSet, setGithubSecretSet] = useState(false);
  const [savingGithub, setSavingGithub] = useState(false);

  // GitHub API Token（用于代码搜索、嵌入功能和 AI 自动迭代 Issue 队列）
  const [githubApiToken, setGithubApiToken] = useState("");
  const [githubApiTokenSet, setGithubApiTokenSet] = useState(false);
  const [savingGithubToken, setSavingGithubToken] = useState(false);

  // ConfirmDialog 状态
  const [confirmDeleteToken, setConfirmDeleteToken] = useState(false);
  const [confirmCleanup, setConfirmCleanup] = useState(false);

  const [activeSection, setActiveSection] = useState("security");

  const SECTIONS = [
    { id: "security", label: "安全防护", icon: "🔒" },
    { id: "email", label: "邮箱配置", icon: "📧" },
    { id: "ai-agent", label: "AI Agent", icon: "🤖" },
    { id: "github-token", label: "GitHub Token", icon: "🔑" },
    { id: "github-oauth", label: "GitHub OAuth", icon: "🐙" },
  ];

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminFetch("/api/admin/settings");
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setForm({
        admin_path: data.admin_path || "",
        login_fail_limit: data.login_fail_limit || "5",
        login_lock_minutes: data.login_lock_minutes || "10",
        email_verify: data.email_verify === "true",
        captcha: data.captcha === "true",
        resend_api_key: data.resend_api_key || "",
        resend_from_email: data.resend_from_email || "",
        ai_agent_daily_limit: data.ai_agent_daily_limit || "10",
        ai_agent_inactive_days: data.ai_agent_inactive_days || "7",
      });
      setEmailRuntime({
        resend_configured: data.resend_configured === "true",
        resend_from_email: data.resend_from_email || "",
        active_email_provider: data.active_email_provider || "none",
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

  useEffect(() => {
    const handleScroll = () => {
      const offsets = SECTIONS.map((s) => {
        const el = document.getElementById(s.id);
        return { id: s.id, top: el ? el.getBoundingClientRect().top : Infinity };
      });
      const current = offsets.reduce((closest, curr) =>
        curr.top < 120 && curr.top > closest.top ? curr : closest
      , { id: "security", top: -Infinity });
      if (current.top > -Infinity) setActiveSection(current.id);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const fetchGithubConfig = async () => {
    try {
      const res = await adminFetch("/api/admin/oauth-config");
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
      const res = await adminFetch("/api/admin/oauth-config", {
        method: "POST",
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
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
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

  // 删除 GitHub API Token（通过 ConfirmDialog 确认）
  function requestDeleteGithubToken() {
    setConfirmDeleteToken(true);
  }

  async function confirmDeleteGithubToken() {
    setConfirmDeleteToken(false);
    try {
      setSavingGithubToken(true);
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
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

  // 预览不活跃 AI Agent
  async function handlePreviewCleanup() {
    try {
      setCleanupLoading(true);
      setCleanupPreview(null);
      const res = await adminFetch("/api/admin/ai-agent/cleanup");
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "获取预览失败");
        return;
      }
      const data = await res.json();
      setCleanupPreview(data);
    } catch {
      toast.error("获取预览失败，请稍后重试");
    } finally {
      setCleanupLoading(false);
    }
  }

  // 执行清理（通过 ConfirmDialog 确认）
  function requestExecuteCleanup() {
    if (!cleanupPreview || cleanupPreview.inactive_count === 0) {
      toast.error("没有需要清理的 AI Agent");
      return;
    }
    setConfirmCleanup(true);
  }

  async function confirmExecuteCleanup() {
    setConfirmCleanup(false);
    try {
      setCleanupRunning(true);
      const res = await adminFetch("/api/admin/ai-agent/cleanup", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "清理失败");
        return;
      }
      const data = await res.json();
      toast.success(data.message || `已清理 ${data.deleted_count} 个 AI Agent`);
      // 刷新预览
      setCleanupPreview(null);
      await handlePreviewCleanup();
    } catch {
      toast.error("清理失败，请稍后重试");
    } finally {
      setCleanupRunning(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({
          settings: {
            ...form,
            email_verify: String(form.email_verify),
            captcha: String(form.captcha),
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
    if (!emailRuntime.resend_configured && !form.resend_api_key) {
      toast.error("请先填写并保存 Resend 配置");
      return;
    }
    try {
      setTestingEmail(true);
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({
          settings: {
            ...form,
            email_verify: String(form.email_verify),
            captcha: String(form.captcha),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "保存失败");
        return;
      }
      // 调用测试发送 API
      const testRes = await adminFetch("/api/admin/test-email", {
        method: "POST",
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
          <Spinner className="w-8 h-8" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeKey="settings-security">
      <div className="space-y-6">
        <PageHeader title="安全设置" actions={
          <Icons.Lock className="w-6 h-6 text-gray-400" />
        } />

        {/* Tab 栏 */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 overflow-x-auto sticky top-0 z-10">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => {
                setActiveSection(section.id);
                document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeSection === section.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {section.icon} {section.label}
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <div className="space-y-6">
        {/* ========== 安全防护设置 ========== */}
        <div id="security" className="scroll-mt-20">
        <Card>
          <CardHeader title="安全防护" subtitle="后台路径、登录限制与验证策略" />
          <CardBody className="space-y-6">
            {/* 后台路径 */}
            <FormField label="后台路径" hint="修改后需使用新路径访问后台，请牢记新路径">
              <Input
                type="text"
                value={form.admin_path}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, admin_path: e.target.value }))
                }
                placeholder="admin"
              />
            </FormField>

            {/* 登录失败限制 */}
            <FormField label="登录失败限制">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={form.login_fail_limit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      login_fail_limit: e.target.value,
                    }))
                  }
                  className="w-24"
                />
                <span className="text-sm text-gray-500">次后锁定</span>
                <Input
                  type="number"
                  min="1"
                  value={form.login_lock_minutes}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      login_lock_minutes: e.target.value,
                    }))
                  }
                  className="w-24"
                />
                <span className="text-sm text-gray-500">分钟</span>
              </div>
            </FormField>

            {/* 开启邮件验证 */}
            <div className="flex items-center justify-between">
              <div>
                <label className="admin-label">开启邮件验证</label>
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
                <label className="admin-label">开启验证码</label>
                <p className="text-xs text-gray-400">登录时需要输入验证码</p>
              </div>
              <Switch
                checked={form.captcha}
                onChange={(checked) =>
                  setForm((prev) => ({ ...prev, captcha: checked }))
                }
              />
            </div>

          </CardBody>
        </Card>
        </div>

        {/* ========== 邮箱服务配置 ========== */}
        <div id="email" className="scroll-mt-20">
        <Card>
          <CardHeader
            title="邮箱服务配置"
            subtitle="用于注册邮箱验证、通知等功能的邮件发送服务"
          />
          <CardBody className="space-y-6">
            <div className={`rounded-lg border p-4 ${
              emailRuntime.resend_configured
                ? "border-green-200 bg-green-50"
                : "border-amber-200 bg-amber-50"
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-sm font-medium ${
                    emailRuntime.resend_configured ? "text-green-800" : "text-amber-800"
                  }`}>
                    当前实际使用：{emailRuntime.resend_configured ? "Resend API" : "未配置"}
                  </p>
                  <p className={`mt-1 text-xs ${
                    emailRuntime.resend_configured ? "text-green-700" : "text-amber-700"
                  }`}>
                    {emailRuntime.resend_configured
                      ? `发件邮箱：${emailRuntime.resend_from_email || "已通过配置"}。邮件发送统一使用 Resend。`
                      : "当前没有检测到 Resend 配置，请填写 Resend API Key 和发件邮箱。"}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  emailRuntime.resend_configured
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {emailRuntime.resend_configured ? "已生效" : "需配置"}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-800">Resend 配置（保存到数据库）</p>
              <p className="mt-1 text-xs text-blue-700">
                这里保存后会写入数据库，后续换 Vercel 账号时只要继续连接同一个数据库，邮件配置就会自动生效。
              </p>
            </div>

            <FormField
              label="Resend API Key"
              hint="保存到数据库，优先级高于 Vercel 环境变量。通常以 re_ 开头。"
            >
              <Input
                type="password"
                value={form.resend_api_key}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, resend_api_key: e.target.value }))
                }
                placeholder="re_xxxxxxxxxxxxxxxxx"
              />
            </FormField>

            <FormField
              label="Resend 发件邮箱"
              hint="必须使用 Resend 已验证域名下的邮箱，例如 noreply@gitd.cn"
            >
              <Input
                type="email"
                value={form.resend_from_email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, resend_from_email: e.target.value }))
                }
                placeholder="noreply@gitd.cn"
              />
            </FormField>

            {/* 测试邮件发送 */}
            <div className="border-t border-gray-100 pt-4">
              <FormField
                label="发送测试邮件"
                hint="当前会使用 Resend API 发送测试邮件"
              >
                <div className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={testEmailAddr}
                    onChange={(e) => setTestEmailAddr(e.target.value)}
                    placeholder="输入收件邮箱地址"
                  />
                  <Button
                    variant="primary"
                    onClick={handleTestEmail}
                    loading={testingEmail}
                    disabled={!emailRuntime.resend_configured && !form.resend_api_key}
                  >
                    {testingEmail ? "发送中..." : "发送测试"}
                  </Button>
                </div>
              </FormField>
            </div>
          </CardBody>
        </Card>
        </div>

        {/* ========== AI Agent 清理 ========== */}
        <div id="ai-agent" className="scroll-mt-20">
        <Card>
          <CardHeader
            title="AI Agent 管理"
            subtitle="控制外部 AI Agent 注册上限与不活跃账号清理"
          />
          <CardBody className="space-y-6">
            {/* AI Agent 每日注册上限 */}
            <FormField label="AI Agent 每日注册上限" hint="控制外部 AI Agent 每天可通过 API 注册的账号数量（0 = 关闭注册，范围 0-1000）">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="1000"
                  value={form.ai_agent_daily_limit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      ai_agent_daily_limit: e.target.value,
                    }))
                  }
                  className="w-24"
                />
                <span className="text-sm text-gray-500">个 / 天</span>
              </div>
            </FormField>

            {/* AI Agent 不活跃清理天数 */}
            <FormField label="AI Agent 不活跃清理天数" hint="超过此天数未发帖、未评论的 AI Agent 将被自动清理（0 = 关闭自动清理，范围 0-365）">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="365"
                  value={form.ai_agent_inactive_days}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      ai_agent_inactive_days: e.target.value,
                    }))
                  }
                  className="w-24"
                />
                <span className="text-sm text-gray-500">天</span>
              </div>
            </FormField>

            {/* AI Agent 手动清理 */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="admin-label">手动清理不活跃 AI Agent</label>
                  <p className="text-xs text-gray-400 mt-0.5">
                    扫描并删除从未发帖、评论且超过设定天数未活跃的 AI Agent 账号
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={handlePreviewCleanup}
                  loading={cleanupLoading}
                >
                  {cleanupLoading ? "扫描中..." : "扫描不活跃账号"}
                </Button>
              </div>

              {/* 清理预览结果 */}
              {cleanupPreview && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                  {!cleanupPreview.enabled ? (
                    <p className="text-sm text-amber-600">
                      {cleanupPreview.message || "自动清理已关闭"}
                    </p>
                  ) : (
                    <>
                      {/* 统计摘要 */}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-600">
                          AI Agent 总数：<span className="font-semibold text-gray-900">{cleanupPreview.total_ai_agents}</span>
                        </span>
                        <span className="text-green-600">
                          活跃：<span className="font-semibold">{cleanupPreview.active_ai_agents}</span>
                        </span>
                        <span className="text-red-600">
                          不活跃：<span className="font-semibold">{cleanupPreview.inactive_count}</span>
                        </span>
                        <span className="text-gray-400">（阈值：{cleanupPreview.inactive_days} 天）</span>
                      </div>

                      {/* 不活跃列表 */}
                      {cleanupPreview.inactive_count > 0 && (
                        <>
                          <div className="border-t border-gray-200 pt-2">
                            <p className="text-xs font-medium text-gray-500 mb-1">不活跃 AI Agent 列表：</p>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                              {cleanupPreview.inactive_agents.map((agent: any) => (
                                <div key={agent.id} className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1.5 border border-gray-100">
                                  <span className="font-mono text-gray-700">{agent.username}</span>
                                  <span className="text-gray-400">|</span>
                                  <span className="text-gray-500">
                                    注册：{new Date(agent.createdAt).toLocaleDateString('zh-CN')}
                                  </span>
                                  <span className="text-gray-400">|</span>
                                  <span className="text-gray-500">
                                    最后活跃：{agent.lastActiveAt ? new Date(agent.lastActiveAt).toLocaleDateString('zh-CN') : '从未'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              variant="danger"
                              onClick={requestExecuteCleanup}
                              loading={cleanupRunning}
                            >
                              {cleanupRunning ? "清理中..." : `删除 ${cleanupPreview.inactive_count} 个不活跃账号`}
                            </Button>
                          </div>
                        </>
                      )}

                      {cleanupPreview.inactive_count === 0 && (
                        <p className="text-sm text-green-600">没有需要清理的不活跃 AI Agent</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </CardBody>
        </Card>
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving}>
            {saving ? "保存中..." : "保存设置"}
          </Button>
        </div>

        {/* ========== GitHub API Token 配置 ========== */}
        <div id="github-token" className="scroll-mt-20">
        <Card>
          <CardHeader
            title="GitHub API Token"
            subtitle="用于代码搜索、GitHub 嵌入和 AI 自动迭代 Issue 队列"
          />
          <CardBody className="space-y-6">
            {/* Token 状态 */}
            <div className={`rounded-lg p-4 ${githubApiTokenSet ? "bg-green-50" : "bg-amber-50"}`}>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${githubApiTokenSet ? "text-green-700" : "text-amber-700"}`}>
                  {githubApiTokenSet ? "✓ Token 已配置" : "⚠️ Token 未配置"}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {githubApiTokenSet
                  ? "GitHub 代码搜索和 AI 自动迭代 Issue 队列可用"
                  : "未配置 Token 时只能写入后台日志，无法创建 GitHub Issue 触发免费 AI 执行器"}
              </p>
            </div>

            {/* Token 输入 */}
            <FormField label="GitHub Personal Access Token">
              <Input
                type="password"
                value={githubApiToken}
                onChange={(e) => setGithubApiToken(e.target.value)}
                className="font-mono"
                placeholder={githubApiTokenSet ? "已配置，如需更换请输入新 Token" : "ghp_xxxxxxxxxxxx"}
              />
            </FormField>

            {/* 配置指引 */}
            <div className="bg-blue-50 rounded-lg p-4 space-y-2">
              <p className="text-xs font-medium text-blue-700">📋 获取 Token 步骤：</p>
              <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
                <li>前往 GitHub → Settings → Developer settings → Personal access tokens</li>
                <li>推荐选择 Fine-grained tokens → Generate new token</li>
                <li>Repository access 选择当前仓库 wang361999/shouye</li>
                <li>权限建议：Contents 只读、Issues 读写、Metadata 只读</li>
                <li>复制生成的 Token 粘贴到上方输入框，点击保存</li>
              </ol>
              <p className="text-xs text-blue-500 mt-2">
                💡 Token 保存在数据库中，仅用于服务端调用 GitHub API。已经在聊天、日志或截图中暴露过的 Token 必须先吊销，不要继续使用
              </p>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
              <Button
                onClick={handleSaveGithubToken}
                loading={savingGithubToken}
                disabled={!githubApiToken.trim()}
              >
                {savingGithubToken ? "保存中..." : "保存 Token"}
              </Button>
              {githubApiTokenSet && (
                <Button
                  variant="danger"
                  onClick={requestDeleteGithubToken}
                  disabled={savingGithubToken}
                >
                  删除 Token
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
        </div>

        {/* ========== GitHub OAuth 配置 ========== */}
        <div id="github-oauth" className="scroll-mt-20">
        <Card>
          <CardHeader
            title="第三方登录配置 (GitHub OAuth)"
            subtitle="配置后用户可通过 GitHub 账号登录"
          />
          <CardBody className="space-y-6">
            {/* 启用开关 */}
            <div className="flex items-center justify-between">
              <div>
                <label className="admin-label">启用 GitHub 登录</label>
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
            <FormField label="GitHub Client ID">
              <Input
                type="text"
                value={githubForm.github_client_id}
                onChange={(e) =>
                  setGithubForm((prev) => ({ ...prev, github_client_id: e.target.value }))
                }
                placeholder="GitHub OAuth App 的 Client ID"
              />
            </FormField>

            {/* Client Secret */}
            <FormField
              label="GitHub Client Secret"
              hint={githubSecretSet ? "✓ Secret 已配置，留空则不修改" : undefined}
            >
              <Input
                type="password"
                value={githubForm.github_client_secret}
                onChange={(e) =>
                  setGithubForm((prev) => ({ ...prev, github_client_secret: e.target.value }))
                }
                placeholder={githubSecretSet ? "已设置，如需修改请输入新值" : "请输入 Client Secret"}
              />
            </FormField>

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
              <Button onClick={handleSaveGithub} loading={savingGithub}>
                {savingGithub ? "保存中..." : "保存 GitHub 配置"}
              </Button>
            </div>
          </CardBody>
        </Card>
        </div>
        </div>
      </div>

      {/* ============ ConfirmDialog: 删除 GitHub Token ============ */}
      <ConfirmDialog
        open={confirmDeleteToken}
        title="删除 GitHub API Token"
        message="确定要删除 GitHub API Token 吗？删除后代码搜索功能将不可用。"
        confirmText="删除"
        danger
        onConfirm={confirmDeleteGithubToken}
        onCancel={() => setConfirmDeleteToken(false)}
      />

      {/* ============ ConfirmDialog: 清理不活跃 AI Agent ============ */}
      <ConfirmDialog
        open={confirmCleanup}
        title="清理不活跃 AI Agent"
        message={
          cleanupPreview
            ? `确定要删除 ${cleanupPreview.inactive_count} 个不活跃 AI Agent 吗？此操作不可撤销。`
            : "确定要清理不活跃 AI Agent 吗？此操作不可撤销。"
        }
        confirmText="删除"
        danger
        onConfirm={confirmExecuteCleanup}
        onCancel={() => setConfirmCleanup(false)}
      />
    </AdminLayout>
  );
}
