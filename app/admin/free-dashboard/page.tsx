"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";

interface FreeDashboardData {
  health: {
    score: number;
    level: "good" | "warning" | "danger";
    summary: string;
  };
  deploy: {
    state: "success" | "pending" | "failure" | "unknown";
    shortSha: string;
    message: string;
    targetUrl: string;
    updatedAt: string | null;
  };
  business: {
    toolCount: number;
    activeToolCount: number;
    userCount: number;
    postCount: number;
    todayPostCount: number;
    weekPostCount: number;
  };
  freeQuota: {
    monthStart: string;
    monthEnd: string;
    maxPercent: number;
    quotas: Array<{
      key: string;
      label: string;
      used: number;
      total: number;
      unit: string;
      percent: number;
      level: "good" | "warning" | "danger";
    }>;
  };
  tasks: Array<{
    title: string;
    count: number;
    href: string;
    level: "good" | "warning" | "danger";
    desc: string;
  }>;
  suggestions: string[];
  hotTools: Array<{
    id: string;
    name: string;
    icon: string | null;
    clickCount: number;
    category: string | null;
  }>;
  recentLogs: Array<{
    id: string;
    username: string | null;
    action: string;
    detail: string | null;
    createdAt: string;
  }>;
  codeIterations: Array<{
    sha: string;
    shortSha: string;
    title: string;
    detail: string;
    url: string;
    committedAt: string | null;
  }>;
  visibleChanges: {
    summary: string;
    details: string[];
    files: Array<{
      path: string;
      route: string;
      status: string;
      additions: number;
      deletions: number;
    }>;
    sha: string;
    committedAt: string | null;
  };
  autoIteration: {
    enabled: boolean;
    requireApproval: boolean;
    safeMode: boolean;
    lastRequest: string;
    lastDeployApproval: string;
    manualDeployConfigured: boolean;
    aiExecutorConfigured: boolean;
    githubIssueConfigured: boolean;
    requestQueueConfigured: boolean;
    executorMode: string;
    executorName: string;
  };
  freeStack: Array<{
    name: string;
    value: string;
    status: string;
  }>;
}

const levelStyle = {
  good: {
    text: "正常",
    card: "border-green-200 bg-green-50 text-green-700",
    dot: "bg-green-500",
    bar: "bg-green-500",
  },
  warning: {
    text: "注意",
    card: "border-orange-200 bg-orange-50 text-orange-700",
    dot: "bg-orange-500",
    bar: "bg-orange-500",
  },
  danger: {
    text: "危险",
    card: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
    bar: "bg-red-500",
  },
};

const deployText = {
  success: "部署成功",
  pending: "部署中",
  failure: "部署失败",
  unknown: "未知",
};

function readAutoIterationLog(value: string) {
  if (!value) return null;
  try {
    return JSON.parse(value) as {
      requirement?: string;
      createdAt?: string;
      status?: string;
      issueUrl?: string;
      queueMode?: string;
      executorConfigured?: boolean;
      executorStatus?: number | null;
      guardrails?: string[];
    };
  } catch {
    return null;
  }
}

