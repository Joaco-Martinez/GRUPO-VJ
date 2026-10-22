/**
 * Cache en memoria muy simple con TTL, para evitar pegarle a la DB en
 * endpoints de lectura muy frecuente (catálogo, categorías) cuyos datos
 * no necesitan ser 100% al instante.
 */
export declare function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T>;
export declare function invalidateCache(prefix: string): void;
//# sourceMappingURL=simpleCache.d.ts.map