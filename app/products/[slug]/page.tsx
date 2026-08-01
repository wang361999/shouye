'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Container } from '@/components/common/Container';
import { useAppStore } from '@/lib/store';
import { formatDate, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ============ 类型定义 ============
interface ProductVersion {
  id: string;
  version: string;
  title: string;
  changelog: string;
  downloadUrl: string;
  fileSize: string | null;
  isLatest: boolean;
  isPublished: boolean;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  icon: string | null;
  coverImage: string | null;
  features: string[];
  demoUrl: string | null;
  docsUrl: string | null;
  status: string;
  priceBasic: number;
  priceStandard: number;
  pricePremium: number;
  priceEnterprise: number;
  validDays: number;
  createdAt: string;
  latestVersion: Omit<ProductVersion, 'isLatest' | 'isPublished'> | null;
  versions: ProductVersion[];
}

/** 价格格式化：分 → 元 */
function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, hydrate, _hydrated } = useAppStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // ============ 客户端水合 ============
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // ============ 获取产品详情 ============
  const fetchProduct = useCallback(async () => {
    const slug = params?.slug as string;
    if (!slug) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${slug}`);
      if (!res.ok) {
        if (res.status === 404) {
          setProduct(null);
          return;
        }
        throw new Error('获取失败');
      }
      const data = await res.json();
      setProduct(data);
    } catch {
      toast.error('获取产品详情失败');
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  // ============ 立即购买 ============
  async function handlePurchase() {
    if (!product) return;

    // 未登录：跳转登录页并带 redirect 参数
    if (!_hydrated || !user || !token) {
      router.push(`/login?redirect=/products/${product.slug}`);
      return;
    }

    setPurchasing('buy');
    try {
      const res = await fetch('/api/user/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: product.id,
          projectType: 'standard',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '创建订单失败');
        return;
      }
      toast.success('订单已创建，请前往支付');
      router.push('/profile/orders');
    } catch {
      toast.error('创建订单失败，请稍后重试');
    } finally {
      setPurchasing(null);
    }
  }

  // ============ 渲染：加载中 ============
  if (loading) {
    return (
      <Container className="py-16 text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-500">加载中...</p>
      </Container>
    );
  }

  // ============ 渲染：产品不存在 ============
  if (!product) {
    return (
      <Container className="py-16 text-center">
        <div className="max-w-sm mx-auto bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-5xl mb-4">📦</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            产品不存在
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            该产品可能已下架或链接错误
          </p>
          <Link
            href="/products"
            className="inline-block px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回产品列表
          </Link>
        </div>
      </Container>
    );
  }

  const isLoggedIn = _hydrated && !!user && !!token;

  return (
    <div className="bg-gray-50 min-h-screen">
      <Container className="py-8">
        {/* ============ 面包屑导航 ============ */}
        <nav className="flex items-center text-sm text-gray-500 mb-6">
          <Link href="/products" className="hover:text-blue-600 transition-colors">
            产品中心
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{product.name}</span>
        </nav>

        {/* ============ Hero 区域 ============ */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:gap-8">
            {/* 图标 */}
            <div className="text-6xl mb-4 md:mb-0 md:flex-shrink-0">
              {product.icon || '📦'}
            </div>

            {/* 标题信息 */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                {product.name}
              </h1>
              <p className="text-lg text-gray-500 mb-6 leading-relaxed">
                {product.tagline}
              </p>

              {/* 链接按钮 */}
              <div className="flex flex-wrap gap-3">
                {product.demoUrl && (
                  <a
                    href={product.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    在线演示
                  </a>
                )}
                {product.docsUrl && (
                  <a
                    href={product.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    查看文档
                  </a>
                )}
                {product.latestVersion && (
                  <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg">
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    最新版本 {product.latestVersion.version}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============ 功能特性 ============ */}
        {product.features.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-200 p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <span className="mr-2">✨</span>
              功能特性
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {product.features.map((feature, idx) => (
                <div
                  key={idx}
                  className="flex items-start p-4 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <svg
                    className="w-5 h-5 mt-0.5 mr-3 flex-shrink-0 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-sm text-gray-700 leading-relaxed">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ============ 获取授权 ============ */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 mb-8">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center justify-center">
              <span className="mr-2">💎</span>
              获取授权
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              授权有效期 {product.validDays} 天，支付后需管理员审核通过生成授权码
            </p>

            <div className="inline-block">
              <div className="text-4xl font-bold text-gray-900 mb-1">
                ¥{formatPrice(product.priceStandard)}
              </div>
              <p className="text-xs text-gray-400 mb-6">一次性付费 · 永久使用</p>

              <button
                onClick={() => handlePurchase()}
                disabled={purchasing === 'buy'}
                className="w-full px-8 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {purchasing === 'buy' ? '处理中...' : isLoggedIn ? '立即购买' : '登录后购买'}
              </button>
            </div>

            {/* 赞助入口 */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                如果这个项目对你有帮助，欢迎
                <Link href="/sponsor" className="text-blue-600 hover:text-blue-800 font-medium ml-1">
                  赞助支持
                </Link>
                <span className="ml-1">❤️</span>
              </p>
            </div>
          </div>
        </section>

        {/* ============ 版本历史 ============ */}
        {product.versions.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-200 p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <span className="mr-2">📜</span>
              版本历史
            </h2>
            <div className="space-y-4">
              {product.versions.map((version, idx) => (
                <div
                  key={version.id}
                  className={cn(
                    'relative pl-8 pb-6 border-l-2',
                    idx === product.versions.length - 1
                      ? 'border-transparent'
                      : 'border-gray-200',
                  )}
                >
                  {/* 时间轴节点 */}
                  <div
                    className={cn(
                      'absolute -left-2 top-0 w-4 h-4 rounded-full border-2 border-white',
                      version.isLatest ? 'bg-blue-600' : 'bg-gray-300',
                    )}
                  />

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-gray-900">
                        {version.version}
                      </span>
                      {version.isLatest && (
                        <span className="px-2 py-0.5 text-xs font-medium text-white bg-blue-600 rounded-full">
                          最新
                        </span>
                      )}
                      {version.title && (
                        <span className="text-sm text-gray-500">
                          {version.title}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {formatDate(version.createdAt)}
                      </span>
                    </div>

                    {version.changelog && (
                      <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {version.changelog}
                      </div>
                    )}

                    {version.fileSize && (
                      <p className="text-xs text-gray-400 mt-2">
                        文件大小：{version.fileSize}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ============ 底部操作 ============ */}
        <div className="text-center">
          <Link
            href="/products"
            className="inline-flex items-center text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回产品列表
          </Link>
        </div>
      </Container>
    </div>
  );
}
