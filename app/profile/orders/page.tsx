'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/common/Container';
import { useAppStore } from '@/lib/store';
import { formatDate, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ============ 类型定义 ============
interface Order {
  id: string;
  orderNo: string;
  productName: string;
  projectType: string;
  maxDomains: number;
  amount: number;
  validDays: number;
  status: string;
  payMethod: string | null;
  paidAt: string | null;
  licenseId: string | null;
  createdAt: string;
  product: { name: string; icon: string | null } | null;
}

// ============ 套餐类型映射 ============
const TYPE_MAP: Record<string, { label: string; color: string; domains: number }> = {
  basic: { label: '基础版', color: 'bg-gray-100 text-gray-700', domains: 1 },
  standard: { label: '标准版', color: 'bg-blue-100 text-blue-700', domains: 2 },
  premium: { label: '高级版', color: 'bg-purple-100 text-purple-700', domains: 5 },
  enterprise: { label: '企业版', color: 'bg-orange-100 text-orange-700', domains: 10 },
};

// ============ 订单状态映射 ============
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待支付', color: 'bg-yellow-100 text-yellow-700' },
  paid: { label: '已支付', color: 'bg-green-100 text-green-700' },
  refunded: { label: '已退款', color: 'bg-gray-100 text-gray-500' },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-500' },
};

// ============ 支付方式 ============
const PAY_METHODS = [
  { key: 'alipay', label: '支付宝', icon: '💰' },
  { key: 'wechat', label: '微信支付', icon: '💚' },
  { key: 'manual', label: '银行转账', icon: '🏦' },
];

const PAGE_SIZE = 10;

function getTypeMeta(type: string) {
  return TYPE_MAP[type] || { label: type, color: 'bg-gray-100 text-gray-700', domains: 0 };
}

function getStatusMeta(status: string) {
  return STATUS_MAP[status] || { label: status, color: 'bg-gray-100 text-gray-500' };
}

