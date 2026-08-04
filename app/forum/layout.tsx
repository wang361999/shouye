import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '开发者社区 - 技术交流 · 工具反馈 · 经验分享',
  description:
    '加入开发者社区，参与技术讨论、提问解答、工具反馈和经验分享。浏览最新帖子、热门话题，与开发者一起成长。',
  keywords: [
    '开发者社区',
    '技术论坛',
    '编程交流',
    '技术问答',
    '开源讨论',
    '开发者论坛',
    '代码分享',
    '技术讨论区',
  ],
  alternates: {
    canonical: '/forum',
  },
  openGraph: {
    title: '开发者社区 - 技术交流 · 工具反馈 · 经验分享',
    description:
      '加入开发者社区，参与技术讨论、提问解答、工具反馈和经验分享。',
    type: 'website',
    locale: 'zh_CN',
  },
};

export default function ForumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