export default function FreeDashboardPage() {
  const { token } = useAppStore();
  const [data, setData] = useState<FreeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [iterationRequirement, setIterationRequirement] = useState("");
  const [schedule, setSchedule] = useState({
    patrolEnabled: true,
    patrolHour: 10,
    posterEnabled: true,
    posterHour1: 9,
    posterHour2: 15,
    seoEnabled: true,
    seoHour: 14,
    creatorEnabled: true,
    creatorHour: 16,
    replyEnabled: true,
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{
    message: string;
    results: Array<{ workflow: string; name: string; status: string; message?: string }>;
    successCount: number;
    failedCount: number;
  } | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/schedule", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSchedule(await res.json());
      }
    } catch {}
  }, [token]);

  const fetchData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setLoadError("未读取到管理员登录状态，请重新登录后台。");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/free-dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData(await res.json());
      } else {
        const result = await res.json().catch(() => null);
        setLoadError(result?.error || `看板接口返回 ${res.status}`);
      }
    } catch {
      setLoadError("看板接口请求失败，请稍后刷新或检查部署日志。");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    fetchSchedule();
  }, [fetchData, fetchSchedule]);

  useEffect(() => {
    const timer = setInterval(fetchData, 60_000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const runAutoIterationAction = async (
    action: "update_config" | "trigger_inspection" | "approve_deploy",
    payload: Record<string, unknown> = {},
  ) => {
    if (!token || !data) return;
    setActionLoading(action);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/auto-iteration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await res.json();
      if (!res.ok) {
        setActionMessage(result.error || "操作失败，请稍后重试");
        return;
      }
      setActionMessage(result.message || "操作成功");
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const lastAutoRequest = readAutoIterationLog(data?.autoIteration.lastRequest || "");

  return (
    <AdminLayout activeKey="free-dashboard">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">免费运营看板</h1>
            <p className="mt-1 text-sm text-gray-500">
              用最直白的方式看懂：网站是否正常、免费额度够不够、接下来该处理什么。
            </p>
          </div>
          <button
            onClick={fetchData}
            className="w-fit px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            刷新看板
          </button>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : data ? (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className={`rounded-2xl border p-5 ${levelStyle[data.health.level].card}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium opacity-80">网站健康分</p>
                    <p className="mt-2 text-4xl font-bold">{data.health.score}</p>
                  </div>
                  <span className="text-4xl">🛡️</span>
                </div>
                <p className="mt-3 text-sm">{data.health.summary}</p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">部署状态</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">
                      {deployText[data.deploy.state]}
                    </p>
                  </div>
                  <span className={`w-3 h-3 rounded-full ${
                    data.deploy.state === "success"
                      ? "bg-green-500"
                      : data.deploy.state === "pending"
                        ? "bg-orange-500 animate-pulse"
                        : data.deploy.state === "failure"
                          ? "bg-red-500"
                          : "bg-gray-400"
                  }`} />
                </div>
                <p className="mt-3 text-sm text-gray-500">{data.deploy.message}</p>
                <div className="mt-3 flex items-center gap-3 text-xs">
                  {data.deploy.shortSha && (
                    <span className="px-2 py-1 rounded bg-gray-100 text-gray-600">
                      {data.deploy.shortSha}
                    </span>
                  )}
                  {data.deploy.targetUrl && (
                    <a
                      href={data.deploy.targetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      查看详情
                    </a>
                  )}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <Metric label="工具总数" value={data.business.toolCount} sub={`在线 ${data.business.activeToolCount}`} />
              <Metric label="用户数" value={data.business.userCount} sub="注册用户" />
              <Metric label="帖子数" value={data.business.postCount} sub={`今日 ${data.business.todayPostCount}`} />
              <Metric label="本周发帖" value={data.business.weekPostCount} sub="近 7 天" />
              <Metric label="免费额度" value={`${data.freeQuota.maxPercent.toFixed(1)}%`} sub="最高使用项" />
              <Metric label="自动刷新" value="60s" sub="后台看板" />
            </section>

            <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-indigo-950">AI 自动迭代实验</h2>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      data.autoIteration.enabled
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {data.autoIteration.enabled ? "已开启" : "未开启"}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-indigo-700">
                      {data.autoIteration.requireApproval ? "上线前需要确认" : "允许自动上线"}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-indigo-700">
                      {data.autoIteration.safeMode ? "安全模式" : "扩展模式"}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      data.autoIteration.requestQueueConfigured
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      已接入：{data.autoIteration.executorName}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-indigo-800">
                    后台现在会把迭代请求放进执行队列。当前模式是“{data.autoIteration.executorName}”；配置 GitHub Token 后可进入免费 AI 执行器，配置外部 AI Webhook 时则优先使用你自己的执行器。
                  </p>
                  {!data.autoIteration.aiExecutorConfigured && !data.autoIteration.githubIssueConfigured && (
                    <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
                      已接入站内日志队列，但还没接入 GitHub 免费 AI 执行器。前往“安全设置 → GitHub API Token”保存 Token 后，后台请求会进入 GitHub Issue 并触发自动 PR 流程。
                    </div>
                  )}
                  {!data.autoIteration.aiExecutorConfigured && data.autoIteration.githubIssueConfigured && (
                    <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                      已接入 GitHub 免费 AI 执行器。后台提交请求后，会创建 Issue，并由 GitHub Actions 尝试生成代码 PR。
                    </div>
                  )}
                  {lastAutoRequest ? (
                    <div className="mt-3 rounded-xl border border-indigo-100 bg-white/70 p-3 text-sm text-indigo-900">
                      <p className="font-medium">最近迭代请求：{lastAutoRequest.requirement || "未填写需求"}</p>
                      <p className="mt-1 text-xs text-indigo-600">
                        {lastAutoRequest.createdAt
                          ? new Date(lastAutoRequest.createdAt).toLocaleString()
                          : "暂无时间"}
                        {" · "}
                        {lastAutoRequest.status === "sent_to_ai_executor"
                          ? "已发送给 AI 执行器"
                          : lastAutoRequest.status === "executor_failed"
                            ? "AI 执行器调用失败"
                            : lastAutoRequest.status === "queued_to_github_issue"
                              ? "已进入 GitHub Issue 迭代队列"
                              : "已进入站内日志迭代队列"}
                      </p>
                      {lastAutoRequest.issueUrl && (
                        <a
                          href={lastAutoRequest.issueUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex text-xs text-blue-600 hover:underline"
                        >
                          查看 GitHub Issue
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-indigo-600">还没有迭代请求记录。</p>
                  )}
                  {actionMessage && (
                    <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm text-indigo-800">
                      {actionMessage}
                    </p>
                  )}
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-56">
                  <button
                    onClick={() =>
                      runAutoIterationAction("update_config", {
                        enabled: !data.autoIteration.enabled,
                        requireApproval: true,
                        safeMode: true,
                      })
                    }
                    disabled={Boolean(actionLoading)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {actionLoading === "update_config"
                      ? "保存中..."
                      : data.autoIteration.enabled
                        ? "关闭实验开关"
                        : "开启实验开关"}
                  </button>
                  <textarea
                    value={iterationRequirement}
                    onChange={(e) => setIterationRequirement(e.target.value)}
                    placeholder="输入你的迭代需求，比如：后台订单列表增加按用户名搜索功能"
                    rows={3}
                    className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    onClick={() => {
                      const requirement = iterationRequirement.trim();
                      if (!requirement) {
                        setActionMessage("请先输入迭代需求");
                        return;
                      }
                      runAutoIterationAction("trigger_inspection", { requirement });
                      setIterationRequirement("");
                    }}
                    disabled={Boolean(actionLoading) || !data.autoIteration.enabled}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100 disabled:opacity-60"
                  >
                    {actionLoading === "trigger_inspection" ? "提交中..." : "提交迭代请求"}
                  </button>
                  <p className="text-xs text-indigo-700">
                    {data.autoIteration.githubIssueConfigured
                      ? "已配置 GitHub Token，提交后会自动创建 Issue → AI 生成代码 → lint/build 验证 → 自动合并上线。"
                      : "未配置 GitHub Token，只能写入后台日志；可到安全设置里填写。"}
                  </p>
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                    <p className="font-medium">全自动闭环已开启</p>
                    <p className="mt-1">提交需求 → AI 写代码 → 自动验证 → 自动合并 → Vercel 自动部署</p>
                    <p className="mt-1">另外每天 10:00 自动巡检，发现部署失败会自动创建修复 Issue。</p>
                  </div>
                  <button
                    onClick={() => runAutoIterationAction("approve_deploy")}
                    disabled={Boolean(actionLoading)}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {actionLoading === "approve_deploy" ? "确认中..." : "我确认，可以上线"}
                  </button>
                  <p className="text-xs text-indigo-700">
                    {data.autoIteration.manualDeployConfigured
                      ? "已配置 Vercel Deploy Hook，确认后会尝试触发部署。"
                      : "未配置 Deploy Hook，确认会先写入日志。"}
                  </p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-5 gap-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 xl:col-span-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-emerald-950">这次 AI 改了什么</h2>
                    <p className="mt-1 text-sm text-emerald-700">
                      {data.visibleChanges.committedAt
                        ? `最近一次迭代：${new Date(data.visibleChanges.committedAt).toLocaleString()}`
                        : '暂无迭代记录'}
                    </p>
                  </div>
                  {data.visibleChanges.sha && (
                    <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-mono text-emerald-700">
                      {data.visibleChanges.sha}
                    </span>
                  )}
                </div>

                {/* AI 摘要 */}
                <div className="mt-4 rounded-xl border border-emerald-100 bg-white/80 p-4">
                  <p className="text-sm font-semibold text-gray-900">
                    {data.visibleChanges.summary || '暂无摘要'}
                  </p>
                  {data.visibleChanges.details.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {data.visibleChanges.details.map((d, i) => (
                        <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* 改动文件列表 */}
                {data.visibleChanges.files.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-emerald-700">改动文件（{data.visibleChanges.files.length} 个）</p>
                    {data.visibleChanges.files.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-emerald-50 bg-white/60 px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                            file.status === 'added' ? 'bg-green-100 text-green-700'
                            : file.status === 'modified' ? 'bg-blue-100 text-blue-700'
                            : file.status === 'removed' ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                          }`}>
                            {file.status === 'added' ? '新增' : file.status === 'modified' ? '修改' : file.status === 'removed' ? '删除' : file.status}
                          </span>
                          <span className="truncate text-xs text-gray-700">{file.path}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-xs">
                          <span className="text-green-600">+{file.additions}</span>
                          <span className="text-red-500">-{file.deletions}</span>
                          {file.route && (
                            <Link
                              href={file.route}
                              target="_blank"
                              className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-200"
                            >
                              查看
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-gray-400">暂无文件改动信息</p>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 xl:col-span-2">
                <h2 className="font-semibold text-gray-900 mb-4">最近代码迭代</h2>
                {data.codeIterations.length === 0 ? (
                  <p className="text-sm text-gray-400">暂时读取不到 GitHub 提交记录。</p>
                ) : (
                  <div className="space-y-3">
                    {data.codeIterations.map((item) => (
                      <a
                        key={item.sha}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-gray-100 p-3 hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="line-clamp-2 text-sm font-medium text-gray-800">
                            {item.title}
                          </p>
                          <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500">
                            {item.shortSha}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-400">
                          {item.committedAt ? new Date(item.committedAt).toLocaleString() : "暂无时间"}
                        </p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-gray-900">免费额度</h2>
                    <p className="text-xs text-gray-500">
                      当前周期：{data.freeQuota.monthStart} 到 {data.freeQuota.monthEnd}
                    </p>
                  </div>
                  <Link href="/admin/monitoring" className="text-sm text-blue-600 hover:underline">
                    看详细监控
                  </Link>
                </div>
                <div className="space-y-4">
                  {data.freeQuota.quotas.map((quota) => (
                    <QuotaBar key={quota.key} quota={quota} />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h2 className="font-semibold text-gray-900 mb-4">待处理事项</h2>
                <div className="space-y-3">
                  {data.tasks.map((task) => (
                    <Link
                      key={task.title}
                      href={task.href}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition-colors"
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${levelStyle[task.level].dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-gray-800">{task.title}</p>
                          <span className="text-lg font-bold text-gray-900">{task.count}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">{task.desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1">
                <h2 className="font-semibold text-purple-950">定时任务设置</h2>
                <button
                  onClick={async () => {
                    if (!token) return;
                    setTriggerLoading(true);
                    setTriggerResult(null);
                    try {
                      const res = await fetch("/api/admin/trigger-all-workflows", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      const result = await res.json();
                      if (res.ok) {
                        setTriggerResult(result);
                      } else {
                        setTriggerResult({
                          message: result.error || "触发失败",
                          results: [],
                          successCount: 0,
                          failedCount: 0,
                        });
                      }
                    } catch {
                      setTriggerResult({
                        message: "网络请求失败",
                        results: [],
                        successCount: 0,
                        failedCount: 0,
                      });
                    } finally {
                      setTriggerLoading(false);
                    }
                  }}
                  disabled={triggerLoading}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60 transition-colors"
                >
                  {triggerLoading ? "触发中..." : "一键触发所有工作流"}
                </button>
              </div>
              <p className="text-sm text-purple-700 mb-4">设定自动巡检和自动发帖的执行时间（北京时间），或点击上方按钮立即触发所有自动化任务。</p>

              {triggerResult && (
                <div className="mb-4 rounded-xl border border-purple-100 bg-white p-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">{triggerResult.message}</p>
                  {triggerResult.results.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {triggerResult.results.map((r) => (
                        <div
                          key={r.workflow}
                          className={`rounded-lg px-3 py-2 text-xs ${
                            r.status === "success"
                              ? "bg-green-50 text-green-700 border border-green-100"
                              : "bg-red-50 text-red-700 border border-red-100"
                          }`}
                        >
                          <p className="font-medium">{r.name}</p>
                          <p className="mt-0.5">{r.status === "success" ? "已触发" : r.message || "失败"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-purple-100 bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-800">自动巡检</span>
                    <button
                      onClick={() => setSchedule({ ...schedule, patrolEnabled: !schedule.patrolEnabled })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${schedule.patrolEnabled ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${schedule.patrolEnabled ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">每天自动检查并改进网站</p>
                  <select
                    value={schedule.patrolHour}
                    onChange={(e) => setSchedule({ ...schedule, patrolHour: Number(e.target.value) })}
                    disabled={!schedule.patrolEnabled}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-purple-100 bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-800">自动发帖（第一篇）</span>
                    <button
                      onClick={() => setSchedule({ ...schedule, posterEnabled: !schedule.posterEnabled })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${schedule.posterEnabled ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${schedule.posterEnabled ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">开发教程或开源项目推荐</p>
                  <select
                    value={schedule.posterHour1}
                    onChange={(e) => setSchedule({ ...schedule, posterHour1: Number(e.target.value) })}
                    disabled={!schedule.posterEnabled}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-purple-100 bg-white p-4">
                  <div className="mb-2">
                    <span className="text-sm font-medium text-gray-800">自动发帖（第二篇）</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">第二篇帖子发送时间</p>
                  <select
                    value={schedule.posterHour2}
                    onChange={(e) => setSchedule({ ...schedule, posterHour2: Number(e.target.value) })}
                    disabled={!schedule.posterEnabled}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-purple-100 bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-800">自动 SEO 优化</span>
                    <button
                      onClick={() => setSchedule({ ...schedule, seoEnabled: !schedule.seoEnabled })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${schedule.seoEnabled ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${schedule.seoEnabled ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">自动补充页面 meta 标签和 SEO 元素</p>
                  <select
                    value={schedule.seoHour}
                    onChange={(e) => setSchedule({ ...schedule, seoHour: Number(e.target.value) })}
                    disabled={!schedule.seoEnabled}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-purple-100 bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-800">自动写博客</span>
                    <button
                      onClick={() => setSchedule({ ...schedule, creatorEnabled: !schedule.creatorEnabled })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${schedule.creatorEnabled ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${schedule.creatorEnabled ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">自动生成深度技术文章并发布</p>
                  <select
                    value={schedule.creatorHour}
                    onChange={(e) => setSchedule({ ...schedule, creatorHour: Number(e.target.value) })}
                    disabled={!schedule.creatorEnabled}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-purple-100 bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-800">自动回复论坛</span>
                    <button
                      onClick={() => setSchedule({ ...schedule, replyEnabled: !schedule.replyEnabled })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${schedule.replyEnabled ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${schedule.replyEnabled ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">每 2 小时检查并回复无评论的帖子</p>
                  <div className="text-sm text-gray-400 py-2">自动运行，无需设定时间</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={async () => {
                    setScheduleLoading(true);
                    try {
                      const res = await fetch("/api/admin/schedule", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify(schedule),
                      });
                      const result = await res.json();
                      setActionMessage(res.ok ? "定时配置已保存" : result.error || "保存失败");
                    } finally {
                      setScheduleLoading(false);
                    }
                  }}
                  disabled={scheduleLoading}
                  className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
                >
                  {scheduleLoading ? "保存中..." : "保存定时设置"}
                </button>
                {actionMessage && (
                  <span className="text-sm text-purple-700">{actionMessage}</span>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
            <p className="text-base font-semibold">看板数据暂时没出来</p>
            <p className="mt-2 text-sm">{loadError || "获取看板数据失败，请稍后刷新。"}</p>
            <button
              onClick={fetchData}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              重新加载
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Metric({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="mt-1 text-xs text-gray-500">
        {label}
        <span className="ml-1 text-gray-400">· {sub}</span>
      </div>
    </div>
  );
}

function QuotaBar({
  quota,
}: {
  quota: FreeDashboardData["freeQuota"]["quotas"][number];
}) {
  const style = levelStyle[quota.level];
  const usedText =
    quota.unit === "bytes"
      ? `${(quota.used / 1024 / 1024 / 1024).toFixed(2)} GB`
      : quota.unit === "ms"
        ? `${(quota.used / 1000 / 60).toFixed(1)} 分钟`
        : quota.used.toLocaleString();
  const totalText =
    quota.unit === "bytes"
      ? `${(quota.total / 1024 / 1024 / 1024).toFixed(0)} GB`
      : quota.unit === "ms"
        ? `${(quota.total / 1000 / 60 / 60).toFixed(0)} 小时`
        : quota.total.toLocaleString();

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="font-medium text-gray-700">{quota.label}</span>
        <span className="text-gray-500">
          {usedText} / {totalText}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${style.bar}`}
          style={{ width: `${Math.min(100, quota.percent)}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className={quota.level === "good" ? "text-green-600" : quota.level === "warning" ? "text-orange-600" : "text-red-600"}>
          {style.text}
        </span>
        <span className="text-gray-400">{quota.percent.toFixed(1)}%</span>
      </div>
    </div>
  );
}
