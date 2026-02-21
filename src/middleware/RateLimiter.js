export class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests ?? 30;
    this.windowMs = options.windowMs ?? 60_000;
    this.cache = new Map();
  }

  async before(ctx) {
    const now = Date.now();
    const key = ctx.sessionId;
    const current = this.cache.get(key) || { count: 0, windowStart: now };

    if (now - current.windowStart > this.windowMs) {
      current.count = 0;
      current.windowStart = now;
    }

    current.count += 1;
    this.cache.set(key, current);

    if (current.count > this.maxRequests) {
      throw new Error('Rate limit exceeded for this session.');
    }
  }
}
