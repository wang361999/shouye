'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import GithubStarBadge from '@/components/products/GithubStarBadge';

// ============ 产品类型定义 ============
interface Product {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  icon: string;
  coverImage: string | null;
  features: string[];
  demoUrl: string | null;
  downloadUrl: string | null;
  validDays: number;
  sortOrder: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error('获取失败');
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen">
      <Container className="py-8 md:py-12">
        {/* ============ 页头 ============ */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-full border border-green-200">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              全部免费开源
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            开源项目
          </h1>
          <p className="text-[13px] sm:text-base text-gray-500 max-w-2xl leading-relaxed">
            精选优质开源项目，免费授权、免费下载，欢迎赞助支持持续开发
          </p>
        </div>

        {/* ============ 加载中 ============ */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                <div className="w-full h-40 bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-2/3" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-8 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ============ 产品网格 ============ */}
        {!loading && products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="group block bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-gray-300"
              >
                {/* 封面图 */}
                {product.coverImage ? (
                  <div className="relative w-full h-40 overflow-hidden bg-gray-100">
                    <img
                      src={product.coverImage}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-white/90 backdrop-blur-sm rounded-full shadow-sm">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      MIT
                    </span>
                  </div>
                ) : (
                  <div className="relative w-full h-40 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                    <div className="text-5xl">{product.icon || '📦'}</div>
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-white/90 backdrop-blur-sm rounded-full shadow-sm">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      MIT
                    </span>
                  </div>
                )}

                {/* 内容区 */}
                <div className="p-5">
                  {/* 标题行 + Star 徽章 */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-[15px] sm:text-base font-bold text-gray-900 group-hover:text-gray-700 transition-colors">
                      {product.name}
                    </h3>
                    <GithubStarBadge slug={product.slug} />
                  </div>

                  {/* 一句话描述 */}
                  <p className="text-[11px] sm:text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed">
                    {product.tagline}
                  </p>

                  {/* 功能特性 */}
                  {product.features.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {product.features.slice(0, 3).map((feature, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded"
                        >
                          {feature.length > 12 ? feature.substring(0, 12) + '...' : feature}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 底部 */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <a
                      href={`/api/download?repo=${encodeURIComponent(product.downloadUrl || 'https://github.com/wang361999/gengxin')}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                      免费下载 ZIP
                    </a>
                    <span className="inline-flex items-center text-xs font-medium text-gray-400 group-hover:text-gray-900 transition-colors">
                      查看详情
                      <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ============ 空状态 ============ */}
        {!loading && products.length === 0 && (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无开源项目</h3>
            <p className="text-[13px] sm:text-sm text-gray-400">目前还没有上架的开源项目，请稍后再来</p>
          </div>
        )}
      </Container>
    </div>
  );
}
