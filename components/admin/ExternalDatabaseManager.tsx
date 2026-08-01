"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

// ============ 类型定义 ============
interface ExternalDB {
  id: string;
  name: string;
  description: string | null;
  dbType: string;
  host: string;
  port: number;
  database: string;
  username: string;
  sslMode: string;
  status: string;
  lastCheckedAt: string | null;
  lastCheckOk: boolean | null;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DbOverview {
  dbSize: number;
  tableCount: number;
  tables: Array<{ name: string; schema: string; sizeBytes: number; rowCount: number }>;
  serverVersion: string;
}

interface TableStructure {
  columns: Array<{ name: string; type: string; nullable: boolean; default: string | null; isPrimaryKey: boolean }>;
  rowCount: number;
  sizeBytes: number;
}

interface TableData {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

interface TableList {
  tables: Array<{ name: string; schema: string; type: string }>;
}

// ============ 主组件 ============
export default function ExternalDatabaseManager() {
  const { token } = useAppStore();
  const [dbs, setDbs] = useState<ExternalDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDb, setEditingDb] = useState<ExternalDB | null>(null);
  const [selectedDb, setSelectedDb] = useState<ExternalDB | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // 获取列表
  const fetchDbs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/database/external", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setDbs(json.databases || []);
      }
    } catch {
      toast.error("获取外部数据库列表失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDbs();
  }, [fetchDbs]);

  // 格式化
  function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  function formatNumber(n: number): string {
    return n.toLocaleString();
  }

  // 删除
  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/database/external/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success("已删除");
        fetchDbs();
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch {
      toast.error("网络错误");
    }
    setConfirmDelete(null);
  };

  // ===== 如果选中了某个数据库，显示详情视图 =====
  if (selectedDb) {
    return (
      <DatabaseDetailView
        db={selectedDb}
        token={token!}
        formatBytes={formatBytes}
        formatNumber={formatNumber}
        onBack={() => {
          setSelectedDb(null);
          fetchDbs();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            🔗 外部数据库管理
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            添加和管理额外的数据库连接
          </p>
        </div>
        <button
          onClick={() => {
            setEditingDb(null);
            setShowForm(true);
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          ➕ 添加数据库
        </button>
      </div>

      {/* 数据库列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="inline-block w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : dbs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">🗄️</p>
          <p className="text-sm text-gray-400 mb-4">
            还没有添加外部数据库
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            添加第一个数据库
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {dbs.map((db) => (
            <div
              key={db.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    db.status === 'active' ? 'bg-green-500' : db.status === 'disabled' ? 'bg-gray-400' : 'bg-red-500'
                  }`} />
                  <h3 className="text-sm font-semibold text-gray-800">
                    {db.name}
                  </h3>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  db.status === 'active' ? 'bg-green-50 text-green-700' :
                  db.status === 'disabled' ? 'bg-gray-100 text-gray-500' :
                  'bg-red-50 text-red-700'
                }`}>
                  {db.status === 'active' ? '正常' : db.status === 'disabled' ? '已禁用' : '错误'}
                </span>
              </div>

              {db.description && (
                <p className="text-xs text-gray-400 mb-3">{db.description}</p>
              )}

              <div className="space-y-1 text-xs text-gray-600 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-12">地址</span>
                  <span className="font-mono">{db.host}:{db.port}/{db.database}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-12">用户</span>
                  <span className="font-mono">{db.username}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-12">类型</span>
                  <span>{db.dbType === 'postgresql' ? 'PostgreSQL' : db.dbType}</span>
                </div>
                {db.lastCheckedAt && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-12">检测</span>
                    <span className={db.lastCheckOk ? 'text-green-600' : 'text-red-600'}>
                      {db.lastCheckOk ? '✓' : '✗'} {new Date(db.lastCheckedAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDb(db)}
                  disabled={db.status === 'disabled'}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  查看详情
                </button>
                <button
                  onClick={() => {
                    setEditingDb(db);
                    setShowForm(true);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  编辑
                </button>
                {confirmDelete === db.id ? (
                  <button
                    onClick={() => handleDelete(db.id)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    确认删除
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(db.id)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加/编辑表单 */}
      {showForm && (
        <DatabaseForm
          editingDb={editingDb}
          token={token!}
          onClose={() => {
            setShowForm(false);
            setEditingDb(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditingDb(null);
            fetchDbs();
          }}
        />
      )}
    </div>
  );
}

// ============ 数据库详情视图 ============
function DatabaseDetailView({
  db,
  token,
  formatBytes,
  formatNumber,
  onBack,
}: {
  db: ExternalDB;
  token: string;
  formatBytes: (b: number) => string;
  formatNumber: (n: number) => string;
  onBack: () => void;
}) {
  const [overview, setOverview] = useState<DbOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"tables" | "query">("tables");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [tableStructure, setTableStructure] = useState<TableStructure | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [orderBy, setOrderBy] = useState<string | null>(null);
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("asc");

  // SQL 查询
  const [sql, setSql] = useState("SELECT * FROM ");
  const [queryResult, setQueryResult] = useState<{ rows: Record<string, unknown>[]; rowCount: number; fields: string[]; duration: number } | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  // 获取概览
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/database/external/${db.id}?overview=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.overview) {
        setOverview(json.overview);
      } else {
        setError(json.error || '连接失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, [db.id, token]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // 获取表数据
  const fetchTableData = useCallback(async (tableName: string, p: number) => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams({
        table: tableName,
        page: String(p),
        pageSize: String(pageSize),
      });
      if (orderBy) {
        params.set('orderBy', orderBy);
        params.set('orderDir', orderDir);
      }
      const res = await fetch(`/api/admin/database/external/${db.id}/tables?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.structure) {
        setTableStructure(json.structure);
        setTableData(json.data);
      }
    } catch {
      toast.error("获取表数据失败");
    } finally {
      setTableLoading(false);
    }
  }, [db.id, token, pageSize, orderBy, orderDir]);

  // 点击表
  const handleTableClick = (tableName: string) => {
    setSelectedTable(tableName);
    setPage(1);
    setOrderBy(null);
    fetchTableData(tableName, 1);
  };

  // 排序
  const handleSort = (col: string) => {
    const newDir = orderBy === col && orderDir === 'asc' ? 'desc' : 'asc';
    setOrderBy(col);
    setOrderDir(newDir);
    if (selectedTable) {
      const params = new URLSearchParams({
        table: selectedTable,
        page: String(page),
        pageSize: String(pageSize),
        orderBy: col,
        orderDir: newDir,
      });
      setTableLoading(true);
      fetch(`/api/admin/database/external/${db.id}/tables?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((json) => {
          if (json.structure) {
            setTableStructure(json.structure);
            setTableData(json.data);
          }
        })
        .catch(() => toast.error("获取数据失败"))
        .finally(() => setTableLoading(false));
    }
  };

  // 执行 SQL
  const handleExecuteQuery = async () => {
    if (!sql.trim()) return;
    setQueryLoading(true);
    setQueryResult(null);
    try {
      const res = await fetch(`/api/admin/database/external/${db.id}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sql, limit: 100 }),
      });
      const json = await res.json();
      if (res.ok) {
        setQueryResult(json);
        if (json.rowCount > 0) {
          toast.success(`查询成功，返回 ${json.rowCount} 行（${json.duration}ms）`);
        } else {
          toast.success(`查询成功（${json.duration}ms）`);
        }
      } else {
        toast.error(json.error || "查询失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setQueryLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← 返回列表
        </button>
        <button
          onClick={fetchOverview}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          刷新
        </button>
      </div>

      {/* 数据库信息 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className={`w-3 h-3 rounded-full ${
            db.status === 'active' ? 'bg-green-500' : db.status === 'disabled' ? 'bg-gray-400' : 'bg-red-500'
          }`} />
          <h2 className="text-lg font-bold text-gray-900">{db.name}</h2>
          <span className="text-xs text-gray-400">
            {db.host}:{db.port}/{db.database}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="inline-block w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <span className="ml-2 text-sm text-gray-400">正在连接...</span>
          </div>
        ) : error ? (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            ⚠️ {error}
          </div>
        ) : overview ? (
          <>
            {/* 概览卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">数据库大小</div>
                <div className="text-lg font-bold text-gray-800">
                  {formatBytes(overview.dbSize)}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">数据表数</div>
                <div className="text-lg font-bold text-gray-800">
                  {overview.tableCount}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">类型</div>
                <div className="text-sm font-bold text-gray-800">
                  {db.dbType === 'postgresql' ? 'PostgreSQL' : db.dbType}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">服务器版本</div>
                <div className="text-xs font-medium text-gray-700 truncate" title={overview.serverVersion}>
                  {overview.serverVersion.split(' ').slice(0, 2).join(' ')}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* 视图切换 */}
      {overview && (
        <>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            <button
              onClick={() => setActiveView("tables")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeView === "tables" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              📋 数据表浏览
            </button>
            <button
              onClick={() => setActiveView("query")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeView === "query" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              🔍 SQL 查询
            </button>
          </div>

          {/* 数据表浏览 */}
          {activeView === "tables" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 表列表 */}
              <div className="lg:col-span-1">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">数据表</h3>
                <div className="bg-white rounded-xl border border-gray-200 max-h-96 overflow-y-auto">
                  {overview.tables.length === 0 ? (
                    <p className="text-center py-8 text-gray-400 text-sm">没有数据表</p>
                  ) : (
                    overview.tables.map((t) => (
                      <button
                        key={t.name}
                        onClick={() => handleTableClick(t.name)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                          selectedTable === t.name ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span className="text-sm font-medium text-gray-700 truncate">
                          {t.name}
                        </span>
                        <div className="flex flex-col items-end text-xs">
                          <span className="text-gray-400">{formatBytes(t.sizeBytes)}</span>
                          <span className="text-gray-300">~{formatNumber(t.rowCount)}行</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* 表详情 */}
              <div className="lg:col-span-2">
                {selectedTable && tableStructure ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    {/* 表信息 */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-gray-800">
                          📋 {selectedTable}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatNumber(tableStructure.rowCount)} 行 · {formatBytes(tableStructure.sizeBytes)}
                        </p>
                      </div>
                      {tableData && (
                        <span className="text-xs text-gray-400">
                          第 {tableData.page} / {Math.ceil(tableData.total / tableData.pageSize)} 页
                        </span>
                      )}
                    </div>

                    {/* 列信息 */}
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-gray-500 mb-2">字段结构</h4>
                      <div className="flex flex-wrap gap-2">
                        {tableStructure.columns.map((col) => (
                          <span
                            key={col.name}
                            className={`text-xs px-2 py-1 rounded border ${
                              col.isPrimaryKey
                                ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
                                : 'border-gray-200 bg-gray-50 text-gray-600'
                            }`}
                          >
                            {col.isPrimaryKey && '🔑 '}{col.name}
                            <span className="text-gray-400 ml-1">:{col.type}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 数据表格 */}
                    {tableLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="inline-block w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                      </div>
                    ) : tableData && tableData.rows.length > 0 ? (
                      <>
                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                {tableStructure.columns.map((col) => (
                                  <th
                                    key={col.name}
                                    onClick={() => handleSort(col.name)}
                                    className="text-left px-3 py-2 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                  >
                                    {col.name}
                                    {orderBy === col.name && (
                                      <span className="ml-1">{orderDir === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {tableData.rows.map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                  {tableStructure.columns.map((col) => (
                                    <td key={col.name} className="px-3 py-2 text-gray-600 max-w-xs truncate" title={String(row[col.name] ?? '')}>
                                      {row[col.name] === null ? (
                                        <span className="text-gray-300 italic">NULL</span>
                                      ) : typeof row[col.name] === 'object' ? (
                                        <span className="text-purple-600">{JSON.stringify(row[col.name]).substring(0, 50)}</span>
                                      ) : (
                                        String(row[col.name])
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* 分页 */}
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-gray-400">
                            共 {formatNumber(tableData.total)} 条
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const p = Math.max(1, page - 1);
                                setPage(p);
                                fetchTableData(selectedTable, p);
                              }}
                              disabled={page === 1}
                              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
                            >
                              上一页
                            </button>
                            <span className="px-3 py-1 text-xs text-gray-500">
                              {page} / {Math.ceil(tableData.total / tableData.pageSize)}
                            </span>
                            <button
                              onClick={() => {
                                const p = page + 1;
                                setPage(p);
                                fetchTableData(selectedTable, p);
                              }}
                              disabled={page >= Math.ceil(tableData.total / tableData.pageSize)}
                              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
                            >
                              下一页
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-center py-8 text-gray-400 text-sm">该表没有数据</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <p className="text-3xl mb-2">👈</p>
                    <p className="text-sm text-gray-400">点击左侧数据表查看结构和数据</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SQL 查询 */}
          {activeView === "query" && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">🔍 执行 SQL 查询</h3>

              {/* SQL 编辑器 */}
              <textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                placeholder="输入 SQL 语句，如 SELECT * FROM users LIMIT 10"
                className="w-full h-32 px-4 py-3 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-y"
                spellCheck={false}
              />

              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSql("SELECT * FROM ")}
                    className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    SELECT
                  </button>
                  <button
                    onClick={() => setSql("SELECT table_name, table_schema FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_name")}
                    className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    查看所有表
                  </button>
                  <button
                    onClick={() => setSql("SELECT pg_database_size(current_database()) as db_size")}
                    className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    数据库大小
                  </button>
                </div>
                <button
                  onClick={handleExecuteQuery}
                  disabled={queryLoading || !sql.trim()}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {queryLoading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      执行中...
                    </>
                  ) : (
                    "▶ 执行查询"
                  )}
                </button>
              </div>

              {/* 查询结果 */}
              {queryResult && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">
                      返回 {queryResult.rowCount} 行 · 耗时 {queryResult.duration}ms
                    </span>
                  </div>
                  {queryResult.rows.length > 0 ? (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-96">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            {queryResult.fields.map((f) => (
                              <th key={f} className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
                                {f}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {queryResult.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              {queryResult.fields.map((f) => (
                                <td key={f} className="px-3 py-2 text-gray-600 max-w-xs truncate" title={String(row[f] ?? '')}>
                                  {row[f] === null ? (
                                    <span className="text-gray-300 italic">NULL</span>
                                  ) : typeof row[f] === 'object' ? (
                                    <span className="text-purple-600">{JSON.stringify(row[f]).substring(0, 50)}</span>
                                  ) : (
                                    String(row[f])
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center py-8 text-gray-400 text-sm">没有返回数据</p>
                  )}
                </div>
              )}

              {/* 安全提示 */}
              <div className="mt-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                <p className="mb-1">⚠️ 注意：</p>
                <p>• 仅支持 SELECT 查询，DROP/TRUNCATE 操作被禁止</p>
                <p>• 查询结果最多返回 100 行</p>
                <p>• 所有 SQL 执行操作会被记录到操作日志</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============ 添加/编辑数据库表单 ============
function DatabaseForm({
  editingDb,
  token,
  onClose,
  onSaved,
}: {
  editingDb: ExternalDB | null;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editingDb?.name || "");
  const [description, setDescription] = useState(editingDb?.description || "");
  const [host, setHost] = useState(editingDb?.host || "");
  const [port, setPort] = useState(editingDb?.port || 5432);
  const [database, setDatabase] = useState(editingDb?.database || "");
  const [username, setUsername] = useState(editingDb?.username || "");
  const [password, setPassword] = useState("");
  const [sslMode, setSslMode] = useState(editingDb?.sslMode || "prefer");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleTest = async () => {
    if (!host || !database || !username || (!password && !editingDb)) {
      toast.error("请填写所有必填字段");
      return;
    }

    setTesting(true);
    try {
      const res = await fetch("/api/admin/database/external", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "test",
          host,
          port: Number(port),
          database,
          username,
          password: password || "test-placeholder",
          sslMode,
        }),
      });
      const result = await res.json();
      if (result.ok) {
        toast.success(`连接成功！服务器: ${result.serverVersion?.substring(0, 30)}`);
      } else {
        toast.error(`连接失败: ${result.message}`);
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name || !host || !database || !username) {
      toast.error("请填写所有必填字段");
      return;
    }

    setSaving(true);
    try {
      const url = editingDb
        ? `/api/admin/database/external/${editingDb.id}`
        : "/api/admin/database/external";
      const method = editingDb ? "PUT" : "POST";
      const body: Record<string, unknown> = {
        name,
        description,
        host,
        port: Number(port),
        database,
        username,
        sslMode,
      };
      if (password) body.password = password;

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(editingDb ? "更新成功" : "添加成功");
        onSaved();
      } else {
        toast.error(result.error || "保存失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-gray-900">
            {editingDb ? "✏️ 编辑数据库" : "➕ 添加外部数据库"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ✕
          </button>
        </div>

        {/* 表单 */}
        <div className="px-6 py-4 space-y-4">
          {/* 名称 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              数据库名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：用户数据库、日志数据库"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              描述
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* 主机和端口 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                主机地址 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="如：db.example.com 或 localhost"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                端口
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 font-mono"
              />
            </div>
          </div>

          {/* 数据库名 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              数据库名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              placeholder="如：myapp_db"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 font-mono"
            />
          </div>

          {/* 用户名和密码 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                用户名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                密码 {editingDb && <span className="text-gray-400">(留空不修改)</span>}
                {!editingDb && <span className="text-red-500">*</span>}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editingDb ? "••••••••" : "输入密码"}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 font-mono"
              />
            </div>
          </div>

          {/* SSL 模式 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              SSL 模式
            </label>
            <select
              value={sslMode}
              onChange={(e) => setSslMode(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            >
              <option value="prefer">prefer（推荐，优先使用SSL）</option>
              <option value="require">require（强制SSL）</option>
              <option value="disable">disable（不使用SSL）</option>
            </select>
          </div>

          {/* 提示 */}
          <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            <p>💡 建议先点击「测试连接」验证配置正确后再保存</p>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            {testing ? "测试中..." : "🔌 测试连接"}
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
