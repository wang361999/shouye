'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Container } from '@/components/common/Container';

interface SponsorSettings {
  sponsor_wechat_qr: string;
  sponsor_alipay_qr: string;
  sponsor_text: string;
}

export default function SponsorPage() {
  const [settings, setSettings] = useState<SponsorSettings>({
    sponsor_wechat_qr: '',
    sponsor_alipay_qr: '',
    sponsor_text: '如果我们的项目对您有帮助，欢迎赞助支持 ❤️',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings/sponsor');
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch {
        // 静默失败
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const hasWechat = !!settings.sponsor_wechat_qr;
  const hasAlipay = !!settings.sponsor_alipay_qr;
  const hasAny = hasWechat || hasAlipay;

  return (
    <div className="bg-gray-50 min-h-screen">
      <Container className="py-12">
        {/* 返回链接 */}
        <Link
          href="/"
          className="inline-block text-sm text-gray-500 hover:text-blue-600 transition-colors mb-6"
        >
          ← 返回首页
        </Link>

        {/* 标题区 */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">❤️</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">赞助支持</h1>
          <p className="text-base text-gray-500 max-w-md mx-auto leading-relaxed">
            {settings.sponsor_text}
          </p>
        </div>

        {/* 二维码展示 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : hasAny ? (
          <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* 微信赞助 */}
            {hasWechat && (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center hover:shadow-md transition-shadow">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.616-6.546 1.23-1.31 2.965-2.128 4.882-2.128.211 0 .42.014.627.028C16.389 5.028 12.81 2.188 8.691 2.188zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1 .19-.555c1.633-1.121 2.61-2.799 2.61-4.659 0-3.276-3.054-5.962-6.852-6.083zm-2.083 3.058c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">微信赞助</h3>
                </div>
                <div className="inline-block p-3 bg-gray-50 rounded-xl">
                  <img
                    src={settings.sponsor_wechat_qr}
                    alt="微信赞助二维码"
                    className="w-48 h-48 rounded-lg object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-4">扫码微信赞助</p>
              </div>
            )}

            {/* 支付宝赞助 */}
            {hasAlipay && (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center hover:shadow-md transition-shadow">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.95 16.96c-.59.27-3.07 1.42-5.03 2.38-2.79 1.36-5.62 2.22-8.15 2.22-3.86 0-6.97-1.79-6.97-5.52 0-1.69.54-3.39 1.46-5.07C2.14 13.81.82 17.39.82 20.06c0 5.05 4.08 7.49 8.14 7.49 3.86 0 6.97-1.79 6.97-5.52 0-1.69-.54-3.39-1.46-5.07l8.48-4.37v5.37zm-3.3-5.87c-.55-1.27-1.53-2.39-2.85-3.31 1.43-1.79 2.42-3.85 2.42-5.74 0-1.3-.52-2.34-1.46-2.85-.54-.29-1.2-.43-1.95-.43-3.05 0-7.2 2.73-9.81 6.28C3.24 9.3 1.92 12.88 1.92 15.55c0 1.72.69 2.99 1.81 3.69.59.36 1.29.54 2.06.54 3.05 0 7.2-2.73 9.81-6.28.43-.57.82-1.15 1.17-1.74.16.59.24 1.19.24 1.79 0 1.3-.52 2.34-1.46 2.85l3.14-2.31z"/>
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">支付宝赞助</h3>
                </div>
                <div className="inline-block p-3 bg-gray-50 rounded-xl">
                  <img
                    src={settings.sponsor_alipay_qr}
                    alt="支付宝赞助二维码"
                    className="w-48 h-48 rounded-lg object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-4">扫码支付宝赞助</p>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-4">🙏</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              赞助功能即将开放
            </h2>
            <p className="text-sm text-gray-500">
              赞助二维码正在配置中，请稍后再来
            </p>
          </div>
        )}

        {/* 底部信息 */}
        <div className="text-center mt-10">
          <p className="text-sm text-gray-400">
            您的赞助将用于服务器维护和项目持续开发
          </p>
          <Link
            href="/products"
            className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            浏览产品 →
          </Link>
        </div>
      </Container>
    </div>
  );
}
