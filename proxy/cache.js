'use strict';

/**
 * Cache TTL en memoria con tope de entradas (evita grow unbounded en proxies
 * de larga duracion). No es un cache distribuido: si corres varias instancias,
 * cada una mantiene su propia copia.
 */
class TtlCache {
  constructor(ttlMs, maxEntries) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      this.misses += 1;
      return null;
    }
    this.hits += 1;
    return entry.value;
  }

  set(key, value) {
    this.sweep();
    if (this.store.size >= this.maxEntries) this.evictOne();
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
    return value;
  }

  evictOne() {
    let oldestKey = null;
    let oldestExpiry = Infinity;
    this.store.forEach((entry, key) => {
      if (entry.expires < oldestExpiry) {
        oldestExpiry = entry.expires;
        oldestKey = key;
      }
    });
    if (oldestKey === null) oldestKey = this.store.keys().next().value;
    if (oldestKey !== undefined) this.store.delete(oldestKey);
  }

  sweep() {
    const now = Date.now();
    this.store.forEach((entry, key) => {
      if (now > entry.expires) this.store.delete(key);
    });
  }

  stats() {
    return { size: this.store.size, hits: this.hits, misses: this.misses, ttlMs: this.ttlMs };
  }
}

module.exports = TtlCache;