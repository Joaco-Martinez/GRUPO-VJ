"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cached = cached;
exports.invalidateCache = invalidateCache;
const store = new Map();
/**
 * Cache en memoria muy simple con TTL, para evitar pegarle a la DB en
 * endpoints de lectura muy frecuente (catálogo, categorías) cuyos datos
 * no necesitan ser 100% al instante.
 */
async function cached(key, ttlMs, loader) {
    const now = Date.now();
    const entry = store.get(key);
    if (entry && entry.expiresAt > now) {
        return entry.value;
    }
    const value = await loader();
    store.set(key, { value, expiresAt: now + ttlMs });
    return value;
}
function invalidateCache(prefix) {
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
            store.delete(key);
        }
    }
}
//# sourceMappingURL=simpleCache.js.map