export default function UserOrdersPage() {
  const { user, token, hydrate, _hydrated } = useAppStore();
  const router = useRouter();

  // ---- 列表状态 ----
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // ---- 支付弹窗 ----
  const [payTarget, setPayTarget] = useState<Order | null>(null);
  const [payMethod, setPayMethod] = useState('alipay');
  const [paying, setPaying] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ============ 客户端水合 ============
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // ============ 获取订单列表 ============
  const fetchOrders = useCallback(
    async (pageNum: number) => {
      if (!token) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          pageSize: String(PAGE_SIZE),
        });
        const res = await fetch(`/api/user/orders?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          toast.error('登录已过期，请重新登录');
          router.push('/login');
          return;
        }
        if (!res.ok) throw new Error('获取失败');
        const data = await res.json();
        setOrders(data.data || []);
        setTotal(data.total || 0);
      } catch {
        toast.error('获取订单列表失败');
        setOrders([]);
      } finally {
        setLoading(false);
      }
    },
    [token, router],
  );

  useEffect(() => {
    if (user && token && _hydrated) {
      fetchOrders(page);
    }
  }, [user, token, _hydrated, page, fetchOrders]);

  // ============ 打开支付弹窗 ============
  function openPayModal(order: Order) {
    setPayTarget(order);
    setPayMethod('alipay');
  }

  function closePayModal() {
    if (paying) return;
    setPayTarget(null);
    setPayMethod('alipay');
  }

  // ============ 确认支付 ============
  async function handlePay() {
    if (!token || !payTarget) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/user/orders/${payTarget.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payMethod }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '支付失败');
        return;
      }
      toast.success('支付成功，授权码已生成');
      setPayTarget(null);
      fetchOrders(page);
    } catch {
      toast.error('支付失败，请稍后重试');
    } finally {
      setPaying(false);
    }
  }

  // ============ 渲染：水合中 ============
  if (!_hydrated) {
    return (
      <Container className="py-16 text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-500">加载中...</p>
      </Container>
    );
  }

  // ============ 渲染：未登录 ============
  if (!user || !token) {
    return (
      <Container className="py-16 text-center">
        <div className="max-w-sm mx-auto bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">请先登录</h2>
          <p className="text-sm text-gray-500 mb-6">
            登录后即可查看和管理您的订单
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            前往登录
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      {/* 返回链接 */}
      <Link
        href="/profile"
        className="inline-block text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
      >
        &larr; 返回个人中心
      </Link>

      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
        <span className="mr-2">🛒</span>
        我的订单
      </h1>

      {/* ============ 加载中 ============ */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"
            >
              <div className="flex justify-between mb-4">
                <div className="h-5 bg-gray-200 rounded w-1/4" />
                <div className="h-5 bg-gray-100 rounded w-20" />
              </div>
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-4" />
              <div className="h-9 bg-gray-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        /* ============ 空状态 ============ */
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="text-5xl mb-3">🛒</div>
          <p className="text-gray-400 mb-1">暂无订单</p>
          <p className="text-sm text-gray-400 mb-4">
            您还没有任何订单，去产品中心看看吧
          </p>
          <Link
            href="/products"
            className="inline-block px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            浏览产品
          </Link>
        </div>
      ) : (
        /* ============ 订单列表 ============ */
        <div className="space-y-4">
          {orders.map((order) => {
            const typeMeta = getTypeMeta(order.projectType);
            const statusMeta = getStatusMeta(order.status);
            return (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-gray-200 p-6 transition-shadow hover:shadow-sm"
              >
                {/* 订单头部 */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    {/* 产品图标 */}
                    <div className="text-3xl">
                      {order.product?.icon || '📦'}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        {order.productName}
                      </h3>
                      <p className="text-xs text-gray-400 font-mono">
                        {order.orderNo}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 套餐类型徽章 */}
                    <span
                      className={cn(
                        'inline-block px-2.5 py-0.5 text-xs font-medium rounded-full',
                        typeMeta.color,
                      )}
                    >
                      {typeMeta.label}
                    </span>
                    {/* 状态徽章 */}
                    <span
                      className={cn(
                        'inline-block px-2.5 py-0.5 text-xs font-medium rounded-full',
                        statusMeta.color,
                      )}
                    >
                      {statusMeta.label}
                    </span>
                  </div>
                </div>

                {/* 订单详情 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">域名配额</p>
                    <p className="text-sm font-medium text-gray-900">
                      {order.maxDomains} 个
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">授权有效期</p>
                    <p className="text-sm font-medium text-gray-900">
                      {order.validDays} 天
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">下单时间</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">支付金额</p>
                    <p className="text-sm font-bold text-orange-600">
                      ¥{(order.amount / 100).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* 订单操作 */}
                <div className="flex flex-wrap items-center gap-3">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => openPayModal(order)}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      立即支付
                    </button>
                  )}

                  {order.status === 'paid' && order.licenseId && (
                    <Link
                      href="/profile/licenses"
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      查看授权
                    </Link>
                  )}

                  {order.status === 'paid' && order.paidAt && (
                    <span className="text-xs text-gray-400">
                      支付时间：{formatDate(order.paidAt)}
                    </span>
                  )}

                  {order.payMethod && order.status === 'paid' && (
                    <span className="text-xs text-gray-400">
                      支付方式：{order.payMethod}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* ============ 分页 ============ */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                上一页
              </button>
              <span className="px-4 text-sm text-gray-600">
                第 {page} / {totalPages} 页
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============ 支付方式弹窗 ============ */}
      {payTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closePayModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">选择支付方式</h3>
              <button
                onClick={closePayModal}
                disabled={paying}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 订单金额 */}
            <div className="text-center mb-6 p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">支付金额</p>
              <p className="text-3xl font-bold text-orange-600">
                ¥{(payTarget.amount / 100).toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {payTarget.productName} · {getTypeMeta(payTarget.projectType).label}
              </p>
            </div>

            {/* 支付方式选择 */}
            <div className="space-y-2 mb-6">
              {PAY_METHODS.map((method) => (
                <button
                  key={method.key}
                  onClick={() => setPayMethod(method.key)}
                  disabled={paying}
                  className={cn(
                    'w-full flex items-center p-3 rounded-lg border-2 transition-colors',
                    payMethod === method.key
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300',
                  )}
                >
                  <span className="text-2xl mr-3">{method.icon}</span>
                  <span className="flex-1 text-left text-sm font-medium text-gray-900">
                    {method.label}
                  </span>
                  {payMethod === method.key && (
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* 演示提示 */}
            <p className="text-xs text-gray-400 text-center mb-4">
              演示模式：点击确认后将模拟支付成功并生成授权码
            </p>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <button
                onClick={closePayModal}
                disabled={paying}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handlePay}
                disabled={paying}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {paying ? (
                  <span className="inline-flex items-center">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                    支付中...
                  </span>
                ) : (
                  '确认支付'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
