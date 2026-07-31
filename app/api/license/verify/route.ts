import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/license/verify - 授权验证接口（公开，供第三方项目调用）
 *
 * body: {
 *   license_key: string,  // 授权码
 *   domain: string,       // 当前运行域名
 * }
 *
 * 返回:
 *   有效: { valid: true, message: "授权有效", expires_at, project_name, project_type }
 *   无效: { valid: false, message: "原因说明", code: "not_found|expired|suspended|domain_mismatch|revoked" }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let licenseKey = '';
  let domain = '';
  let ip = '';
  let userAgent = '';

  try {
    const body = await request.json();
    licenseKey = body.license_key || '';
    domain = body.domain || '';

    // 提取请求信息
    ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
         request.headers.get('x-real-ip') || '';
    userAgent = request.headers.get('user-agent') || '';

    // 标准化域名
    let normalizedDomain = domain.trim().toLowerCase();
    normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    normalizedDomain = normalizedDomain.split(':')[0];

    if (!licenseKey || !normalizedDomain) {
      await logVerification(null, licenseKey, normalizedDomain || domain, ip, userAgent, 'invalid', '授权码或域名为空');
      return NextResponse.json({
        valid: false,
        code: 'invalid',
        message: '授权码和域名不能为空',
      }, { status: 400 });
    }

    // 查找授权码
    const license = await prisma.license.findUnique({
      where: { licenseKey },
      include: { domains: true },
    });

    if (!license) {
      await logVerification(null, licenseKey, normalizedDomain, ip, userAgent, 'not_found', '授权码不存在');
      return NextResponse.json({
        valid: false,
        code: 'not_found',
        message: '授权码不存在',
      }, { status: 404 });
    }

    // 检查状态
    if (license.status === 'revoked') {
      await logVerification(license.id, licenseKey, normalizedDomain, ip, userAgent, 'revoked', '授权码已被吊销');
      return NextResponse.json({
        valid: false,
        code: 'revoked',
        message: '授权已被吊销',
      }, { status: 403 });
    }

    if (license.status === 'suspended') {
      await logVerification(license.id, licenseKey, normalizedDomain, ip, userAgent, 'suspended', '授权码已被暂停');
      return NextResponse.json({
        valid: false,
        code: 'suspended',
        message: '授权已被暂停，请联系管理员',
      }, { status: 403 });
    }

    // 检查是否过期
    if (license.expiresAt < new Date()) {
      // 自动更新状态为 expired
      await prisma.license.update({
        where: { id: license.id },
        data: { status: 'expired' },
      });
      await logVerification(license.id, licenseKey, normalizedDomain, ip, userAgent, 'expired', '授权已过期');
      return NextResponse.json({
        valid: false,
        code: 'expired',
        message: `授权已于 ${license.expiresAt.toISOString().split('T')[0]} 过期`,
        expired_at: license.expiresAt,
      }, { status: 403 });
    }

    // 检查域名是否在绑定列表中
    const domainRecord = license.domains.find((d) => d.domain === normalizedDomain);

    if (!domainRecord) {
      // 域名未绑定
      // 如果授权码还有剩余域名配额，可以自动绑定（首次验证时）
      if (license.domains.length < license.maxDomains) {
        const newDomain = await prisma.licenseDomain.create({
          data: {
            licenseId: license.id,
            domain: normalizedDomain,
          },
        });

        await logVerification(license.id, licenseKey, normalizedDomain, ip, userAgent, 'valid', '首次验证，域名自动绑定');

        return NextResponse.json({
          valid: true,
          code: 'valid',
          message: '授权有效（域名已自动绑定）',
          project_name: license.projectName,
          project_type: license.projectType,
          expires_at: license.expiresAt,
          max_domains: license.maxDomains,
          bound_domains: license.domains.length + 1,
        });
      }

      await logVerification(license.id, licenseKey, normalizedDomain, ip, userAgent, 'domain_mismatch', `域名 ${normalizedDomain} 未绑定且配额已满`);
      return NextResponse.json({
        valid: false,
        code: 'domain_mismatch',
        message: `域名 ${normalizedDomain} 未绑定，且域名配额已满（${license.maxDomains}/${license.maxDomains}）`,
      }, { status: 403 });
    }

    // 所有检查通过，更新最后验证时间
    await prisma.licenseDomain.update({
      where: { id: domainRecord.id },
      data: { lastVerifiedAt: new Date() },
    });

    await logVerification(license.id, licenseKey, normalizedDomain, ip, userAgent, 'valid', '验证通过');

    return NextResponse.json({
      valid: true,
      code: 'valid',
      message: '授权有效',
      project_name: license.projectName,
      project_type: license.projectType,
      expires_at: license.expiresAt,
      max_domains: license.maxDomains,
      bound_domains: license.domains.length,
    });
  } catch (error) {
    console.error('[LICENSE VERIFY ERROR]', error);
    // 尝试记录日志
    try {
      await logVerification(null, licenseKey, domain, ip, userAgent, 'invalid', `服务器错误: ${Date.now() - startTime}ms`);
    } catch {}

    return NextResponse.json({
      valid: false,
      code: 'server_error',
      message: '验证服务暂时不可用',
    }, { status: 500 });
  }
}

/** 记录验证日志 */
async function logVerification(
  licenseId: string | null,
  licenseKey: string,
  domain: string,
  ip: string,
  userAgent: string,
  result: string,
  message: string,
) {
  try {
    await prisma.licenseLog.create({
      data: {
        licenseId: licenseId || undefined,
        licenseKey,
        domain,
        ip: ip || null,
        userAgent: userAgent || null,
        result,
        message,
      },
    });
  } catch {
    // 日志记录失败不影响主流程
  }
}
