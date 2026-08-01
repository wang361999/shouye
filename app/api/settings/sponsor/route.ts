import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const DEFAULTS = {
  sponsor_wechat_qr: '',
  sponsor_alipay_qr: '',
  sponsor_text: '如果我们的项目对您有帮助，欢迎赞助支持 ❤️',
};

/** GET /api/settings/sponsor - 公开获取赞助信息 */
export async function GET() {
  try {
    const keys = ['sponsor_wechat_qr', 'sponsor_alipay_qr', 'sponsor_text'];
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: keys } },
    });

    const result: Record<string, string> = { ...DEFAULTS };
    for (const item of settings) {
      result[item.key] = item.value;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[SPONSOR SETTINGS GET ERROR]', error);
    return NextResponse.json(DEFAULTS);
  }
}
