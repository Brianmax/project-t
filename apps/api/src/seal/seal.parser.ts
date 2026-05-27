import * as cheerio from 'cheerio';
import {
  ParsedSupplyDetail,
  ParsedReceiptRow,
  ParsedConsumptionRow,
} from './seal.types';
import { SealParseError } from './seal.errors';

export function isLoginPage(html: string): boolean {
  const $ = cheerio.load(html);
  return $('form[action="/Home/Login"]').length > 0;
}

export function extractCsrfFormToken(html: string): string {
  const $ = cheerio.load(html);
  const token = $('form input[name="__RequestVerificationToken"]').attr(
    'value',
  );
  if (!token) {
    throw new SealParseError(
      'Could not find __RequestVerificationToken in login form',
    );
  }
  return token;
}

export function parseSetCookieHeader(
  setCookie: string[] | null | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!setCookie) return result;
  for (const header of setCookie) {
    const parts = header.split(';')[0].split('=');
    if (parts.length >= 2) {
      result[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  }
  return result;
}

function parseReceiptStatus(raw: string): ParsedReceiptRow['status'] {
  const lower = raw.toLowerCase().trim();
  if (lower.includes('pagado') || lower.includes('pagada')) return 'paid';
  if (lower.includes('pendiente')) return 'pending';
  if (lower.includes('acumulado')) return 'carry_forward';
  return 'pending';
}

const MESES: Record<string, string> = {
  ene: '01',
  feb: '02',
  mar: '03',
  abr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  ago: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dic: '12',
};

function lookupMonth(abbr: string): string {
  return MESES[abbr.toLowerCase().slice(0, 3)] ?? abbr;
}

function parseDateEsp(raw: string): string {
  const parts = raw.trim().split('/');
  if (parts.length !== 3) return raw;
  const day = parts[0].padStart(2, '0');
  const month = lookupMonth(parts[1]);
  const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
  return `${year}-${month}-${day}`;
}

function parsePeriodoComercial(raw: string): string {
  const parts = raw.trim().split('-');
  if (parts.length !== 2) return raw;
  const month = lookupMonth(parts[0]);
  const year = parts[1].length === 2 ? `20${parts[1]}` : parts[1];
  return `${year}${month}`;
}

export function parseSupplyDetail(html: string): ParsedSupplyDetail {
  const $ = cheerio.load(html);

  const receipts: ParsedReceiptRow[] = [];
  $('#tblRecibos tbody tr').each((_i, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 6) return;

    const periodoRaw = $(cells[0]).text().trim();
    const vencimientoRaw = $(cells[1]).text().trim();
    const estadoRaw = $(cells[2]).text().trim();
    const montoRaw = $(cells[3]).text().trim();
    const comprobanteRaw = $(cells[4]).text().trim();
    const fechaPagoRaw = $(cells[5]).text().trim();

    const montoClean = montoRaw
      .replace(/^[^0-9]*/, '')
      .replace(/[^\d.]/g, '')
      .replace(/^\./, '');
    const paymentDate =
      fechaPagoRaw && fechaPagoRaw !== '-' ? parseDateEsp(fechaPagoRaw) : null;

    receipts.push({
      periodoComercial: parsePeriodoComercial(periodoRaw),
      comprobanteCode: comprobanteRaw.replace(/\s/g, ''),
      status: parseReceiptStatus(estadoRaw),
      paymentDate,
      dueDate: parseDateEsp(vencimientoRaw),
      amountPen: montoClean || '0',
    });
  });

  const consumption: ParsedConsumptionRow[] = [];
  $('#tblConsumos tbody tr').each((_i, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 2) return;

    const periodoRaw = $(cells[0]).text().trim();
    const kwhRaw = $(cells[1]).text().trim();

    consumption.push({
      periodoComercial: parsePeriodoComercial(periodoRaw),
      kwh: parseInt(kwhRaw.replace(/[^\d]/g, ''), 10) || 0,
    });
  });

  return { receipts, consumption };
}
