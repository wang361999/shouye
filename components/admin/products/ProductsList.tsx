"use client";

import { type Product } from "./types";
import { STATUS_FILTER_OPTIONS } from "./types";
import { ProductCard } from "./ProductDetail";

// ============ 统计卡片组件 ============
function StatBox({
  label,
  value,
  icon,
  loading,
}: {
  label: string;
  value: number;
  icon: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {loading ? (
          <span className="inline-block w-8 h-6 bg-gray-100 rounded animate-pulse" />
        ) : (
          value
        )}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export function ProductsList({
  filteredProducts,
  loading,
  stats,
  keyword,
  statusFilter,
  onKeywordChange,
  onStatusFilterChange,
  onOpenCreate,
  onEdit,
  onDelete,
  onManageVersions,
}: {
  filteredProducts: Product[];
  loading: boolean;
  stats: { total: number; active: number; draft: number; retired: number };
  keyword: string;
  statusFilter: string;
  onKeywordChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
  onOpenCreate: () => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onManageVersions: (product: Product) => void;
}) {
  const hasFilter = keyword || statusFilter !== "all";

  return (
    <>
      {/* 统计概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="产品总数" value={stats.total} icon="📦" loading={loading} />
        <StatBox
          label="上架中"
          value={stats.active}
          icon="🟢"
          loading={loading}
        />
        <StatBox label="草稿" value={stats.draft} icon="📝" loading={loading} />
        <StatBox
          label="已下架"
          value={stats.retired}
          icon="🗃️"
          loading={loading}
        />
      </div>

      {/* 搜索筛选栏 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              placeholder="搜索产品名称、slug 或描述..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 产品列表 */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse"
            >
              <div className="flex gap-4">
                <div className="w-14 h-14 bg-gray-100 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-3">📦</div>
          <p className="text-gray-500 mb-1">
            {hasFilter ? "没有符合条件的产品" : "暂无产品"}
          </p>
          <p className="text-sm text-gray-400 mb-4">
            {hasFilter
              ? "尝试调整搜索或筛选条件"
              : "点击上方按钮创建第一个产品"}
          </p>
          {hasFilter ? (
            <button
              onClick={() => {
                onKeywordChange("");
                onStatusFilterChange("all");
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              清空筛选条件
            </button>
          ) : (
            <button
              onClick={onOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              新建产品
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={() => onEdit(product)}
              onDelete={() => onDelete(product)}
              onManageVersions={() => onManageVersions(product)}
            />
          ))}
        </div>
      )}

      {/* 底部总数 */}
      {!loading && filteredProducts.length > 0 && (
        <div className="text-sm text-gray-500">
          共 <span className="font-medium text-gray-700">{filteredProducts.length}</span>{" "}
          个产品
        </div>
      )}
    </>
  );
}
