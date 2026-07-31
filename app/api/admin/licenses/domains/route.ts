import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

/**
 * POST /api/admin/licenses/domains - 绑定域名到授权码
 * body: { licenseId, domain }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { licenseId, domain } = body;

    if (!licenseId || !domain) {
      return NextResponse.json({ error: '授权码 ID 和域名不能为空' }, { status: 400 });
    }

    // 标准化域名：去掉协议和端口
    let normalizedDomain = domain.trim().toLowerCase();
    normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    normalizedDomain = normalizedDomain.split(':')[0]; // 去掉端口

    if (!normalizedDomain || !/^[\w.-]+$/.test(normalizedDomain)) {
      return NextResponse.json({ error: '域名格式无效' }, { status: 400 });
    }

    const license = await prisma.license.findUnique({
      where: { id: licenseId },
      include: { domains: true },
    });

    if (!license) {
      return NextResponse.json({ error: '授权码不存在' }, { status: 404 });
    }

    // 检查域名是否已绑定到其他授权码
    const existingDomain = await prisma.licenseDomain.findUnique({
      where: { domain: normalizedDomain },
      include: { license: true },
    });

    if (existingDomain && existingDomain.licenseId !== licenseId) {
      return NextResponse.json({
        error: `域名 ${normalizedDomain} 已绑定到其他授权码: ${existingDomain.license.licenseKey}`,
      }, { status: 409 });
    }

    if (existingDomain && existingDomain.licenseId === licenseId) {
      return NextResponse.json({ error: '该域名已绑定到此授权码' }, { status: 409 });
    }

    // 检查是否超过最大绑定数
    if (license.domains.length >= license.maxDomains) {
      return NextResponse.json({
        error: `已达到最大绑定域名数（${license.maxDomains}），请先解绑其他域名或升级套餐`,
      }, { status: 400 });
    }

    const domainRecord = await prisma.licenseDomain.create({
      data: {
        licenseId,
        domain: normalizedDomain,
      },
    });

    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'bind_license_domain',
        target: 'LicenseDomain',
        detail: `绑定域名 ${normalizedDomain} 到授权码 ${license.licenseKey}`,
      },
    });

    return NextResponse.json({
      id: domainRecord.id,
      domain: domainRecord.domain,
      activatedAt: domainRecord.activatedAt,
      message: '域名绑定成功',
    }, { status: 201 });
  } catch (error) {
    console.error('[LICENSE DOMAIN BIND ERROR]', error);
    return NextResponse.json({ error: '绑定域名失败' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/licenses/domains - 解绑域名
 * ?domain=xxx 或 ?id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const id = searchParams.get('id');

    if (!domain && !id) {
      return NextResponse.json({ error: '需要提供 domain 或 id 参数' }, { status: 400 });
    }

    let domainRecord;
    if (id) {
      domainRecord = await prisma.licenseDomain.findUnique({ where: { id } });
    } else {
      domainRecord = await prisma.licenseDomain.findUnique({ where: { domain: domain! } });
    }

    if (!domainRecord) {
      return NextResponse.json({ error: '域名绑定记录不存在' }, { status: 404 });
    }

    await prisma.licenseDomain.delete({ where: { id: domainRecord.id } });

    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'unbind_license_domain',
        target: 'LicenseDomain',
        detail: `解绑域名 ${domainRecord.domain}`,
      },
    });

    return NextResponse.json({ message: '域名已解绑' });
  } catch (error) {
    console.error('[LICENSE DOMAIN UNBIND ERROR]', error);
    return NextResponse.json({ error: '解绑域名失败' }, { status: 500 });
  }
}
