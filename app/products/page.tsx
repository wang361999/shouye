'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Container } from '@/components/common/Container';

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
    <Container className="py-12">
      {/* ============ 页头标题 ============ */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-50 text-green-700 text-sm font-medium rounded-full mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          全部免费开源
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          🛍️ 产品中心
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          精选优质开源项目，免费授权、免费下载，欢迎赞助支持持续开发
        </p>
      </div>

      {/* ============ 加载中 ============ */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"
            >
              <div className="w-14 h-14 bg-gray-200 rounded-xl mb-4" />
              <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-full mb-2" />
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-6" />
              <div className="h-9 bg-gray-100 rounded" />
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
              className="group block bg-white rounded-xl border border-gray-200 p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-blue-200"
            >
              {/* 图标 */}
              <div className="text-4xl mb-4">
                {product.icon || '📦'}
              </div>

              {/* 免费标签 */}
              <span className="inline-block px-2.5 py-0.5 text-xs font-medium text-green-700 bg-green-50 rounded-full mb-3">
                免费开源
              </span>

              {/* 产品名称 */}
              <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {product.name}
              </h3>

              {/* 一句话描述 */}
              <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed">
                {product.tagline}
              </p>

              {/* 功能特性（最多显示3条） */}
              {product.features.length > 0 && (
                <ul className="space-y-1.5 mb-4">
                  {product.features.slice(0, 3).map((feature, idx) => (
                    <li
                      key={idx}
                      className="flex items-start text-xs text-gray-500"
                    >
                      <svg
                        className="w-3.5 h-3.5 mt-0.5 mr-1.5 flex-shrink-0 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="line-clamp-1">{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* 查看详情按钮 */}
              <div className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                查看详情
                <svg
                  className="w-4 h-4 ml-1.5"
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
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ============ 空状态 ============ */}
      {!loading && products.length === 0 && (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            暂无产品
          </h3>
          <p className="text-sm text-gray-400">
            目前还没有上架的产品，请稍后再来
          </p>
        </div>
      )}
    </Container>
  );
}
