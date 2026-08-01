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
  techStack: string | null;
  screenshots: string | null;
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

interface AuthorizeStatus {
  status: 'none' | 'pending' | 'paid' | 'approved' | 'rejected' | 'cancelled' | 'refunded';
  order: {
    id: string;
    orderNo: string;
    amount: number;
    createdAt: string;
    remark: string | null;
  } | null;
  license: {
    id: string;
    licenseKey: string;
    expiresAt: string;
    status: string;
    maxDomains: number;
  } | null;
}

export default function ProductDetailPage() {
  const params = useParams();
  const { user, token, hydrate, _hydrated } = useAppStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [sponsor, setSponsor] = useState<SponsorSettings>({
    sponsor_wechat_qr: '',
    sponsor_alipay_qr: '',
    sponsor_text: '如果我们的项目对您有帮助，欢迎赞助支持',
  });

  // 授权状态
  const [authStatus, setAuthStatus] = useState<AuthorizeStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  // ============ 获取授权状态 ============
  const fetchAuthStatus = useCallback(async () => {
    if (!product || !token) return;
    setAuthLoading(true);
    try {
      const res = await fetch(
        `/api/user/authorize-status?productId=${product.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setAuthStatus(data);
      }
    } catch {
      // 静默失败
    } finally {
      setAuthLoading(false);
    }
  }, [product, token]);

  useEffect(() => {
    if (_hydrated && user && token && product) {
      fetchAuthStatus();
    }
  }, [_hydrated, user, token, product, fetchAuthStatus]);

  // ============ 提交免费授权申请 ============
  async function handleFreeAuthorize() {
    if (!product || !token) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/user/free-authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '授权申请失败');
        return;
      }
      toast.success(data.message || '免费授权申请已提交');
      // 刷新授权状态
      fetchAuthStatus();
    } catch {
      toast.error('授权申请失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  // ============ 复制到剪贴板 ============
  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('授权码已复制');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  }

  // ============ 渲染：加载中 ============
  if (loading) {
    return (
      <Container className="py-16 text-center">
        <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin mb-3" />
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
          <h2 className="text-xl font-bold text-gray-900 mb-2">产品不存在</h2>
          <p className="text-sm text-gray-500 mb-6">该产品可能已下架或链接错误</p>
          <Link
            href="/products"
            className="inline-block px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
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

  // 解析截图
  let screenshots: string[] = [];
  if (product.screenshots) {
    try {
      const parsed = JSON.parse(product.screenshots);
      if (Array.isArray(parsed)) {
        screenshots = parsed.filter((s: unknown) => typeof s === 'string' && (s as string).trim());
      }
    } catch {
      screenshots = [];
    }
  }

  // 解析技术栈
  let techStack: string[] = [];
  if (product.techStack) {
    try {
      const parsed = JSON.parse(product.techStack);
      if (Array.isArray(parsed)) {
        techStack = parsed.filter((t: unknown) => typeof t === 'string' && (t as string).trim());
      }
    } catch {
      techStack = [];
    }
  }

  // 授权状态映射
  const authStatusMap: Record<string, { label: string; color: string; icon: string }> = {
    none: { label: '未申请', color: 'text-gray-500', icon: '⏳' },
    pending: { label: '审核中', color: 'text-yellow-600', icon: '⏳' },
    paid: { label: '已支付', color: 'text-blue-600', icon: '💰' },
    approved: { label: '已授权', color: 'text-green-600', icon: '✅' },
    rejected: { label: '已拒绝', color: 'text-red-600', icon: '❌' },
    cancelled: { label: '已取消', color: 'text-gray-500', icon: '✖️' },
    refunded: { label: '已退款', color: 'text-gray-500', icon: '↩️' },
  };

  const currentAuth = authStatus ? authStatusMap[authStatus.status] || authStatusMap.none : authStatusMap.none;
  const hasLicense = authStatus?.license && authStatus.status === 'approved';

  return (
    <div className="bg-gray-50 min-h-screen">
      <Container className="py-6 md:py-8">
        {/* ============ 面包屑导航 ============ */}
        <nav className="flex items-center text-sm text-gray-500 mb-6">
          <Link href="/products" className="hover:text-gray-900 transition-colors">开源项目</Link>
          <span className="mx-2 text-gray-300">/</span>
          <span className="text-gray-900">{product.name}</span>
        </nav>

        {/* ============ Hero 区域 ============ */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          {/* 封面图 Banner */}
          {product.coverImage ? (
            <div className="relative w-full h-48 md:h-72 overflow-hidden bg-gray-100">
              <img
                src={product.coverImage}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium text-green-700 bg-white/90 backdrop-blur-sm rounded-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    MIT 开源
                  </span>
                  {product.latestVersion && (
                    <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium text-white bg-black/30 backdrop-blur-sm rounded-full">
                      {product.latestVersion.version}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">
                  {product.name}
                </h1>
                <p className="text-sm md:text-base text-white/80 mt-1 drop-shadow">{product.tagline}</p>
              </div>
            </div>
          ) : null}

          {/* 标题信息区 */}
          <div className={cn('p-6 md:p-8', product.coverImage && 'pt-0 md:pt-0')}>
            {!product.coverImage && (
              <div className="flex flex-col md:flex-row md:items-start md:gap-6 mb-6">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-4xl md:text-5xl mb-4 md:mb-0 md:flex-shrink-0 border border-gray-200">
                  {product.icon || '📦'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{product.name}</h1>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium text-green-700 bg-green-50 rounded-full">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      MIT 开源
                    </span>
                  </div>
                  <p className="text-base md:text-lg text-gray-500 leading-relaxed">{product.tagline}</p>
                </div>
              </div>
            )}

            {/* 技术栈标签 */}
            {techStack.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {techStack.map((tech, idx) => (
                  <span key={idx} className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md">
                    {tech}
                  </span>
                ))}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex flex-wrap items-center gap-3">
              {product.demoUrl && (
                <a href={product.demoUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  在线演示
                </a>
              )}
              {product.docsUrl && (
                <a href={product.docsUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
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

        {/* ============ 双栏布局 ============ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ============ 左侧主内容 ============ */}
          <div className="lg:col-span-2 space-y-6">
            {/* 产品介绍 */}
            {product.description && (
              <section className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  项目介绍
                </h2>
                <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{product.description}</div>
              </section>
            )}

            {/* 产品截图 */}
            {screenshots.length > 0 && (
              <section className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  项目截图
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {screenshots.map((src, idx) => (
                    <div key={idx} className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 group cursor-zoom-in">
                      <img src={src} alt={`${product.name} 截图 ${idx + 1}`}
                        className="w-full h-auto object-contain group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 功能特性 */}
            {product.features.length > 0 && (
              <section className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  功能特性
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {product.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <svg className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-700 leading-relaxed">{feature}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 版本历史 */}
            {product.versions.length > 0 && (
              <section className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  版本历史
                </h2>
                <div className="space-y-3">
                  {product.versions.map((version) => (
                    <div key={version.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-gray-900">{version.version}</span>
                        {version.isLatest && (
                          <span className="px-2 py-0.5 text-xs font-medium text-white bg-gray-900 rounded-full">最新</span>
                        )}
                        {version.title && <span className="text-sm text-gray-500">{version.title}</span>}
                        <span className="text-xs text-gray-400 ml-auto">{formatDate(version.createdAt)}</span>
                      </div>
                      {version.changelog && (
                        <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{version.changelog}</div>
                      )}
                      {version.fileSize && <p className="text-xs text-gray-400 mt-2">文件大小：{version.fileSize}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ============ 右侧侧边栏 ============ */}
          <div className="lg:col-span-1 space-y-6">
            {/* 免费授权卡片 */}
            <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden sticky top-6">
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <h2 className="text-lg font-bold">免费授权</h2>
                </div>
                <p className="text-sm text-gray-300">本项目完全免费开源，点击申请免费授权码</p>
              </div>

              <div className="p-6">
                {/* 未登录 */}
                {!isLoggedIn && (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 mb-4">请先登录后申请免费授权</p>
                    <Link href={`/login?redirect=/products/${product.slug}`}
                      className="inline-flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors">
                      登录
                    </Link>
                  </div>
                )}

                {/* 已登录 - 显示授权状态 */}
                {isLoggedIn && (
                  <>
                    {authLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                      </div>
                    ) : !authStatus || authStatus.status === 'none' ? (
                      /* 未申请授权 */
                      <div className="text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 mb-3">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5l-7 7 7 7M5 5l-7 7 7 7" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">您尚未申请该项目的授权</p>
                        <button onClick={handleFreeAuthorize} disabled={submitting}
                          className="inline-flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          {submitting ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                              提交中...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              申请免费授权
                            </>
                          )}
                        </button>
                      </div>
                    ) : authStatus.status === 'pending' ? (
                      /* 审核中 */
                      <div className="text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-50 mb-3">
                          <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-yellow-700 bg-yellow-50 rounded-full mb-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                          审核中
                        </div>
                        <p className="text-sm text-gray-600 mb-2">您的免费授权申请已提交</p>
                        <p className="text-xs text-gray-400 mb-4">管理员审核通过后将生成授权码</p>
                        {authStatus.order && (
                          <div className="bg-gray-50 rounded-lg p-3 text-left">
                            <div className="text-xs text-gray-400 mb-1">申请单号</div>
                            <div className="text-xs font-mono text-gray-600">{authStatus.order.orderNo}</div>
                          </div>
                        )}
                      </div>
                    ) : authStatus.status === 'approved' && authStatus.license ? (
                      /* 已授权 */
                      <div className="text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 mb-3">
                          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-full mb-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          已授权
                        </div>
                        <p className="text-sm text-gray-600 mb-3">恭喜！您已获得该项目的免费授权</p>

                        {/* 授权码 */}
                        <div className="bg-gray-50 rounded-lg p-3 mb-4">
                          <div className="text-xs text-gray-400 mb-1">授权码</div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded text-xs font-mono text-gray-600 break-all text-left">
                              {authStatus.license.licenseKey}
                            </code>
                            <button onClick={() => handleCopy(authStatus.license!.licenseKey)}
                              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                              title="复制授权码">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                          <div className="text-xs text-gray-400 mt-2">
                            到期时间：{formatDate(authStatus.license.expiresAt)}
                          </div>
                        </div>

                        <Link href="/profile/licenses"
                          className="inline-flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2V10M14 6h4a2 2 0 012 2v2M14 18h4a2 2 0 002-2v-2M10 18H6a2 2 0 01-2-2v-2" />
                          </svg>
                          管理授权码
                        </Link>
                      </div>
                    ) : authStatus.status === 'rejected' ? (
                      /* 已拒绝 */
                      <div className="text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-3">
                          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-full mb-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          已拒绝
                        </div>
                        <p className="text-sm text-gray-500 mb-4">您的授权申请未通过审核</p>
                        <button onClick={handleFreeAuthorize} disabled={submitting}
                          className="inline-flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          {submitting ? '提交中...' : '重新申请'}
                        </button>
                      </div>
                    ) : (
                      /* 其他状态（cancelled/refunded） */
                      <div className="text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 mb-3">
                          <span className="text-2xl">{currentAuth.icon}</span>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">{currentAuth.label}</p>
                        <button onClick={handleFreeAuthorize} disabled={submitting}
                          className="inline-flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          {submitting ? '提交中...' : '申请免费授权'}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* 免费下载按钮 - GitHub 仓库 */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <a
                    href={product.downloadUrl || 'https://github.com/wang361999/gengxin'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    免费下载 (GitHub)
                  </a>
                  <a
                    href="https://github.com/wang361999/gengxin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-full mt-2 px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    github.com/wang361999/gengxin
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2V10M14 6h4a2 2 0 012 2v2M14 18h4a2 2 0 002-2v-2M10 18H6a2 2 0 01-2-2v-2" />
                    </svg>
                  </a>
                </div>
              </div>
            </section>

            {/* 赞助二维码 */}
            {hasSponsor && (
              <section className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                    赞助支持
                  </div>
                  <p className="text-xs text-gray-400">{sponsor.sponsor_text}</p>
                </div>

                <div className="flex flex-wrap items-start justify-center gap-4">
                  {hasWechat && (
                    <div className="text-center">
                      <div className="inline-block p-2 bg-gray-50 rounded-xl mb-1.5">
                        <img src={sponsor.sponsor_wechat_qr} alt="微信赞助" className="w-28 h-28 rounded-lg object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <div className="text-xs text-gray-500">微信赞助</div>
                    </div>
                  )}
                  {hasAlipay && (
                    <div className="text-center">
                      <div className="inline-block p-2 bg-gray-50 rounded-xl mb-1.5">
                        <img src={sponsor.sponsor_alipay_qr} alt="支付宝赞助" className="w-28 h-28 rounded-lg object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <div className="text-xs text-gray-500">支付宝赞助</div>
                    </div>
                  )}
                </div>

                <div className="text-center mt-3">
                  <Link href="/sponsor" className="text-xs text-gray-400 hover:text-gray-900 transition-colors">
                    查看更多赞助方式 →
                  </Link>
                </div>
              </section>
            )}
          </div>
        </div>

        {/* ============ 底部操作 ============ */}
        <div className="text-center mt-8">
          <Link href="/products" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回项目列表
          </Link>
        </div>
      </Container>
    </div>
  );
}
