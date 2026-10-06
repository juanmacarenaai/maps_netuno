'use strict';

/**
 * Rate limit de ventana fija por IP. Suficiente para un proxy con una o pocas
 * instancias. Si necesitas distribuir el limite, usa Redis.
 */
function createRateLimiter({ windowMs, max }) {
  const buckets = new Map();

  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(ip);

    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(ip, bucket);
    }

    bucket.count += 1;

    if (buckets.size > 5000) {
      buckets.forEach((value, key) => {
        if (now - value.start >= windowMs) buckets.delete(key);
      });
    }

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((bucket.start + windowMs - now) / 1000)));

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.start + windowMs - now) / 1000)));
      return res.status(429).json({
        ok: false,
        error: {
          code: 'rate_limited',
          message: 'Demasiadas consultas. Espera un momento e intenta de nuevo.'
        }
      });
    }

    return next();
  };
}

module.exports = { createRateLimiter };