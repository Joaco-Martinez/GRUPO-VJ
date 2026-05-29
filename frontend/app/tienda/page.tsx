'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ShoppingCart, UserRound, ChevronDown, Package, Truck, Shield } from 'lucide-react';
import { CatalogCategory, CatalogProduct, formatMoney, shopApi } from '@/lib/shop';
import { useCartStore } from '@/store/cart';

export default function TiendaPage() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [customerCategory, setCustomerCategory] = useState('Price');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const cartCount = useCartStore((state) => state.count());
  const add = useCartStore((state) => state.add);

  const visibleLabel = useMemo(() => {
    if (customerCategory === 'Mayorista') return 'Precio mayorista';
    if (customerCategory === 'Cliente') return 'Precio cliente';
    return 'Precio público';
  }, [customerCategory]);

  useEffect(() => {
    shopApi.getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    shopApi
      .getProducts({ category, search, limit: 80 })
      .then((result) => {
        setProducts(result.products);
        setCustomerCategory(result.customer.category);
      })
      .catch((err) => setError(err.message || 'No se pudo cargar la tienda'))
      .finally(() => setLoading(false));
  }, [category, search]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap');

        :root {
          --black: #0a0a0a;
          --white: #ffffff;
          --gray-1: #f5f5f5;
          --gray-2: #e8e8e8;
          --gray-3: #b0b0b0;
          --gray-4: #555;
          --accent: #e8e800;
        }

        * { box-sizing: border-box; }

        .vj-store { font-family: 'Barlow', sans-serif; background: var(--gray-1); color: var(--black); min-height: 100vh; }

        /* TOP BAR */
        .topbar { background: var(--black); color: var(--white); padding: 8px 0; }
        .topbar-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; }
        .topbar-left { display: flex; align-items: center; gap: 24px; font-size: 12px; color: #aaa; }
        .topbar-left span { display: flex; align-items: center; gap: 6px; }
        .topbar-right { font-size: 12px; color: #aaa; }
        .topbar-right a { color: #aaa; text-decoration: none; }
        .topbar-right a:hover { color: var(--white); }

        /* HEADER */
        .header { background: var(--white); border-bottom: 3px solid var(--black); position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 20px rgba(0,0,0,0.12); }
        .header-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; gap: 32px; height: 72px; }

        /* LOGO */
        .logo { display: flex; align-items: center; gap: 12px; text-decoration: none; flex-shrink: 0; }
        .logo-icon { width: 44px; height: 44px; background: var(--black); display: flex; align-items: center; justify-content: center; }
        .logo-text { line-height: 1; }
        .logo-grupo { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.2em; color: var(--gray-4); text-transform: uppercase; display: block; }
        .logo-vj { font-family: 'Barlow Condensed', sans-serif; font-size: 26px; font-weight: 900; color: var(--black); text-transform: uppercase; letter-spacing: -0.02em; display: block; line-height: 1; }

        /* SEARCH BAR */
        .search-wrap { flex: 1; position: relative; }
        .search-wrap input { width: 100%; height: 44px; border: 2px solid var(--gray-2); background: var(--gray-1); padding: 0 16px 0 44px; font-family: 'Barlow', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s; border-radius: 4px; }
        .search-wrap input:focus { border-color: var(--black); }
        .search-wrap input::placeholder { color: var(--gray-3); }
        .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--gray-3); width: 18px; height: 18px; }

        /* NAV ACTIONS */
        .nav-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .btn-account { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border: 1.5px solid var(--gray-2); font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 600; color: var(--black); background: var(--white); cursor: pointer; text-decoration: none; transition: all 0.15s; border-radius: 4px; white-space: nowrap; }
        .btn-account:hover { border-color: var(--black); }
        .btn-cart { display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: var(--black); border: 1.5px solid var(--black); font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 700; color: var(--white); cursor: pointer; text-decoration: none; transition: all 0.15s; border-radius: 4px; white-space: nowrap; }
        .btn-cart:hover { background: #222; }
        .cart-badge { background: var(--accent); color: var(--black); font-size: 11px; font-weight: 800; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

        /* CAT NAV */
        .cat-nav { background: var(--black); }
        .cat-nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; gap: 4px; height: 44px; overflow-x: auto; }
        .cat-nav-inner::-webkit-scrollbar { display: none; }
        .cat-btn { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #aaa; background: transparent; border: none; padding: 8px 14px; cursor: pointer; white-space: nowrap; transition: color 0.15s; }
        .cat-btn:hover, .cat-btn.active { color: var(--white); }
        .cat-btn.active { color: var(--accent); }

        /* MAIN LAYOUT */
        .main-layout { max-width: 1280px; margin: 0 auto; padding: 28px 24px; }

        /* PRICE BADGE */
        .price-badge { display: inline-flex; align-items: center; gap: 8px; background: var(--black); color: var(--white); padding: 8px 16px; font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 24px; border-radius: 2px; }
        .price-badge span { background: var(--accent); color: var(--black); padding: 2px 8px; border-radius: 2px; }

        /* RESULTS BAR */
        .results-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .results-count { font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 600; color: var(--gray-4); letter-spacing: 0.04em; }

        /* PRODUCT GRID */
        .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }

        /* PRODUCT CARD */
        .product-card { background: var(--white); border: 1.5px solid var(--gray-2); border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; transition: box-shadow 0.2s, border-color 0.2s; }
        .product-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.12); border-color: #ccc; }
        .card-img { aspect-ratio: 1; background: var(--gray-1); position: relative; overflow: hidden; }
        .card-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s; }
        .product-card:hover .card-img img { transform: scale(1.04); }
        .card-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
        .card-cat-tag { position: absolute; top: 10px; left: 10px; background: var(--black); color: var(--white); font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; border-radius: 2px; }
        .card-stock-tag { position: absolute; top: 10px; right: 10px; font-family: 'Barlow', sans-serif; font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 2px; }
        .card-stock-ok { background: #e8f5e9; color: #2e7d32; }
        .card-stock-no { background: #fce4ec; color: #c62828; }

        .card-body { padding: 14px; flex: 1; display: flex; flex-direction: column; }
        .card-name { font-family: 'Barlow Condensed', sans-serif; font-size: 17px; font-weight: 700; line-height: 1.25; color: var(--black); margin-bottom: 6px; min-height: 44px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; letter-spacing: 0.01em; }
        .card-unit { font-size: 11px; color: var(--gray-3); font-weight: 500; margin-bottom: 12px; }
        .card-footer { margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
        .card-price-block {}
        .card-price-label { font-size: 10px; font-weight: 600; color: var(--gray-3); text-transform: uppercase; letter-spacing: 0.06em; }
        .card-price { font-family: 'Barlow Condensed', sans-serif; font-size: 26px; font-weight: 800; color: var(--black); line-height: 1; letter-spacing: -0.01em; }
        .btn-add { background: var(--black); color: var(--white); border: none; padding: 10px 16px; font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; border-radius: 4px; transition: background 0.15s; white-space: nowrap; flex-shrink: 0; }
        .btn-add:hover { background: #333; }
        .btn-add:disabled { background: var(--gray-2); color: var(--gray-3); cursor: not-allowed; }

        /* STATES */
        .loading-state { padding: 80px 0; text-align: center; }
        .loading-dots { display: flex; justify-content: center; gap: 8px; margin-bottom: 16px; }
        .loading-dot { width: 8px; height: 8px; background: var(--black); border-radius: 50%; animation: pulse 1.2s ease-in-out infinite; }
        .loading-dot:nth-child(2) { animation-delay: 0.2s; }
        .loading-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pulse { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
        .loading-text { font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: var(--gray-4); }

        .error-box { background: #fff5f5; border: 1.5px solid #ffcdd2; border-radius: 6px; padding: 16px 20px; margin-bottom: 20px; font-size: 14px; color: #c62828; display: flex; align-items: center; gap: 10px; }

        .empty-state { grid-column: 1/-1; padding: 80px 0; text-align: center; color: var(--gray-4); }
        .empty-state svg { opacity: 0.15; margin-bottom: 16px; }
        .empty-state p { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }

        /* FOOTER STRIP */
        .footer-strip { background: var(--black); color: #888; margin-top: 60px; padding: 20px 0; }
        .footer-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .footer-brand { font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 800; color: var(--white); letter-spacing: 0.05em; }
        .footer-links { display: flex; gap: 20px; font-size: 12px; }
        .footer-links a { color: #888; text-decoration: none; }
        .footer-links a:hover { color: var(--white); }
      `}</style>

      <div className="vj-store">

        {/* Top bar */}
        <div className="topbar">
          <div className="topbar-inner">
            <div className="topbar-left">
              <span><Truck size={12} /> Entrega en todo el país</span>
              <span><Shield size={12} /> Compra segura</span>
              <span><Package size={12} /> Stock en tiempo real</span>
            </div>
            <div className="topbar-right">
              <Link href="/tienda/login">Iniciar sesión</Link>
              {' · '}
              <Link href="/tienda/register">Crear cuenta</Link>
            </div>
          </div>
        </div>

        {/* Header */}
        <header className="header">
          <div className="header-inner">
            <Link href="/tienda" className="logo">
              <div className="logo-icon">
                <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
                  <polygon points="8,6 48,6 92,94 72,94 50,44 28,94 8,94" fill="white"/>
                  <polygon points="58,6 92,6 92,62 72,62 72,26 58,26" fill="white"/>
                </svg>
              </div>
              <div className="logo-text">
                <span className="logo-grupo">Grupo</span>
                <span className="logo-vj">VJ Distribuidora</span>
              </div>
            </Link>

            <div className="search-wrap">
              <Search className="search-icon" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto, marca o categoría..."
              />
            </div>

            <div className="nav-actions">
              <Link className="btn-account" href="/tienda/login">
                <UserRound size={16} />
                Mi cuenta
              </Link>
              <Link className="btn-cart" href="/tienda/carrito">
                <ShoppingCart size={16} />
                Carrito
                <span className="cart-badge">{cartCount}</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Category nav */}
        <nav className="cat-nav">
          <div className="cat-nav-inner">
            <button
              className={`cat-btn ${category === '' ? 'active' : ''}`}
              onClick={() => setCategory('')}
            >
              Todo el catálogo
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`cat-btn ${category === cat.slug ? 'active' : ''}`}
                onClick={() => setCategory(cat.slug)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </nav>

        {/* Main */}
        <main className="main-layout">
          <div className="price-badge">
            <Shield size={14} />
            Modalidad de precio: <span>{visibleLabel}</span>
          </div>

          {error && (
            <div className="error-box">
              <span>⚠</span> {error}
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <div className="loading-dots">
                <div className="loading-dot" />
                <div className="loading-dot" />
                <div className="loading-dot" />
              </div>
              <p className="loading-text">Cargando catálogo...</p>
            </div>
          ) : (
            <>
              <div className="results-bar">
                <span className="results-count">
                  {products.length} {products.length === 1 ? 'producto' : 'productos'}{category ? ` en ${categories.find(c => c.slug === category)?.name || category}` : ''}
                </span>
              </div>

              <div className="product-grid">
                {products.length === 0 && (
                  <div className="empty-state">
                    <Package size={48} />
                    <p>No se encontraron productos</p>
                  </div>
                )}

                {products.map((product) => (
                  <article className="product-card" key={product.id}>
                    <div className="card-img">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.imageUrl} alt={product.name} />
                      ) : (
                        <div className="card-img-placeholder">
                          <svg width="48" height="48" viewBox="0 0 100 100" fill="none" opacity="0.1">
                            <polygon points="8,6 48,6 92,94 72,94 50,44 28,94 8,94" fill="#000"/>
                            <polygon points="58,6 92,6 92,62 72,62 72,26 58,26" fill="#000"/>
                          </svg>
                        </div>
                      )}
                      {product.category?.name && (
                        <span className="card-cat-tag">{product.category.name}</span>
                      )}
                      <span className={`card-stock-tag ${product.canSell ? 'card-stock-ok' : 'card-stock-no'}`}>
                        {product.stockLabel}
                      </span>
                    </div>

                    <div className="card-body">
                      <h2 className="card-name">{product.name}</h2>
                      <p className="card-unit">{product.saleUnit === 'KG' ? 'Precio por kilogramo' : 'Precio por unidad'}</p>

                      <div className="card-footer">
                        <div className="card-price-block">
                          <p className="card-price-label">{visibleLabel}</p>
                          <p className="card-price">{formatMoney(product.price)}</p>
                        </div>
                        <button
                          disabled={!product.canSell}
                          onClick={() => add(product, 1)}
                          className="btn-add"
                        >
                          + Agregar
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </main>

        {/* Footer strip */}
        <div className="footer-strip">
          <div className="footer-inner">
            <span className="footer-brand">GRUPO VJ DISTRIBUIDORA</span>
            <div className="footer-links">
              <Link href="/tienda/login">Mi cuenta</Link>
              <Link href="/tienda/carrito">Carrito</Link>
              <Link href="/tienda/register">Registrarse</Link>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
