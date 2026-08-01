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
  autoIteration: {
    enabled: boolean;
    requireApproval: boolean;
    safeMode: boolean;
    lastRequest: string;
    lastDeployApproval: string;
    manualDeployConfigured: boolean;
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
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/free-dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-sm font-medium text-blue-700">免费策略</p>
                <p className="mt-2 text-2xl font-bold text-blue-900">
                  先用免费额度跑
                </p>
                <p className="mt-3 text-sm text-blue-700">
                  目前看板不依赖付费监控服务。只有当流量、数据库或 AI 自动化超过免费额度时，才需要考虑付费。
                </p>
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
                  </div>
                  <p className="mt-2 text-sm text-indigo-800">
                    开启后，后台可以记录自动巡检请求。AI 改完后要在日志里说明改了哪里、优化了什么、验证是否通过，再由你决定是否触发上线。
                  </p>
                  {lastAutoRequest ? (
                    <div className="mt-3 rounded-xl border border-indigo-100 bg-white/70 p-3 text-sm text-indigo-900">
                      <p className="font-medium">最近巡检：{lastAutoRequest.requirement || "未填写需求"}</p>
                      <p className="mt-1 text-xs text-indigo-600">
                        {lastAutoRequest.createdAt
                          ? new Date(lastAutoRequest.createdAt).toLocaleString()
                          : "暂无时间"}
                        {" · "}
                        {lastAutoRequest.status === "waiting_for_ai_changes" ? "等待 AI 修改并输出日志" : "已记录"}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-indigo-600">还没有自动巡检记录。</p>
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
                  <button
                    onClick={() =>
                      runAutoIterationAction("trigger_inspection", {
                        requirement: "检查后台可用性、免费额度、部署状态，并给出可安全优化项",
                      })
                    }
                    disabled={Boolean(actionLoading) || !data.autoIteration.enabled}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100 disabled:opacity-60"
                  >
                    {actionLoading === "trigger_inspection" ? "记录中..." : "触发一次巡检"}
                  </button>
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

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2">
                <h2 className="font-semibold text-gray-900 mb-4">下一步建议</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.suggestions.map((item, index) => (
                    <div key={index} className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm text-gray-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h2 className="font-semibold text-gray-900 mb-4">免费组件</h2>
                <div className="space-y-3">
                  {data.freeStack.map((item) => (
                    <div key={item.name} className="text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="font-medium text-gray-700">{item.name}</span>
                        <span className="text-xs text-green-600">{item.status}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h2 className="font-semibold text-gray-900 mb-4">热门工具</h2>
                {data.hotTools.length === 0 ? (
                  <p className="text-sm text-gray-400">暂无工具数据</p>
                ) : (
                  <div className="space-y-3">
                    {data.hotTools.map((tool, index) => (
                      <div key={tool.id} className="flex items-center gap-3">
                        <span className="w-6 text-sm text-gray-400">#{index + 1}</span>
                        <span className="text-lg">{tool.icon || "🧩"}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">{tool.name}</p>
                          <p className="text-xs text-gray-400">{tool.category || "未分类"}</p>
                        </div>
                        <span className="text-sm text-gray-600">{tool.clickCount} 次</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h2 className="font-semibold text-gray-900 mb-4">最近操作</h2>
                {data.recentLogs.length === 0 ? (
                  <p className="text-sm text-gray-400">暂无操作记录</p>
                ) : (
                  <div className="space-y-3">
                    {data.recentLogs.map((log) => (
                      <div key={log.id} className="border-l-2 border-gray-200 pl-3">
                        <p className="text-sm font-medium text-gray-800">{log.action}</p>
                        <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">
                          {log.detail || "无详情"} · {log.username || "系统"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="text-center py-20 text-gray-400">
            获取看板数据失败，请稍后刷新。
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
