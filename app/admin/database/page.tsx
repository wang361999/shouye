"use client";

import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import ExternalDatabaseManager from "@/components/admin/ExternalDatabaseManager";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
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
  dbEngine?: string;
}

// ============ 备份恢复相关类型 ============
interface RestorePreview {
  valid: boolean;
  version: string;
  exportedAt: string;
  exportedBy: string;
  totalRecords: number;
  tables: Array<{ table: string; count: number }>;
  totalTables: number;
}

interface RestoreResult {
  success: boolean;
  message: string;
  summary: {
    mode: string;
    tablesProcessed: number;
    totalDeleted: number;
    totalInserted: number;
    hasError: boolean;
  };
  details: Array<{ table: string; action: string; count: number; error?: string }>;
}

export default function DatabasePage() {
  const { token } = useAppStore();
  const [data, setData] = useState<DatabaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "tables" | "cleanup" | "maintenance" | "backup" | "external">("overview");
  const [cleaning, setCleaning] = useState<string | null>(null);
  const [confirmTable, setConfirmTable] = useState<string | null>(null);

  // 备份恢复状态
  const [backingUp, setBackingUp] = useState(false);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [restoreMode, setRestoreMode] = useState<"replace" | "merge">("replace");
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  // R2 备份状态
  const [r2BackingUp, setR2BackingUp] = useState(false);
  const [r2Backups, setR2Backups] = useState<Array<{ key: string; size: number; lastModified: string }>>([]);
  const [r2Loading, setR2Loading] = useState(false);
  const [r2Configured, setR2Configured] = useState(false);
  const [r2DeleteKey, setR2DeleteKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/database");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        toast.error("获取数据库数据失败");
      }
    } catch (err) {
      console.error("获取数据库数据失败:", err);
      toast.error("获取数据库数据失败，请刷新重试");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 清理操作
  const handleClean = async (tableName: string) => {
    if (!token) return;
    setCleaning(tableName);
    setConfirmTable(null);
    try {
      const res = await adminFetch("/api/admin/database", {
        method: "POST",
        body: JSON.stringify({ action: "clean", tableName }),
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
      const res = await adminFetch("/api/admin/database", {
        method: "POST",
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
      const res = await adminFetch("/api/admin/database", {
        method: "POST",
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

  // ============ 备份操作 ============
  const handleBackup = async () => {
    if (!token) return;
    setBackingUp(true);
    try {
      const tablesParam =
        selectedTables.size > 0 ? `?tables=${Array.from(selectedTables).join(",")}` : "";
      const res = await adminFetch(`/api/admin/database/backup${tablesParam}`);

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "备份失败");
        return;
      }

      // 获取文件名
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `db-backup-${Date.now()}.json`;

      // 转为 Blob 并下载
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("备份文件已下载");
    } catch {
      toast.error("网络错误，备份失败");
    } finally {
      setBackingUp(false);
    }
  };

  // ============ 恢复预检 ============
  const handleFileSelect = async (file: File | null) => {
    if (!file || !token) return;

    setRestoreFile(file);
    setRestorePreview(null);
    setRestoreResult(null);
    setConfirmRestore(false);

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      // 预检
      const res = await adminFetch("/api/admin/database/restore", {
        method: "PUT",
        body: JSON.stringify({ backupData }),
      });

      const result = await res.json();
      if (res.ok && result.valid) {
        setRestorePreview(result);
      } else {
        toast.error(result.error || "无效的备份文件");
      }
    } catch {
      toast.error("文件解析失败，请检查文件格式");
    }
  };

  // ============ 执行恢复 ============
  const handleRestore = async () => {
    if (!token || !restoreFile) return;
    setRestoring(true);
    setConfirmRestore(false);

    try {
      const text = await restoreFile.text();
      const backupData = JSON.parse(text);

      const res = await adminFetch("/api/admin/database/restore", {
        method: "POST",
        body: JSON.stringify({ backupData, mode: restoreMode }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setRestoreResult(result);
        toast.success(result.message);
        // 恢复后刷新数据
        fetchData();
      } else {
        setRestoreResult(result);
        toast.error(result.error || "恢复失败");
      }
    } catch {
      toast.error("网络错误，恢复失败");
    } finally {
      setRestoring(false);
    }
  };

  // ============ 全选/取消全选表 ============
  const toggleTableSelection = (tableName: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data) return;
    if (selectedTables.size === data.tables.length) {
      setSelectedTables(new Set());
    } else {
      setSelectedTables(new Set(data.tables.map((t) => t.name)));
    }
  };

  // ============ R2 备份操作 ============
  const fetchR2Backups = useCallback(async () => {
    if (!token) return;
    setR2Loading(true);
    try {
      const res = await adminFetch("/api/admin/database/backup-r2");
      const json = await res.json();
      if (res.ok) {
        setR2Backups(json.backups || []);
        setR2Configured(json.configured ?? false);
      } else {
        setR2Configured(false);
      }
    } catch {
      // 静默处理
    } finally {
      setR2Loading(false);
    }
  }, [token]);

  const handleR2Backup = async () => {
    if (!token) return;
    setR2BackingUp(true);
    try {
      const body =
        selectedTables.size > 0
          ? { tables: Array.from(selectedTables) }
          : {};
      const res = await adminFetch("/api/admin/database/backup-r2", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(result.message || "备份已上传到 Cloudflare R2");
        fetchR2Backups();
      } else {
        toast.error(result.error || "R2 备份失败");
      }
    } catch {
      toast.error("网络错误，R2 备份失败");
    } finally {
      setR2BackingUp(false);
    }
  };

  const handleR2Delete = async (key: string) => {
    if (!token) return;
    try {
      const res = await adminFetch(
        `/api/admin/database/backup-r2?key=${encodeURIComponent(key)}`,
        { method: "DELETE" },
      );
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success("备份已删除");
        fetchR2Backups();
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch {
      toast.error("网络错误");
    }
    setR2DeleteKey(null);
  };

  // 切换到备份 Tab 时加载 R2 备份列表
  useEffect(() => {
    if (activeTab === "backup" && token) {
      fetchR2Backups();
    }
  }, [activeTab, token, fetchR2Backups]);

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
    { key: "backup" as const, label: "备份恢复", icon: "💾" },
    { key: "external" as const, label: "外部数据库", icon: "🔗" },
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
                        Turso 免费版限制
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
                                <div className="text-xs text-gray-400">总计</div>
                                <div className="text-sm font-semibold text-gray-700">
                                  {formatBytes(data.dbSizeDetail.totalBytes)}
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
                    label="数据库引擎"
                    value={data.dbEngine ? data.dbEngine.toUpperCase() : "LibSQL"}
                    icon="⚙️"
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
                      <h3 className="text-sm font-semibold text-gray-800">VACUUM</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                      回收已删除数据的空间，优化数据库存储。Turso/LibSQL HTTP 模式可能不支持此操作。
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
                      重建数据库索引，提升查询性能。Turso/LibSQL HTTP 模式可能不支持此操作。
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
                    <InfoItem label="数据库引擎" value={data.dbEngine ? data.dbEngine.toUpperCase() : "LibSQL"} />
                  </div>
                  {data.dbSizeDetail && (
                    <div className="grid grid-cols-3 gap-4 text-sm mt-4 pt-4 border-t border-gray-100">
                      <InfoItem label="数据本体" value={formatBytes(data.dbSizeDetail.dataBytes)} />
                      <InfoItem label="索引大小" value={formatBytes(data.dbSizeDetail.indexBytes)} />
                      <InfoItem label="总计大小" value={formatBytes(data.dbSizeDetail.totalBytes)} />
                    </div>
                  )}
                </div>

                {/* 危险说明 */}
                <div className="px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                  <p className="mb-1">⚠️ 注意事项：</p>
                  <p>• 当前数据库引擎为 Turso/LibSQL，VACUUM 和 REINDEX 可能在 HTTP 模式下不可用</p>
                  <p>• 数据清理功能可正常使用，不受影响</p>
                  <p>• 清理操作不可恢复，请确认后再执行</p>
                  <p>• 核心数据表（用户、产品、订单等）不支持直接清理</p>
                </div>
              </div>
            )}

            {/* ===== 备份恢复 Tab ===== */}
            {activeTab === "backup" && (
              <div className="space-y-6">
                {/* ---- 备份区域 ---- */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">📤</span>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">数据库备份</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        导出全部或选中数据表的数据为 JSON 文件
                      </p>
                    </div>
                  </div>

                  {/* 表选择 */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">
                        选择备份的表（不选则备份全部）
                      </span>
                      <button
                        onClick={toggleSelectAll}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {selectedTables.size === data.tables.length ? "取消全选" : "全选"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-3 bg-gray-50 rounded-lg">
                      {data.tables.map((table) => (
                        <label
                          key={table.name}
                          className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white px-2 py-1.5 rounded transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTables.has(table.name)}
                            onChange={() => toggleTableSelection(table.name)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-700 truncate">
                            {table.displayName}
                          </span>
                          <span className="text-gray-400">({formatNumber(table.count)})</span>
                        </label>
                      ))}
                    </div>
                    {selectedTables.size > 0 && (
                      <p className="text-xs text-blue-600 mt-2">
                        已选 {selectedTables.size} 张表
                      </p>
                    )}
                  </div>

                  {/* 备份按钮 */}
                  <button
                    onClick={handleBackup}
                    disabled={backingUp}
                    className="w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {backingUp ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        正在导出...
                      </>
                    ) : (
                      <>
                        💾 下载备份文件
                      </>
                    )}
                  </button>

                  {/* 备份说明 */}
                  <div className="mt-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                    <p className="mb-1">📋 备份说明：</p>
                    <p>• 备份格式为 JSON，包含所有表数据和元信息</p>
                    <p>• 建议定期备份，重要操作前先备份</p>
                    <p>• 备份文件可用于跨环境迁移数据</p>
                    <p>• BigInt 和日期字段已特殊编码，可直接用于恢复</p>
                  </div>
                </div>

                {/* ---- Cloudflare R2 备份区域 ---- */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">☁️</span>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800">Cloudflare R2 云备份</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          直接备份到 Cloudflare R2 对象存储，安全可靠
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={fetchR2Backups}
                      disabled={r2Loading}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {r2Loading ? "加载中..." : "🔄 刷新"}
                    </button>
                  </div>

                  {!r2Configured ? (
                    <div className="px-4 py-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                      <p className="text-sm text-yellow-700 mb-2">⚠️ R2 未配置</p>
                      <p className="text-xs text-yellow-600">
                        请在环境变量中设置 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* R2 备份按钮 */}
                      <button
                        onClick={handleR2Backup}
                        disabled={r2BackingUp}
                        className="w-full px-4 py-3 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-4"
                      >
                        {r2BackingUp ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            正在上传到 R2...
                          </>
                        ) : (
                          <>
                            ☁️ 备份到 Cloudflare R2
                          </>
                        )}
                      </button>

                      {/* R2 备份列表 */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-600 mb-2">
                          📦 R2 中的备份文件 ({r2Backups.length})
                        </h4>
                        {r2Loading ? (
                          <div className="flex items-center justify-center py-6">
                            <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                          </div>
                        ) : r2Backups.length === 0 ? (
                          <p className="text-center py-6 text-gray-400 text-sm">
                            R2 中暂无备份文件
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {r2Backups.map((backup) => (
                              <div
                                key={backup.key}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-mono text-gray-700 truncate">
                                    {backup.key}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                    <span>{formatBytes(backup.size)}</span>
                                    {backup.lastModified && (
                                      <span>
                                        {new Date(backup.lastModified).toLocaleString("zh-CN")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {r2DeleteKey === backup.key ? (
                                  <div className="flex items-center gap-2 ml-2">
                                    <button
                                      onClick={() => handleR2Delete(backup.key)}
                                      className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                                    >
                                      确认
                                    </button>
                                    <button
                                      onClick={() => setR2DeleteKey(null)}
                                      className="px-2 py-1 text-xs text-gray-500 border border-gray-300 rounded hover:bg-gray-50"
                                    >
                                      取消
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setR2DeleteKey(backup.key)}
                                    className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 ml-2"
                                  >
                                    删除
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
                        <p className="mb-1">☁️ R2 备份说明：</p>
                        <p>• 备份直接上传到 Cloudflare R2 对象存储</p>
                        <p>• 备份文件保存在 backups/ 目录下，按时间命名</p>
                        <p>• R2 免费版提供 10GB 存储空间和免出口流量</p>
                      </div>
                    </>
                  )}
                </div>

                {/* ---- 恢复区域 ---- */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">📥</span>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">数据恢复</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        上传备份文件，恢复数据到数据库
                      </p>
                    </div>
                  </div>

                  {/* 文件上传 */}
                  <div className="mb-4">
                    <label
                      className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file) handleFileSelect(file);
                      }}
                    >
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                      />
                      {restoreFile ? (
                        <div>
                          <p className="text-2xl mb-2">📄</p>
                          <p className="text-sm font-medium text-gray-700">
                            {restoreFile.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatBytes(restoreFile.size)}
                          </p>
                          <p className="text-xs text-blue-600 mt-2">点击更换文件</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-3xl mb-2">📁</p>
                          <p className="text-sm text-gray-500">
                            点击选择或拖拽 JSON 备份文件到此处
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            仅支持本系统导出的 .json 备份文件
                          </p>
                        </div>
                      )}
                    </label>
                  </div>

                  {/* 恢复预览 */}
                  {restorePreview && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-600 mb-3">
                        🔍 备份文件预览
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div>
                          <div className="text-xs text-gray-400">备份版本</div>
                          <div className="text-sm font-medium text-gray-700">
                            {restorePreview.version}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">导出时间</div>
                          <div className="text-sm font-medium text-gray-700">
                            {restorePreview.exportedAt !== "未知"
                              ? new Date(restorePreview.exportedAt).toLocaleString("zh-CN")
                              : "未知"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">导出人</div>
                          <div className="text-sm font-medium text-gray-700">
                            {restorePreview.exportedBy}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">总记录数</div>
                          <div className="text-sm font-bold text-blue-600">
                            {formatNumber(restorePreview.totalRecords)}
                          </div>
                        </div>
                      </div>

                      {/* 表数据预览 */}
                      <div className="max-h-40 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-1.5 px-2 text-gray-500">表名</th>
                              <th className="text-right py-1.5 px-2 text-gray-500">记录数</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {restorePreview.tables.map((t) => (
                              <tr key={t.table}>
                                <td className="py-1.5 px-2 font-mono text-gray-600">
                                  {t.table}
                                </td>
                                <td className="py-1.5 px-2 text-right text-gray-700">
                                  {formatNumber(t.count)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 恢复模式选择 */}
                  {restorePreview && (
                    <div className="mb-4">
                      <label className="text-xs font-medium text-gray-500 block mb-2">
                        恢复模式
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label
                          className={`flex items-start gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                            restoreMode === "replace"
                              ? "border-red-300 bg-red-50/50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="restoreMode"
                            value="replace"
                            checked={restoreMode === "replace"}
                            onChange={() => setRestoreMode("replace")}
                            className="mt-0.5 text-red-600 focus:ring-red-500"
                          />
                          <div>
                            <div className="text-xs font-medium text-gray-700">
                              覆盖恢复
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              先删除现有数据再导入，完全替换
                            </div>
                          </div>
                        </label>
                        <label
                          className={`flex items-start gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                            restoreMode === "merge"
                              ? "border-blue-300 bg-blue-50/50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="restoreMode"
                            value="merge"
                            checked={restoreMode === "merge"}
                            onChange={() => setRestoreMode("merge")}
                            className="mt-0.5 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <div className="text-xs font-medium text-gray-700">
                              合并恢复
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              跳过已存在的记录，仅添加新数据
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* 恢复结果 */}
                  {restoreResult && (
                    <div
                      className={`mb-4 p-4 rounded-lg border ${
                        restoreResult.summary.hasError
                          ? "bg-yellow-50 border-yellow-200"
                          : "bg-green-50 border-green-200"
                      }`}
                    >
                      <h4 className="text-xs font-semibold text-gray-600 mb-2">
                        {restoreResult.summary.hasError ? "⚠️ " : "✅ "}
                        恢复结果
                      </h4>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div>
                          <div className="text-xs text-gray-400">处理表数</div>
                          <div className="text-sm font-bold text-gray-700">
                            {restoreResult.summary.tablesProcessed}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">删除记录</div>
                          <div className="text-sm font-bold text-red-600">
                            {formatNumber(restoreResult.summary.totalDeleted)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">插入记录</div>
                          <div className="text-sm font-bold text-green-600">
                            {formatNumber(restoreResult.summary.totalInserted)}
                          </div>
                        </div>
                      </div>

                      {/* 详细结果 */}
                      {restoreResult.details.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                            查看详细结果（{restoreResult.details.length} 项）
                          </summary>
                          <div className="mt-2 max-h-40 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-1 px-2 text-gray-500">表</th>
                                  <th className="text-left py-1 px-2 text-gray-500">操作</th>
                                  <th className="text-right py-1 px-2 text-gray-500">数量</th>
                                  <th className="text-left py-1 px-2 text-gray-500">备注</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {restoreResult.details.map((d, i) => (
                                  <tr key={i}>
                                    <td className="py-1 px-2 font-mono text-gray-600">
                                      {d.table}
                                    </td>
                                    <td className="py-1 px-2 text-gray-500">{d.action}</td>
                                    <td className="py-1 px-2 text-right text-gray-700">
                                      {formatNumber(d.count)}
                                    </td>
                                    <td
                                      className={`py-1 px-2 ${
                                        d.error ? "text-red-500" : "text-gray-300"
                                      }`}
                                    >
                                      {d.error || "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      )}
                    </div>
                  )}

                  {/* 恢复按钮 */}
                  {restorePreview && !restoreResult && (
                    <>
                      {confirmRestore ? (
                        <div className="space-y-3">
                          {restoreMode === "replace" && (
                            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                              ⚠️ 覆盖模式将删除所有现有数据并用备份替换！此操作不可撤销！
                            </div>
                          )}
                          <div className="flex gap-3">
                            <button
                              onClick={handleRestore}
                              disabled={restoring}
                              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {restoring ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  正在恢复...
                                </>
                              ) : (
                                "确认恢复"
                              )}
                            </button>
                            <button
                              onClick={() => setConfirmRestore(false)}
                              disabled={restoring}
                              className="px-4 py-2.5 text-sm font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRestore(true)}
                          className="w-full px-4 py-3 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        >
                          📥 开始恢复
                        </button>
                      )}
                    </>
                  )}

                  {/* 重新恢复按钮 */}
                  {restoreResult && (
                    <button
                      onClick={() => {
                        setRestoreFile(null);
                        setRestorePreview(null);
                        setRestoreResult(null);
                        setConfirmRestore(false);
                      }}
                      className="w-full px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      恢复其他文件
                    </button>
                  )}

                  {/* 恢复注意事项 */}
                  <div className="mt-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                    <p className="mb-1">⚠️ 恢复注意事项：</p>
                    <p>• 覆盖模式会删除现有数据，请确保备份文件正确</p>
                    <p>• 恢复前建议先下载当前数据备份</p>
                    <p>• 大数据量恢复可能需要较长时间（最长30秒）</p>
                    <p>• 恢复过程中请勿关闭页面</p>
                  </div>
                </div>
              </div>
            )}

            {/* ===== 外部数据库 Tab ===== */}
            {activeTab === "external" && <ExternalDatabaseManager />}
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
