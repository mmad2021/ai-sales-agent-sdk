export class ErrorHandler {
  constructor(options = {}) {
    this.onError = options.onError || null;
  }

  async error(ctx) {
    if (typeof this.onError === 'function') {
      await this.onError(ctx.error, ctx);
    }
  }
}
