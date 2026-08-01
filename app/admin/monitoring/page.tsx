"use client";

import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";

interface MonitoringData {
  limits: {
    functionInvocations: number;
    cpuTimeMs: number;
    memoryGbHours: number;
    dataTransferBytes: number;
    edgeRequests: number;
  };
  usage: {
    functionInvocations: number;
    edgeRequests: number;
    cpuTimeMs: number;
    dataTransferBytes: number;
    memoryGbHours: number;
    dataTransferGB: number;
    cpuTimeHours: number;
  };
  remaining: {
    functionInvocations: number;
    edgeRequests: number;
    cpuTimeMs: number;
    dataTransferBytes: number;
    memoryGbHours: number;
    dataTransferGB: number;
    cpuTimeHours: number;
  };
  percentages: {
    functionInvocations: number;
    cpuTime: number;
    memory: number;
    dataTransfer: number;
    edgeRequests: number;
  };
  trend: Array<{
    date: string;
    functionInvocations: number;
    edgeRequests: number;
    cpuTimeMs: number;
    dataTransferMB: number;
  }>;
  routes: Array<{
    path: string;
    method: string;
    requestCount: number;
    totalCpuMs: number;
    avgCpuMs: number;
    totalDataMB: number;
  }>;
  billing: {
    cycleStart: string;
    cycleEnd: string;
    daysElapsed: number;
    daysTotal: number;
  };
  meta: {
    source: string;
    accuracy: string;
    lastRecordedAt: string | null;
    routeRowCount: number;
    trackingMode: string;
  };
  today: {
    functionInvocations: number;
    edgeRequests: number;
    cpuTimeMs: number;
    dataTransferMB: number;
  };
}

