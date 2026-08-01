"use client";

import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

interface TableStat {
  name: string;
  displayName: string;
  count: number;
  canClean: boolean;
  cleanDescription: string;
}

interface TableSize {
  tableName: string;
  sizeBytes: number;
  rowCount: number;
}

interface CleanableEstimate {
  table: string;
  label: string;
  count: number;
  description: string;
}

interface DbSizeDetail {
  dataBytes: number;
  indexBytes: number;
  toastBytes: number;
  totalBytes: number;
}

interface DatabaseData {
  tables: TableStat[];
  dbSize: number | null;
  dbSizeDetail: DbSizeDetail | null;
  dbLimitBytes: number;
  tableSizes: TableSize[];
  cleanableEstimates: CleanableEstimate[];
  dbInfo: { host: string; database: string; maxConnections: number };
  totalTables: number;
}

export default function DatabasePage() {
  const { token } = useAppStore();
  const [data, setData] = useState<DatabaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "tables" | "cleanup" | "maintenance">("overview");
  const [cleaning, setCleaning] = useState<string | null>(null);
  const [confirmTable, setConfirmTable] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/database", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("获取数据库数据失败:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 清理操作
  const handleClean = async (tableName: string, days: number = 30) => {
    if (!token) return;
    setCleaning(tableName);
    setConfirmTable(null);
    try {
      const res = await fetch("/api/admin/database", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "clean", tableName, days }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(result.message);
        fetchData();
      } else {
        toast.error(result.error || "清理失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setCleaning(null);
    }
  };

  // VACUUM
  const handleVacuum = async () => {
    if (!token) return;
    setCleaning("vacuum");
    try {
      const res = await fetch("/api/admin/database", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "vacuum" }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message || "VACUUM 成功");
      } else {
        toast.error(result.error || "VACUUM 失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setCleaning(null);
    }
  };

  // REINDEX
  const handleReindex = async () => {
    if (!token) return;
    setCleaning("reindex");
    try {
      const res = await fetch("/api/admin/database", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "reindex" }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message || "REINDEX 成功");
      } else {
        toast.error(result.error || "REINDEX 失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setCleaning(null);
    }
  };

  // 格式化文件大小
  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  function formatNumber(n: number): string {
    return n.toLocaleString();
  }

  // 获取表大小（从 tableSizes 中匹配）
  function getTableSize(tableName: string): TableSize | undefined {
    // Prisma 模型名 → 数据库表名（首字母大写或驼峰）
    const possibleNames = [
      tableName.charAt(0).toUpperCase() + tableName.slice(1),
      tableName,
    ];
    return data?.tableSizes.find((ts) =>
      possibleNames.some(
        (pn) =>
          ts.tableName.toLowerCase() === pn.toLowerCase() ||
          ts.tableName.toLowerCase().replace(/_/g, "") === pn.toLowerCase()
      )
    );
  }

  const tabs = [
    { key: "overview" as const, label: "概览", icon: "📊" },
    { key: "tables" as const, label: "数据表", icon: "📋" },
    { key: "cleanup" as const, label: "数据清理", icon: "🧹" },
    { key: "maintenance" as const, label: "维护操作", icon: "🔧" },
  ];

  return (
    <AdminLayout activeKey="database">
      <div className="space-y-6">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🗄️ 数据库管理</h1>
            <p className="mt-1 text-sm text-gray-500">
              数据库概览 · 数据表管理 · 无用数据清理 · 维护操作
            </p>
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            刷新
          </button>
        </div>

        {/* Tab 栏 */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : data ? (
          <>
            {/* ===== 概览 Tab ===== */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* 数据库空间使用进度条 */}
                {data.dbSize !== null && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-base font-semibold text-gray-800">
                        💾 数据库空间使用
                      </h2>
                      <span className="text-xs text-gray-400">
                        Vercel 免费版限制
                      </span>
                    </div>

                    {/* 进度条 */}
                    {(() => {
                      const limit = data.dbLimitBytes || 256 * 1024 * 1024;
                      const used = data.dbSize || 0;
                      const pct = Math.min((used / limit) * 100, 100);
                      const remaining = limit - used;
                      const isWarning = pct >= 80;
                      const isDanger = pct >= 90;

                      return (
                        <>
                          <div className="flex items-baseline justify-between mb-2">
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-bold text-gray-900">
                                {formatBytes(used)}
                              </span>
                              <span className="text-sm text-gray-400">
                                / {formatBytes(limit)}
                              </span>
                            </div>
                            <span
                              className={`text-sm font-semibold ${
                                isDanger
                                  ? "text-red-600"
                                  : isWarning
                                  ? "text-orange-600"
                                  : "text-green-600"
                              }`}
                            >
                              {pct.toFixed(1)}%
                            </span>
                          </div>

                          <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
                            <div
                              className={`h-full rounded-full transition-all duration-500 flex items-center justify-end pr-3 ${
                                isDanger
                                  ? "bg-gradient-to-r from-red-400 to-red-500"
                                  : isWarning
                                  ? "bg-gradient-to-r from-orange-400 to-orange-500"
                                  : "bg-gradient-to-r from-blue-400 to-blue-500"
                              }`}
                              style={{ width: `${Math.max(pct, 3)}%` }}
                            >
                              {pct > 10 && (
                                <span className="text-xs text-white font-medium whitespace-nowrap">
                                  {formatBytes(used)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 剩余空间 */}
                          <div className="flex items-center justify-between mt-2 text-xs">
                            <span className="text-gray-400">
                              剩余可用： <span className="font-medium text-gray-600">{formatBytes(remaining)}</span>
                            </span>
                            {isWarning && (
                              <span className={`font-medium ${isDanger ? "text-red-600" : "text-orange-600"}`}>
                                {isDanger ? "⚠️ 空间即将用尽，请尽快清理！" : "⚠️ 空间使用率较高"}
                              </span>
                            )}
                          </div>

                          {/* 大小明细 */}
                          {data.dbSizeDetail && (
                            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
                              <div className="text-center">
                                <div className="w-3 h-3 rounded-full bg-blue-500 mx-auto mb-1" />
                                <div className="text-xs text-gray-400">数据</div>
                                <div className="text-sm font-semibold text-gray-700">
                                  {formatBytes(data.dbSizeDetail.dataBytes)}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="w-3 h-3 rounded-full bg-purple-500 mx-auto mb-1" />
                                <div className="text-xs text-gray-400">索引</div>
                                <div className="text-sm font-semibold text-gray-700">
                                  {formatBytes(data.dbSizeDetail.indexBytes)}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="w-3 h-3 rounded-full bg-green-500 mx-auto mb-1" />
                                <div className="text-xs text-gray-400">TOAST</div>
                                <div className="text-sm font-semibold text-gray-700">
                                  {formatBytes(data.dbSizeDetail.toastBytes)}
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* 数据库概览卡片 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <OverviewCard
                    label="数据库大小"
                    value={data.dbSize ? formatBytes(data.dbSize) : "未知"}
                    icon="💾"
                  />
                  <OverviewCard
                    label="数据表数量"
                    value={`${data.totalTables}`}
                    icon="📋"
                  />
                  <OverviewCard
                    label="可清理项"
                    value={`${data.cleanableEstimates.length}`}
                    icon="🧹"
                    highlight={data.cleanableEstimates.length > 0}
                  />
                  <OverviewCard
                    label="最大连接数"
                    value={data.dbInfo.maxConnections > 0 ? `${data.dbInfo.maxConnections}` : "未知"}
                    icon="🔌"
                  />
                </div>

                {/* 表大小排行 */}
                <div>
                  <h2 className="text-base font-semibold text-gray-800 mb-3">
                    📦 数据表大小排行
                  </h2>
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    {data.tableSizes.length === 0 ? (
                      <p className="text-center py-8 text-gray-400 text-sm">
                        无法获取表大小信息（可能是权限不足）
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {data.tableSizes.map((ts) => {
                          const maxSize = Math.max(...data.tableSizes.map((t) => t.sizeBytes), 1);
                          const pct = (ts.sizeBytes / maxSize) * 100;
                          return (
                            <div key={ts.tableName} className="flex items-center gap-3">
                              <span className="w-40 text-xs font-mono text-gray-600 truncate">
                                {ts.tableName}
                              </span>
                              <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full flex items-center justify-end pr-2"
                                  style={{ width: `${Math.max(pct, 5)}%` }}
                                >
                                  <span className="text-xs text-white font-medium">
                                    {formatBytes(ts.sizeBytes)}
                                  </span>
                                </div>
                              </div>
                              <span className="w-20 text-xs text-gray-400 text-right">
                                ~{formatNumber(ts.rowCount)} 行
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 快速统计 */}
                <div>
                  <h2 className="text-base font-semibold text-gray-800 mb-3">
                    📈 数据量统计
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {data.tables
                      .filter((t) => t.count > 0)
                      .sort((a, b) => b.count - a.count)
                      .map((table) => (
                        <div
                          key={table.name}
                          className="bg-white rounded-xl border border-gray-200 p-4"
                        >
                          <div className="text-xs text-gray-400 mb-1">
                            {table.displayName}
                          </div>
                          <div className="text-xl font-bold text-gray-900">
                            {formatNumber(table.count)}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            条记录
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== 数据表 Tab ===== */}
            {activeTab === "tables" && (
              <div>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">数据表</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">记录数</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">大小</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">可清理</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.tables.map((table) => {
                        const sizeInfo = getTableSize(table.name);
                        return (
                          <tr key={table.name} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-700">
                                {table.displayName}
                              </div>
                              <div className="text-xs text-gray-400 font-mono">
                                {table.name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-semibold ${
                                table.count > 1000 ? "text-orange-600" : "text-gray-700"
                              }`}>
                                {table.count >= 0 ? formatNumber(table.count) : "错误"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500 text-xs">
                              {sizeInfo ? formatBytes(sizeInfo.sizeBytes) : "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {table.canClean ? (
                                <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700">
                                  可清理
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-50 text-gray-400">
                                  -
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===== 数据清理 Tab ===== */}
            {activeTab === "cleanup" && (
              <div className="space-y-4">
                {/* 可清理数据列表 */}
                <div>
                  <h2 className="text-base font-semibold text-gray-800 mb-3">
                    🧹 可清理数据（{data.cleanableEstimates.length} 项）
                  </h2>

                  {data.cleanableEstimates.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                      <p className="text-4xl mb-3">✨</p>
                      <p className="text-sm text-gray-400">
                        暂无可清理数据，数据库很干净！
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data.cleanableEstimates.map((item) => (
                        <div
                          key={item.table}
                          className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-xl">
                              🗑️
                            </div>
                            <div>
                              <div className="font-medium text-gray-800">
                                {item.label}
                                <span className="ml-2 px-2 py-0.5 text-xs font-bold rounded-full bg-orange-100 text-orange-700">
                                  {formatNumber(item.count)} 条
                                </span>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {item.description}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {confirmTable === item.table ? (
                              <>
                                <button
                                  onClick={() => handleClean(item.table)}
                                  disabled={cleaning === item.table}
                                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                  {cleaning === item.table ? "清理中..." : "确认清理"}
                                </button>
                                <button
                                  onClick={() => setConfirmTable(null)}
                                  className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  取消
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setConfirmTable(item.table)}
                                className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                清理
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 全部可清理的表 */}
                <div>
                  <h2 className="text-base font-semibold text-gray-800 mb-3 mt-6">
                    📋 所有可清理的数据表
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.tables
                      .filter((t) => t.canClean)
                      .map((table) => (
                        <div
                          key={table.name}
                          className="bg-white rounded-xl border border-gray-200 p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-800">
                              {table.displayName}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatNumber(table.count)} 条
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-3">
                            {table.cleanDescription}
                          </p>
                          {confirmTable === `all_${table.name}` ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleClean(table.name)}
                                disabled={cleaning === table.name}
                                className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                              >
                                {cleaning === table.name ? "清理中..." : "确认"}
                              </button>
                              <button
                                onClick={() => setConfirmTable(null)}
                                className="px-3 py-1.5 text-xs text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmTable(`all_${table.name}`)}
                              disabled={table.count === 0}
                              className="w-full px-3 py-1.5 text-xs font-medium text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              清理数据
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== 维护操作 Tab ===== */}
            {activeTab === "maintenance" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* VACUUM */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">🧽</span>
                      <h3 className="text-sm font-semibold text-gray-800">VACUUM ANALYZE</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                      回收已删除数据的空间，更新查询优化器统计信息。建议在大量清理后执行。
                    </p>
                    <button
                      onClick={handleVacuum}
                      disabled={cleaning === "vacuum"}
                      className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {cleaning === "vacuum" ? "执行中..." : "执行 VACUUM"}
                    </button>
                  </div>

                  {/* REINDEX */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">🔧</span>
                      <h3 className="text-sm font-semibold text-gray-800">REINDEX</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                      重建数据库索引，提升查询性能。适用于索引碎片化严重的情况。
                    </p>
                    <button
                      onClick={handleReindex}
                      disabled={cleaning === "reindex"}
                      className="w-full px-4 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {cleaning === "reindex" ? "执行中..." : "执行 REINDEX"}
                    </button>
                  </div>
                </div>

                {/* 数据库信息 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">📋 数据库信息</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <InfoItem label="数据库总大小" value={data.dbSize ? formatBytes(data.dbSize) : "未知"} />
                    <InfoItem label="数据表数量" value={`${data.totalTables}`} />
                    <InfoItem label="最大连接数" value={data.dbInfo.maxConnections > 0 ? `${data.dbInfo.maxConnections}` : "未知"} />
                  </div>
                  {data.dbSizeDetail && (
                    <div className="grid grid-cols-3 gap-4 text-sm mt-4 pt-4 border-t border-gray-100">
                      <InfoItem label="数据本体" value={formatBytes(data.dbSizeDetail.dataBytes)} />
                      <InfoItem label="索引大小" value={formatBytes(data.dbSizeDetail.indexBytes)} />
                      <InfoItem label="TOAST 大字段" value={formatBytes(data.dbSizeDetail.toastBytes)} />
                    </div>
                  )}
                </div>

                {/* 危险说明 */}
                <div className="px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                  <p className="mb-1">⚠️ 注意事项：</p>
                  <p>• VACUUM 和 REINDEX 会在数据库上创建锁，执行期间可能影响性能</p>
                  <p>• 建议在低峰期执行维护操作</p>
                  <p>• 清理操作不可恢复，请确认后再执行</p>
                  <p>• 核心数据表（用户、产品、订单等）不支持直接清理</p>
                </div>
              </div>
            )}
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

// ============ 概览卡片 ============
function OverviewCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "bg-orange-50 border-orange-200"
          : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
        {highlight && (
          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
        )}
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

// ============ 信息项 ============
function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="font-medium text-gray-800">{value}</div>
    </div>
  );
}
