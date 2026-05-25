export interface ReceiptStorage {
  upload(key: string, body: Buffer, contentType: string): Promise<void>;
  getDownloadUrl(
    key: string,
    opts?: { expiresInSec?: number; filename?: string },
  ): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export const RECEIPT_STORAGE = Symbol('ReceiptStorage');
