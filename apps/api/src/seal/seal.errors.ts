export class SealAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SealAuthError';
  }
}

export class SealSessionExpiredError extends Error {
  constructor(message = 'SEAL session expired') {
    super(message);
    this.name = 'SealSessionExpiredError';
  }
}

export class SealParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SealParseError';
  }
}

export class SealSupplyNotFoundError extends Error {
  constructor(supplyCode: string) {
    super(`SEAL supply not found: ${supplyCode}`);
    this.name = 'SealSupplyNotFoundError';
  }
}
