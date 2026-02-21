const LEVELS = ['debug', 'info', 'warn', 'error'];

export class Logger {
  constructor(options = {}) {
    this.level = options.level || 'info';
  }

  async before(ctx) {
    this._log('info', 'request.start', {
      sessionId: ctx.sessionId,
      message: ctx.message
    });
  }

  async after(ctx) {
    this._log('info', 'request.success', {
      sessionId: ctx.sessionId,
      intent: ctx.response?.intent,
      durationMs: Date.now() - ctx.startedAt
    });
  }

  async error(ctx) {
    this._log('error', 'request.error', {
      sessionId: ctx.sessionId,
      error: ctx.error?.message,
      durationMs: Date.now() - ctx.startedAt
    });
  }

  _log(level, event, payload) {
    if (LEVELS.indexOf(level) < LEVELS.indexOf(this.level)) {
      return;
    }

    console.log(JSON.stringify({
      level,
      event,
      timestamp: new Date().toISOString(),
      ...payload
    }));
  }
}
