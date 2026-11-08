export abstract class LinearRegexError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LimitExceededError extends LinearRegexError {
  override readonly code = "LIMIT_EXCEEDED" as const;

  constructor(message: string) {
    super(message, "LIMIT_EXCEEDED");
  }
}
