import { Logger } from '@nestjs/common';
import { SealConfigValues } from './seal.config';
import { SealAuthError } from './seal.errors';
import { parseSetCookieHeader, extractCsrfFormToken } from './seal.parser';

interface CachedSession {
  cookie: string;
  expiresAt: number;
}

export class SealSession {
  private readonly logger = new Logger(SealSession.name);
  private cached: CachedSession | null = null;
  private loginPromise: Promise<string> | null = null;

  constructor(private readonly config: SealConfigValues) {}

  async getCookie(): Promise<string> {
    if (this.cached && Date.now() < this.cached.expiresAt) {
      return this.cached.cookie;
    }
    return this.login();
  }

  invalidate(): void {
    this.cached = null;
  }

  private async login(): Promise<string> {
    if (this.loginPromise) {
      return this.loginPromise;
    }

    this.loginPromise = this.doLogin();
    try {
      return await this.loginPromise;
    } finally {
      this.loginPromise = null;
    }
  }

  private async doLogin(): Promise<string> {
    this.logger.log({
      operation: 'seal.session.login',
      baseUrl: this.config.baseUrl,
    });

    const loginPageResp = await fetch(`${this.config.baseUrl}/Home/Login`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!loginPageResp.ok) {
      throw new SealAuthError(
        `GET /Home/Login returned ${loginPageResp.status}`,
      );
    }

    const setCookieHeader = loginPageResp.headers.getSetCookie();
    const cookies = parseSetCookieHeader(setCookieHeader);
    const sessionCookie = cookies['ASP.NET_SessionId'];
    const csrfCookie = cookies['__RequestVerificationToken'];

    if (!sessionCookie) {
      throw new SealAuthError('No ASP.NET_SessionId in login page response');
    }

    const loginHtml = await loginPageResp.text();
    const csrfFormToken = extractCsrfFormToken(loginHtml);

    const postResp = await fetch(`${this.config.baseUrl}/Home/Login`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: `ASP.NET_SessionId=${sessionCookie}; __RequestVerificationToken=${csrfCookie ?? ''}`,
        Origin: this.config.baseUrl,
        Referer: `${this.config.baseUrl}/Home/Login`,
      },
      body: new URLSearchParams({
        __RequestVerificationToken: csrfFormToken,
        CorreoElectronico: this.config.email,
        Contrasena: this.config.password,
      }).toString(),
    });

    if (postResp.status !== 302) {
      throw new SealAuthError(
        `Login POST returned ${postResp.status}, expected 302`,
      );
    }

    this.cached = {
      cookie: sessionCookie,
      expiresAt: Date.now() + this.config.sessionTtlMs,
    };

    this.logger.log({ operation: 'seal.session.login.success' });
    return sessionCookie;
  }
}
