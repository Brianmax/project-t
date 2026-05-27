import * as fs from 'fs';
import * as path from 'path';
import {
  isLoginPage,
  extractCsrfFormToken,
  parseSupplyDetail,
  parseSetCookieHeader,
} from './seal.parser';

function fixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, '__fixtures__', name), 'utf-8');
}

describe('seal.parser', () => {
  describe('isLoginPage', () => {
    it('returns true for the login page', () => {
      expect(isLoginPage(fixture('login.html'))).toBe(true);
    });

    it('returns true for the failed login page', () => {
      expect(isLoginPage(fixture('login-failed.html'))).toBe(true);
    });

    it('returns false for the detalle page', () => {
      expect(isLoginPage(fixture('detalle-50888.html'))).toBe(false);
    });
  });

  describe('extractCsrfFormToken', () => {
    it('extracts __RequestVerificationToken from login form', () => {
      const token = extractCsrfFormToken(fixture('login.html'));
      expect(token).toBe('abc123csrf_token_value_xyz');
    });

    it('extracts token from failed login page', () => {
      const token = extractCsrfFormToken(fixture('login-failed.html'));
      expect(token).toBe('failed_csrf_token_value');
    });

    it('throws SealParseError when token is missing', () => {
      expect(() =>
        extractCsrfFormToken('<html><body>No form</body></html>'),
      ).toThrow('Could not find __RequestVerificationToken');
    });
  });

  describe('parseSetCookieHeader', () => {
    it('parses multiple Set-Cookie headers', () => {
      const headers = [
        'ASP.NET_SessionId=abc123; path=/; HttpOnly',
        '__RequestVerificationToken=xyz789; path=/; HttpOnly',
      ];
      const result = parseSetCookieHeader(headers);
      expect(result).toEqual({
        'ASP.NET_SessionId': 'abc123',
        __RequestVerificationToken: 'xyz789',
      });
    });

    it('returns empty object for null input', () => {
      expect(parseSetCookieHeader(null)).toEqual({});
      expect(parseSetCookieHeader(undefined)).toEqual({});
    });

    it('returns empty object for empty array', () => {
      expect(parseSetCookieHeader([])).toEqual({});
    });
  });

  describe('parseSupplyDetail', () => {
    it('parses 6 receipts from detalle fixture', () => {
      const detail = parseSupplyDetail(fixture('detalle-50888.html'));
      expect(detail.receipts).toHaveLength(6);
    });

    it('parses receipt fields correctly', () => {
      const detail = parseSupplyDetail(fixture('detalle-50888.html'));
      const may2026 = detail.receipts[0];

      expect(may2026.periodoComercial).toBe('202605');
      expect(may2026.comprobanteCode).toBe('0011223344556677890');
      expect(may2026.status).toBe('paid');
      expect(may2026.dueDate).toBe('2026-05-30');
      expect(may2026.paymentDate).toBe('2026-05-25');
      expect(may2026.amountPen).toBe('265.20');
    });

    it('parses carry_forward status', () => {
      const detail = parseSupplyDetail(fixture('detalle-50888.html'));
      const dec2025 = detail.receipts[5];

      expect(dec2025.periodoComercial).toBe('202512');
      expect(dec2025.status).toBe('carry_forward');
      expect(dec2025.paymentDate).toBeNull();
      expect(dec2025.amountPen).toBe('315.30');
    });

    it('parses all 6 consumption rows', () => {
      const detail = parseSupplyDetail(fixture('detalle-50888.html'));
      expect(detail.consumption).toHaveLength(6);
    });

    it('parses consumption kWh correctly', () => {
      const detail = parseSupplyDetail(fixture('detalle-50888.html'));
      expect(detail.consumption[0]).toEqual({
        periodoComercial: '202605',
        kwh: 301,
      });
      expect(detail.consumption[5]).toEqual({
        periodoComercial: '202512',
        kwh: 357,
      });
    });

    it('returns empty arrays for a page with no tables', () => {
      const detail = parseSupplyDetail('<html><body>No data</body></html>');
      expect(detail.receipts).toEqual([]);
      expect(detail.consumption).toEqual([]);
    });
  });
});