export default function MonitoringPage() {
  const { token } = useAppStore();
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/monitoring?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("获取监控数据失败:", err);
    } finally {
      setLoading(false);
    }
  }, [token, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 自动刷新（每60秒）
  useEffect(() => {
    const timer = setInterval(fetchData, 60000);
    return () => clearInterval(timer);
  }, [fetchData]);

  // ---- 工具函数 ----
  function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return n.toString();
  }

  function getBarColor(pct: number): string {
    if (pct >= 90) return "bg-red-500";
    if (pct >= 70) return "bg-orange-500";
    if (pct >= 50) return "bg-yellow-500";
    return "bg-green-500";
  }

  function getBarBg(pct: number): string {
    if (pct >= 90) return "bg-red-50 border-red-200";
    if (pct >= 70) return "bg-orange-50 border-orange-200";
    if (pct >= 50) return "bg-yellow-50 border-yellow-200";
    return "bg-green-50 border-green-200";
  }

  // 柱状图最大值
  const maxTrendRequests = data
    ? Math.max(...data.trend.map((t) => t.edgeRequests), 1)
    : 1;

  return (
    <AdminLayout activeKey="monitoring">
      <div className="space-y-6">
        {/* 标题栏 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📊 用量监控</h1>
            <p className="mt-1 text-sm text-gray-500">
              站内访问趋势和热门路由 · 用于排查高消耗页面
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>最近 7 天</option>
              <option value={14}>最近 14 天</option>
              <option value={30}>最近 30 天</option>
            </select>
            <button
              onClick={fetchData}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              刷新
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : data ? (
          <>
            {/* 计费周期信息 */}
            <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <span>📅</span>
              <span>
                当前统计周期：{data.billing.cycleStart} ~ {data.billing.cycleEnd}
                （第 {data.billing.daysElapsed}/{data.billing.daysTotal} 天）
              </span>
              <span className="ml-auto text-xs text-blue-500">
                自动刷新中（每60秒）
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <InfoCard
                label="数据来源"
                value={data.meta.source}
                desc={data.meta.accuracy}
              />
              <InfoCard
                label="最近入库"
                value={data.meta.lastRecordedAt ? new Date(data.meta.lastRecordedAt).toLocaleString() : "暂无记录"}
                desc={data.meta.lastRecordedAt ? "如果这里一直不变，说明埋点没有写入数据库。" : "还没有采集到请求数据。"}
              />
              <InfoCard
                label="路由样本"
                value={`${data.meta.routeRowCount} 条`}
                desc="按日期、路径、方法累积，再按本月请求数聚合排序。"
              />
            </div>

            {/* 今日概览 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <TodayCard
                label="今日函数调用"
                value={formatNumber(data.today.functionInvocations)}
                icon="⚡"
              />
              <TodayCard
                label="今日边缘请求"
                value={formatNumber(data.today.edgeRequests)}
                icon="🌐"
              />
              <TodayCard
                label="今日CPU时间"
                value={`${(data.today.cpuTimeMs / 1000).toFixed(1)}s`}
                icon="🕐"
              />
              <TodayCard
                label="今日数据传输"
                value={`${data.today.dataTransferMB.toFixed(1)} MB`}
                icon="📦"
              />
            </div>

            {/* 限额进度卡片 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <UsageCard
                title="函数调用"
                icon="⚡"
                used={formatNumber(data.usage.functionInvocations)}
                total={formatNumber(data.limits.functionInvocations)}
                remaining={formatNumber(data.remaining.functionInvocations)}
                percentage={data.percentages.functionInvocations}
                barColor={getBarColor(data.percentages.functionInvocations)}
                cardBg={getBarBg(data.percentages.functionInvocations)}
                detail={`${data.usage.functionInvocations.toLocaleString()} / ${data.limits.functionInvocations.toLocaleString()}`}
              />
              <UsageCard
                title="边缘请求"
                icon="🌐"
                used={formatNumber(data.usage.edgeRequests)}
                total={formatNumber(data.limits.edgeRequests)}
                remaining={formatNumber(data.remaining.edgeRequests)}
                percentage={data.percentages.edgeRequests}
                barColor={getBarColor(data.percentages.edgeRequests)}
                cardBg={getBarBg(data.percentages.edgeRequests)}
                detail={`${data.usage.edgeRequests.toLocaleString()} / ${data.limits.edgeRequests.toLocaleString()}`}
              />
              <UsageCard
                title="CPU 时间"
                icon="🕐"
                used={`${data.usage.cpuTimeHours.toFixed(2)}h`}
                total="4h"
                remaining={`${data.remaining.cpuTimeHours.toFixed(2)}h`}
                percentage={data.percentages.cpuTime}
                barColor={getBarColor(data.percentages.cpuTime)}
                cardBg={getBarBg(data.percentages.cpuTime)}
                detail={`${(data.usage.cpuTimeMs / 1000).toFixed(0)}s / ${(data.limits.cpuTimeMs / 1000).toFixed(0)}s`}
              />
              <UsageCard
                title="数据传输"
                icon="📦"
                used={`${data.usage.dataTransferGB.toFixed(2)} GB`}
                total="100 GB"
                remaining={`${data.remaining.dataTransferGB.toFixed(2)} GB`}
                percentage={data.percentages.dataTransfer}
                barColor={getBarColor(data.percentages.dataTransfer)}
                cardBg={getBarBg(data.percentages.dataTransfer)}
                detail={`${(data.usage.dataTransferBytes / (1024 ** 2)).toFixed(0)} MB / ${(data.limits.dataTransferBytes / (1024 ** 2)).toFixed(0)} MB`}
              />
              <UsageCard
                title="内存"
                icon="💾"
                used={`${data.usage.memoryGbHours.toFixed(2)} GB·h`}
                total="360 GB·h"
                remaining={`${data.remaining.memoryGbHours.toFixed(2)} GB·h`}
                percentage={data.percentages.memory}
                barColor={getBarColor(data.percentages.memory)}
                cardBg={getBarBg(data.percentages.memory)}
                detail={`按 CPU 时间 × 256MB 估算`}
              />
            </div>

            {/* 趋势图 */}
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-3">
                📈 {days} 天请求趋势
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                {data.trend.every((t) => t.edgeRequests === 0) ? (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-4xl mb-3">📊</p>
                    <p className="text-sm">暂无趋势数据</p>
                  </div>
                ) : (
                  <div className="flex items-end gap-1 h-40">
                    {data.trend.map((t, i) => {
                      const height = (t.edgeRequests / maxTrendRequests) * 100;
                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col items-center group relative"
                        >
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                            <div className="bg-gray-800 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap">
                              {t.date}
                              <br />
                              边缘: {t.edgeRequests} | 函数: {t.functionInvocations}
                              <br />
                              传输: {t.dataTransferMB.toFixed(1)}MB
                            </div>
                          </div>
                          {/* 柱子 */}
                          <div
                            className="w-full bg-gradient-to-t from-blue-400 to-blue-500 rounded-t-sm transition-all hover:from-blue-500 hover:to-blue-600"
                            style={{ height: `${Math.max(height, 2)}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                  <span>{data.trend[0]?.date || ""}</span>
                  <span>{data.trend[data.trend.length - 1]?.date || ""}</span>
                </div>
              </div>
            </div>

            {/* 路由 Top 列表 */}
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-3">
                🔥 热门路由 Top 20（本月聚合）
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {data.routes.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-4xl mb-3">📋</p>
                    <p className="text-sm">暂无路由数据</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left px-4 py-3 font-medium text-gray-600">路由</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">方法</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">请求数</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">平均CPU</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">总传输</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.routes.map((route, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                              {route.path}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                                route.method === "GET"
                                  ? "bg-green-50 text-green-700"
                                  : route.method === "POST"
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-gray-50 text-gray-700"
                              }`}>
                                {route.method}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {route.requestCount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500">
                              {route.avgCpuMs}ms
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500">
                              {route.totalDataMB > 1
                                ? `${route.totalDataMB.toFixed(1)} MB`
                                : `${(route.totalDataMB * 1024).toFixed(0)} KB`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 说明 */}
            <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
              <p className="mb-1">ℹ️ 说明：</p>
              <p>• 这里显示的是站内中间件埋点估算数据，用来判断访问趋势和哪个路由最热，不是 Vercel 官方账单。</p>
              <p>• Vercel 官方函数调用、带宽、执行时间仍以 Vercel 后台 Usage 页面为准。</p>
              <p>• CPU、流量、内存是根据请求类型和采集耗时估算，用于相对比较，不用于精确扣费判断。</p>
              <p>• 数据存储在项目数据库中；如果“最近入库”不更新，优先检查数据库连接和中间件追踪接口。</p>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-gray-400">
            <p>获取数据失败，请刷新重试</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

// ============ 限额使用卡片 ============
function UsageCard({
  title,
  icon,
  used,
  total,
  remaining,
  percentage,
  barColor,
  cardBg,
  detail,
}: {
  title: string;
  icon: string;
  used: string;
  total: string;
  remaining: string;
  percentage: number;
  barColor: string;
  cardBg: string;
  detail: string;
}) {
  const isWarning = percentage >= 80;
  return (
    <div className={`rounded-xl border p-5 ${cardBg}`}>
      {/* 标题行 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
        {isWarning && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 animate-pulse">
            接近上限
          </span>
        )}
      </div>

      {/* 数值 */}
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <span className="text-2xl font-bold text-gray-900">{used}</span>
          <span className="text-sm text-gray-400 ml-1">/ {total}</span>
        </div>
        <span className={`text-lg font-bold ${
          percentage >= 90 ? "text-red-600" : percentage >= 70 ? "text-orange-600" : "text-green-600"
        }`}>
          {percentage.toFixed(1)}%
        </span>
      </div>

      {/* 进度条 */}
      <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* 详情 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{detail}</span>
        <span>剩余 {remaining}</span>
      </div>
    </div>
  );
}

// ============ 今日数据卡片 ============
function TodayCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{icon}</span>
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  desc,
}: {
  label: string;
  value: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
      <p className="mt-1 text-xs text-gray-500">{desc}</p>
    </div>
  );
}
