'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Container } from '@/components/common/Container';
import { DEFAULT_TERMS, DEFAULT_PRIVACY } from '@/lib/default-agreements';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function AgreementPage() {
  const params = useParams();
  const type = params.type as string;

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgreement = async () => {
      // 仅支持 terms 和 privacy
      if (type !== 'terms' && type !== 'privacy') {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/agreements?type=${type}`);
        if (!res.ok) throw new Error('获取失败');
        const data = await res.json();
        setContent(data.content);
      } catch {
        // 降级使用默认内容
        setContent(type === 'terms' ? DEFAULT_TERMS : DEFAULT_PRIVACY);
      } finally {
        setLoading(false);
      }
    };
    fetchAgreement();
  }, [type]);

  if (loading) {
    return (
      <Container className="py-8 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-5/6" />
          <div className="h-4 bg-gray-100 rounded w-4/6" />
          <div className="h-32 bg-gray-100 rounded" />
        </div>
      </Container>
    );
  }

  if (type !== 'terms' && type !== 'privacy') {
    return (
      <Container className="py-16 text-center">
        <p className="text-lg text-gray-400 mb-4">页面不存在</p>
        <a href="/" className="text-blue-600 hover:underline text-sm">
          返回首页
        </a>
      </Container>
    );
  }

  const title = type === 'terms' ? '用户协议' : '隐私政策';

  return (
    <Container className="py-8 max-w-4xl">
      {/* 面包屑 */}
      <nav className="text-sm text-gray-500 mb-4">
        <a href="/" className="hover:text-blue-600 transition-colors">
          首页
        </a>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{title}</span>
      </nav>

      {/* 内容卡片 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-10">
        <div className="prose prose-sm sm:prose-base max-w-none markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>

      {/* 底部提示 */}
      <p className="text-center text-xs text-gray-400 mt-6">
        如有疑问，请在论坛「反馈建议」分类下发帖联系管理员
      </p>
    </Container>
  );
}
