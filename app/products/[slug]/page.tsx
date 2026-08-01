'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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
  downloadUrl: string | null;
  validDays: number;
  createdAt: string;
  latestVersion: Omit<ProductVersion, 'isLatest' | 'isPublished'> | null;
  versions: ProductVersion[];
}

interface SponsorSettings {
  sponsor_wechat_qr: string;
  sponsor_alipay_qr: string;
  sponsor_text: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const { user, token, hydrate, _hydrated } = useAppStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [sponsor, setSponsor] = useState<SponsorSettings>({
    sponsor_wechat_qr: '',
    sponsor_alipay_qr: '',
    sponsor_text: '如果我们的项目对您有帮助，欢迎赞助支持 ❤️',
  });

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

  // ============ 获取赞助设置 ============
  useEffect(() => {
    async function fetchSponsor() {
      try {
        const res = await fetch('/api/settings/sponsor');
        if (res.ok) {
          const data = await res.json();
          setSponsor(data);
        }
      } catch {
        // 静默失败
      }
    }
    fetchSponsor();
  }, []);

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
  const hasWechat = !!sponsor.sponsor_wechat_qr;
  const hasAlipay = !!sponsor.sponsor_alipay_qr;
  const hasSponsor = hasWechat || hasAlipay;

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
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <h1 className="text-3xl font-bold text-gray-900">
                  {product.name}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium text-green-700 bg-green-50 rounded-full">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  免费开源
                </span>
              </div>
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

        {/* ============ 免费授权 & 下载 ============ */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 mb-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center justify-center">
              <span className="mr-2">🎁</span>
              免费获取
            </h2>
            <p className="text-sm text-gray-500">
              本项目完全免费开源，支持免费授权和免费下载
            </p>
          </div>

          {/* 免费按钮 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            {/* 免费授权 */}
            <Link
              href={isLoggedIn ? '/profile/licenses' : `/login?redirect=/products/${product.slug}`}
              className="inline-flex items-center px-8 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors w-full sm:w-auto justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5l-7 7 7 7M5 5l-7 7 7 7" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              免费授权
            </Link>

            {/* 免费下载 */}
            {product.downloadUrl ? (
              <a
                href={product.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-8 py-3 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors w-full sm:w-auto justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                免费下载
              </a>
            ) : product.latestVersion?.downloadUrl ? (
              <a
                href={product.latestVersion.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-8 py-3 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors w-full sm:w-auto justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                免费下载 v{product.latestVersion.version}
              </a>
            ) : (
              <span className="inline-flex items-center px-8 py-3 bg-gray-100 text-gray-400 text-sm font-medium rounded-xl w-full sm:w-auto justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                下载链接即将开放
              </span>
            )}
          </div>

          {/* 赞助二维码区域 */}
          {hasSponsor && (
            <div className="border-t border-gray-100 pt-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500">❤️</span>
                  赞助支持
                </div>
                <p className="text-xs text-gray-400">
                  {sponsor.sponsor_text}
                </p>
              </div>

              <div className="flex flex-wrap items-start justify-center gap-8">
                {/* 微信赞助 */}
                {hasWechat && (
                  <div className="text-center">
                    <div className="inline-block p-3 bg-gray-50 rounded-xl mb-2">
                      <img
                        src={sponsor.sponsor_wechat_qr}
                        alt="微信赞助二维码"
                        className="w-36 h-36 rounded-lg object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-1.5 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.616-6.546 1.23-1.31 2.965-2.128 4.882-2.128.211 0 .42.014.627.028C16.389 5.028 12.81 2.188 8.691 2.188zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18z" />
                      </svg>
                      微信赞助
                    </div>
                  </div>
                )}

                {/* 支付宝赞助 */}
                {hasAlipay && (
                  <div className="text-center">
                    <div className="inline-block p-3 bg-gray-50 rounded-xl mb-2">
                      <img
                        src={sponsor.sponsor_alipay_qr}
                        alt="支付宝赞助二维码"
                        className="w-36 h-36 rounded-lg object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-1.5 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M22.95 16.96c-.59.27-3.07 1.42-5.03 2.38-2.79 1.36-5.62 2.22-8.15 2.22-3.86 0-6.97-1.79-6.97-5.52 0-1.69.54-3.39 1.46-5.07C2.14 13.81.82 17.39.82 20.06c0 5.05 4.08 7.49 8.14 7.49 3.86 0 6.97-1.79 6.97-5.52 0-1.69-.54-3.39-1.46-5.07l8.48-4.37v5.37z" />
                      </svg>
                      支付宝赞助
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center mt-4">
                <Link
                  href="/sponsor"
                  className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                >
                  查看更多赞助方式 →
                </Link>
              </div>
            </div>
          )}
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
