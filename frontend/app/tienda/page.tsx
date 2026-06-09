"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ShoppingCart,
  UserRound,
  Package,
  Lock,
  MapPin,
  ChevronDown,
  Store,
} from "lucide-react";
import {
  CatalogCategory,
  CatalogProduct,
  formatMoney,
  shopApi,
} from "@/lib/shop";
import { useCartStore } from "@/store/cart";
import Image from "next/image";
import toast from "react-hot-toast";

const HIDDEN_PRODUCT_SKUS = ["ENVIO-FLETE2"];
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type ShopAuthUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  client?: {
    id: string;
    nombre?: string | null;
    apellido?: string | null;
    category?: string | null;
  } | null;
};

async function getCurrentUser(): Promise<ShopAuthUser | null> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data?.content ?? data?.user ?? data ?? null;
  } catch {
    return null;
  }
}

function isVisibleCatalogProduct(product: CatalogProduct) {
  return !HIDDEN_PRODUCT_SKUS.includes(
    String(product.sku ?? "")
      .trim()
      .toUpperCase(),
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  const apiError = error as {
    response?: {
      data?: {
        message?: string;
        error?: string;
      };
    };
  };

  return (
    apiError.response?.data?.message ??
    apiError.response?.data?.error ??
    fallback
  );
}

async function fetchCategories() {
  return shopApi.getCategories();
}

async function fetchCatalogProducts(category: string, search: string) {
  return shopApi.getProducts({ category, search, limit: 80 });
}

export default function TiendaPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [customerCategory, setCustomerCategory] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<ShopAuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cartCount = useCartStore((state) => state.count());
  const add = useCartStore((state) => state.add);

  const storeSuffix = useMemo(() => {
    if (customerCategory === "Mayorista") return "Mayorista";
    if (customerCategory === "Cliente") return "Clientes";
    return "Minorista";
  }, [customerCategory]);

  const priceLabel = useMemo(() => {
    if (customerCategory === "Mayorista") return "Precio mayorista";
    if (customerCategory === "Cliente") return "Precio cliente";
    return "Precio público";
  }, [customerCategory]);

  const isLoggedIn = authChecked && Boolean(authUser);

  const accountLabel = useMemo(() => {
    if (!authUser) return "Ingresar";
    const clientName = [authUser.client?.nombre, authUser.client?.apellido]
      .filter(Boolean)
      .join(" ")
      .trim();
    return clientName || authUser.name || "Mi cuenta";
  }, [authUser]);

  const selectedCategoryName = useMemo(() => {
    if (!category) return "Todas las categorías";
    return categories.find((cat) => cat.slug === category)?.name ?? "Categoría";
  }, [category, categories]);

  useEffect(() => {
    let alive = true;

    getCurrentUser().then((user) => {
      if (!alive) return;

      setAuthUser(user);
      setCustomerCategory(user?.client?.category ?? null);
      setAuthChecked(true);
    });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    fetchCategories()
      .then((data) => {
        if (!alive) return;
        setCategories(data);
      })
      .catch((err) => {
        console.error(err);

        if (!alive) return;

        setCategories([]);
        toast.error("No se pudieron cargar las categorías");
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    fetchCatalogProducts(category, search)
      .then((result) => {
        if (!alive) return;

        setProducts(result.products.filter(isVisibleCatalogProduct));
        setCustomerCategory(
          result.customer?.category ?? authUser?.client?.category ?? null,
        );
        setError("");
      })
      .catch((err: unknown) => {
        console.error(err);

        if (!alive) return;

        const message = getErrorMessage(err, "No se pudo cargar la tienda");

        setProducts([]);
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [category, search, authUser?.client?.category]);

  const handleCategoryChange = (value: string) => {
    setLoading(true);
    setError("");
    setCategory(value);
  };

  const handleSearchChange = (value: string) => {
    setLoading(true);
    setError("");
    setSearch(value);
  };

  const handleAddToCart = (product: CatalogProduct) => {
    if (!isLoggedIn) {
      toast.error("Para agregar productos al carrito tenés que iniciar sesión");
      router.push("/tienda/login");
      return;
    }

    if (!product.canSell) {
      toast.error("Este producto no tiene stock disponible");
      return;
    }

    add(product, 1);
    toast.success("Producto agregado al carrito");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        :root {
          --bg: #f6f7f9;
          --white: #ffffff;
          --text: #111827;
          --muted: #6b7280;
          --soft: #9ca3af;
          --line: #e5e7eb;
          --line-strong: #d1d5db;
          --primary: #111827;
          --primary-hover: #030712;
          --green: #14b86a;
          --green-soft: #e9f9f1;
          --blue: #2563eb;
          --blue-soft: #eff6ff;
          --amber: #f59e0b;
          --amber-soft: #fffbeb;
          --red: #e11d48;
          --red-soft: #fff1f2;
          --shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
          --shadow-sm: 0 10px 28px rgba(15, 23, 42, 0.06);
          --radius: 18px;
        }

        *, *::before, *::after {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }

        .shop {
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        button,
        input {
          font-family: inherit;
        }

        a {
          color: inherit;
        }

        .topbar {
          background: var(--white);
          border-bottom: 1px solid var(--line);
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .topbar-inner {
          max-width: 1320px;
          height: 76px;
          margin: 0 auto;
          padding: 0 28px;
          display: flex;
          align-items: center;
          gap: 22px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          flex-shrink: 0;
        }

        .brand-mark {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          background: #111827;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-shadow: 0 12px 24px rgba(17, 24, 39, 0.18);
        }

        .brand-logo {
          width: 38px;
          height: auto;
          object-fit: contain;
          display: block;
        }

        .brand-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .brand-name {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--text);
          line-height: 1;
        }

        .brand-sub {
          font-size: 12px;
          color: var(--muted);
          font-weight: 500;
        }

        .brand-sub strong {
          color: var(--green);
          font-weight: 800;
        }

        .search-box {
          flex: 1;
          max-width: 560px;
          position: relative;
        }

        .search-box input {
          width: 100%;
          height: 46px;
          border: 1px solid var(--line);
          background: #f9fafb;
          border-radius: 999px;
          padding: 0 18px 0 46px;
          outline: none;
          font-size: 14px;
          color: var(--text);
          transition: 0.2s ease;
        }

        .search-box input::placeholder {
          color: var(--soft);
        }

        .search-box input:focus {
          background: var(--white);
          border-color: var(--primary);
          box-shadow: 0 0 0 4px rgba(17, 24, 39, 0.08);
        }

        .search-icon {
          position: absolute;
          left: 17px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--soft);
          width: 18px;
          height: 18px;
        }

        .header-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .header-btn {
          height: 42px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: var(--white);
          color: var(--text);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          transition: 0.18s ease;
          white-space: nowrap;
        }

        .header-btn:hover {
          border-color: var(--line-strong);
          background: #f9fafb;
        }

        .cart-btn {
          height: 42px;
          padding: 0 18px;
          border-radius: 999px;
          background: var(--primary);
          color: var(--white);
          border: 1px solid var(--primary);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          font-weight: 800;
          transition: 0.18s ease;
          white-space: nowrap;
        }

        .cart-btn:hover {
          background: var(--primary-hover);
          transform: translateY(-1px);
        }

        .cart-count {
          min-width: 21px;
          height: 21px;
          border-radius: 999px;
          background: var(--white);
          color: var(--primary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 900;
          padding: 0 6px;
        }

        .location-bar {
          background: var(--white);
          border-bottom: 1px solid var(--line);
        }

        .location-inner {
          max-width: 1320px;
          margin: 0 auto;
          padding: 10px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          color: var(--muted);
          font-size: 13px;
        }

        .location-left {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .location-left strong {
          color: var(--text);
          font-weight: 700;
        }

        .location-right {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--green);
          font-weight: 800;
        }

        .main {
          max-width: 1320px;
          margin: 0 auto;
          padding: 28px 28px 70px;
        }

        .login-banner {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 22px;
          padding: 18px 20px;
          margin-bottom: 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          box-shadow: var(--shadow-sm);
        }

        .login-banner-text {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.45;
        }

        .login-icon {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--blue-soft);
          color: var(--blue);
          flex-shrink: 0;
        }

        .login-banner-text strong {
          color: var(--text);
        }

        .login-banner-actions {
          display: flex;
          gap: 10px;
          flex-shrink: 0;
        }

        .login-primary {
          height: 40px;
          padding: 0 16px;
          border-radius: 999px;
          background: var(--primary);
          color: var(--white);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .login-secondary {
          height: 40px;
          padding: 0 16px;
          border-radius: 999px;
          background: var(--white);
          border: 1px solid var(--line);
          color: var(--text);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .content-layout {
          display: grid;
          grid-template-columns: 250px 1fr;
          gap: 22px;
          align-items: start;
        }

        .sidebar {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 24px;
          padding: 16px;
          position: sticky;
          top: 118px;
          box-shadow: var(--shadow-sm);
        }

        .sidebar-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
          padding: 0 4px;
          font-size: 13px;
          font-weight: 900;
          color: var(--text);
        }

        .cat-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .cat-btn {
          width: 100%;
          border: none;
          background: transparent;
          color: var(--muted);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-height: 40px;
          border-radius: 14px;
          padding: 0 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          text-align: left;
          transition: 0.16s ease;
        }

        .cat-btn:hover {
          background: #f9fafb;
          color: var(--text);
        }

        .cat-btn.active {
          background: var(--primary);
          color: var(--white);
        }

        .cat-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: currentColor;
          opacity: 0.5;
          flex-shrink: 0;
        }

        .catalog-area {
          min-width: 0;
        }

        .toolbar {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 22px;
          padding: 16px 18px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          box-shadow: var(--shadow-sm);
        }

        .toolbar-title {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .toolbar-title h2 {
          margin: 0;
          font-size: 18px;
          line-height: 1.2;
          letter-spacing: -0.03em;
          font-weight: 900;
          color: var(--text);
        }

        .toolbar-title span {
          color: var(--muted);
          font-size: 13px;
          font-weight: 600;
        }

        .toolbar-chips {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .chip {
          height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #f9fafb;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .chip strong {
          color: var(--green);
          font-weight: 900;
        }

        .mobile-categories {
          display: none;
          position: relative;
          margin-bottom: 14px;
        }

        .mobile-categories select {
          width: 100%;
          height: 46px;
          border-radius: 16px;
          border: 1px solid var(--line);
          background: var(--white);
          color: var(--text);
          padding: 0 42px 0 14px;
          font-weight: 800;
          font-size: 13px;
          appearance: none;
          outline: none;
        }

        .mobile-categories svg {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--muted);
          pointer-events: none;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 16px;
        }

        .card {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 24px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: 100%;
          transition: 0.22s ease;
          box-shadow: 0 4px 18px rgba(15, 23, 42, 0.035);
        }

        .card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow);
          border-color: var(--line-strong);
        }

        .card-img {
          position: relative;
          aspect-ratio: 1 / 1;
          background: linear-gradient(135deg, #f9fafb 0%, #eef2f7 100%);
          overflow: hidden;
        }

        .card-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: 0.45s ease;
        }

        .card:hover .card-img img {
          transform: scale(1.045);
        }

        .card-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #d1d5db;
        }

        .tag-cat {
          position: absolute;
          top: 12px;
          left: 12px;
          max-width: calc(100% - 24px);
          border-radius: 999px;
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(229,231,235,0.9);
          backdrop-filter: blur(10px);
          padding: 6px 10px;
          color: var(--text);
          font-size: 11px;
          line-height: 1;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .stock-badge {
          position: absolute;
          right: 12px;
          bottom: 12px;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          line-height: 1;
          font-weight: 900;
          backdrop-filter: blur(10px);
        }

        .stock-badge.in {
          background: rgba(233,249,241,0.96);
          color: var(--green);
          border: 1px solid rgba(20,184,106,0.18);
        }

        .stock-badge.out {
          background: rgba(255,241,242,0.96);
          color: var(--red);
          border: 1px solid rgba(225,29,72,0.16);
        }

        .card-body {
          padding: 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .card-name {
          margin: 0;
          color: var(--text);
          font-size: 15px;
          line-height: 1.35;
          font-weight: 850;
          letter-spacing: -0.025em;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 40px;
        }

        .card-unit {
          margin: 7px 0 14px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }

        .card-footer {
          margin-top: auto;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
        }

        .price-block {
          min-width: 0;
        }

        .price-label {
          margin: 0 0 4px;
          color: var(--muted);
          font-size: 11px;
          font-weight: 800;
        }

        .price {
          margin: 0;
          color: var(--text);
          font-size: 22px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.045em;
        }

        .out-price {
          margin: 0;
          color: var(--red);
          font-size: 14px;
          font-weight: 900;
        }

        .add-btn {
          width: 42px;
          height: 42px;
          border-radius: 15px;
          border: none;
          background: var(--primary);
          color: var(--white);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          transition: 0.16s ease;
          flex-shrink: 0;
        }

        .add-btn:hover {
          background: var(--primary-hover);
          transform: translateY(-1px);
        }

        .add-btn:disabled {
          background: #e5e7eb;
          color: #9ca3af;
          cursor: not-allowed;
          transform: none;
        }

        .lock-btn {
          width: 42px;
          height: 42px;
          border-radius: 15px;
          border: 1px solid var(--line);
          background: #f9fafb;
          color: var(--muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          transition: 0.16s ease;
          flex-shrink: 0;
        }

        .lock-btn:hover {
          color: var(--text);
          border-color: var(--line-strong);
          background: var(--white);
        }

        .err-box {
          background: var(--red-soft);
          color: var(--red);
          border: 1px solid rgba(225,29,72,0.15);
          border-radius: 18px;
          padding: 14px 16px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 700;
        }

        .loading-wrap {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 24px;
          min-height: 340px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          color: var(--muted);
          box-shadow: var(--shadow-sm);
        }

        .spinner {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: 3px solid #e5e7eb;
          border-top-color: var(--primary);
          animation: spin 0.75s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .loading-label {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .empty {
          grid-column: 1 / -1;
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 24px;
          padding: 76px 24px;
          text-align: center;
          color: var(--muted);
          box-shadow: var(--shadow-sm);
        }

        .empty svg {
          color: var(--soft);
          margin-bottom: 12px;
        }

        .empty p {
          margin: 0;
          color: var(--text);
          font-size: 17px;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .empty small {
          display: block;
          margin-top: 6px;
          color: var(--muted);
          font-weight: 600;
        }

        .footer {
          background: var(--white);
          border-top: 1px solid var(--line);
          margin-top: 30px;
        }

        .footer-inner {
          max-width: 1320px;
          margin: 0 auto;
          padding: 26px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          flex-wrap: wrap;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 950;
          letter-spacing: -0.03em;
        }

        .footer-mark {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: #111827;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .footer-logo {
          width: 25px;
          height: auto;
          object-fit: contain;
          display: block;
        }

        .footer-links {
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
        }

        .footer-links a {
          color: var(--muted);
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
        }

        .footer-links a:hover {
          color: var(--text);
        }

        @media (max-width: 980px) {
          .topbar-inner {
            height: auto;
            padding: 16px 18px;
            flex-wrap: wrap;
            gap: 14px;
          }

          .brand {
            order: 1;
          }

          .header-actions {
            order: 2;
            margin-left: auto;
          }

          .search-box {
            order: 3;
            flex-basis: 100%;
            max-width: none;
          }

          .location-inner {
            padding: 10px 18px;
            align-items: flex-start;
            flex-direction: column;
            gap: 6px;
          }

          .main {
            padding: 20px 18px 56px;
          }

          .content-layout {
            grid-template-columns: 1fr;
          }

          .sidebar {
            display: none;
          }

          .mobile-categories {
            display: block;
          }

          .toolbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .toolbar-chips {
            justify-content: flex-start;
          }
        }

        @media (max-width: 640px) {
          .brand-name {
            font-size: 15px;
          }

          .brand-sub {
            font-size: 11px;
          }

          .header-btn {
            width: 42px;
            padding: 0;
            justify-content: center;
          }

          .header-btn span {
            display: none;
          }

          .cart-btn {
            width: 42px;
            padding: 0;
            justify-content: center;
            position: relative;
          }

          .cart-btn span:not(.cart-count) {
            display: none;
          }

          .cart-count {
            position: absolute;
            top: -6px;
            right: -6px;
            background: var(--green);
            color: var(--white);
            border: 2px solid var(--white);
            min-width: 20px;
            height: 20px;
            font-size: 10px;
          }

          .login-banner {
            flex-direction: column;
            align-items: stretch;
          }

          .login-banner-actions {
            width: 100%;
          }

          .login-primary,
          .login-secondary {
            flex: 1;
          }

          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .card {
            border-radius: 18px;
          }

          .card-body {
            padding: 12px;
          }

          .card-name {
            font-size: 13px;
            min-height: 36px;
          }

          .price {
            font-size: 18px;
          }

          .add-btn,
          .lock-btn {
            width: 38px;
            height: 38px;
            border-radius: 13px;
          }

          .tag-cat {
            font-size: 10px;
            padding: 5px 8px;
          }

          .stock-badge {
            font-size: 10px;
            padding: 6px 8px;
          }
            .seo-title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

        }
      `}</style>

      <div className="shop">
        
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/tienda" className="brand">
              <div className="brand-mark">
                <Image
                  src="/logo-vj-white-transparent.png"
                  alt="Grupo VJ"
                  width={120}
                  height={120}
                  className="brand-logo"
                  priority
                />
              </div>

              <div className="brand-text">
                <span className="brand-name">Grupo VJ</span>
                <span className="brand-sub">
                  Tienda <strong>{storeSuffix}</strong>
                </span>
              </div>
            </Link>

            <div className="search-box">
              <Search className="search-icon" />
              <input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar productos, marcas o categorías..."
              />
            </div>

            <div className="header-actions">
              <Link
                className="header-btn"
                href={isLoggedIn ? "/tienda/cuenta" : "/tienda/login"}
              >
                <UserRound size={16} />
                <span>{accountLabel}</span>
              </Link>

              {isLoggedIn && (
                <Link className="cart-btn" href="/tienda/carrito">
                  <ShoppingCart size={16} />
                  <span>Carrito</span>
                  <span className="cart-count">{cartCount}</span>
                </Link>
              )}
            </div>
          </div>
        </header>

        <div className="location-bar">
          <div className="location-inner">
            <div className="location-left">
              <MapPin size={14} />
              <span>
                Retiro y atención en{" "}
                <strong>Paso de los Andes 893, Córdoba</strong>
              </span>
            </div>

            <div className="location-right">
              <Store size={14} />
              Stock actualizado
            </div>
          </div>
        </div>

        <main className="main">
          {authChecked && !isLoggedIn && (
            <div className="login-banner">
              <div className="login-banner-text">
                <div className="login-icon">
                  <Lock size={18} />
                </div>

                <span>
                  Estás navegando como visitante. Para comprar y ver condiciones
                  comerciales, ingresá con tu cuenta.
                </span>
              </div>

              <div className="login-banner-actions">
                <Link href="/tienda/login" className="login-primary">
                  Iniciar sesión
                </Link>
              </div>
            </div>
          )}

          {error && <div className="err-box">⚠ {error}</div>}

          <div className="mobile-categories">
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
            <ChevronDown size={18} />
          </div>

          <div className="content-layout">
            <aside className="sidebar">
              <div className="sidebar-title">
                <span>Categorías</span>
                <ChevronDown size={15} />
              </div>

              <div className="cat-list">
                <button
                  className={`cat-btn ${category === "" ? "active" : ""}`}
                  onClick={() => handleCategoryChange("")}
                >
                  <span>Todas</span>
                  <span className="cat-dot" />
                </button>

                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    className={`cat-btn ${category === cat.slug ? "active" : ""}`}
                    onClick={() => handleCategoryChange(cat.slug)}
                  >
                    <span>{cat.name}</span>
                    <span className="cat-dot" />
                  </button>
                ))}
              </div>
            </aside>

            <section className="catalog-area">
              {loading ? (
                <div className="loading-wrap">
                  <div className="spinner" />
                  <span className="loading-label">Cargando catálogo</span>
                </div>
              ) : (
                <>
                  <div className="toolbar">
                    <div className="toolbar-title">
                      <h2>{selectedCategoryName}</h2>
                      <span>
                        {products.length}{" "}
                        {products.length === 1
                          ? "producto encontrado"
                          : "productos encontrados"}
                      </span>
                    </div>

                    <div className="toolbar-chips">
                      <div className="chip">
                        Lista: <strong>{storeSuffix}</strong>
                      </div>

                      <div className="chip">
                        Precio: <strong>{priceLabel}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="grid">
                    {products.length === 0 && (
                      <div className="empty">
                        <Package size={42} />
                        <p>No se encontraron productos</p>
                        <small>
                          Probá cambiando la búsqueda o seleccionando otra
                          categoría.
                        </small>
                      </div>
                    )}

                    {products.map((product) => (
                      <article className="card" key={product.id}>
                        <div className="card-img">
                          {product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.imageUrl} alt={product.name} />
                          ) : (
                            <div className="card-placeholder">
                              <Package size={42} />
                            </div>
                          )}

                          {product.category?.name && (
                            <span className="tag-cat">
                              {product.category.name}
                            </span>
                          )}

                          {product.canSell ? (
                            <span className="stock-badge in">
                              {product.stockLabel}
                            </span>
                          ) : (
                            <span className="stock-badge out">
                              {product.stockLabel}
                            </span>
                          )}
                        </div>

                        <div className="card-body">
                          <h2 className="card-name">{product.name}</h2>

                          <p className="card-unit">
                            {product.saleUnit === "KG"
                              ? "Venta por kilogramo"
                              : "Venta por unidad"}
                          </p>

                          <div className="card-footer">
                            <div className="price-block">
                              <p className="price-label">{priceLabel}</p>

                              {product.canSell ? (
                                <p className="price">
                                  {formatMoney(product.price)}
                                </p>
                              ) : (
                                <p className="out-price">Agotado</p>
                              )}
                            </div>

                            {!isLoggedIn ? (
                              <Link
                                href="/tienda/login"
                                className="lock-btn"
                                title="Iniciar sesión"
                              >
                                <Lock size={16} />
                              </Link>
                            ) : (
                              <button
                                disabled={!product.canSell}
                                onClick={() => handleAddToCart(product)}
                                className="add-btn"
                                title="Agregar al carrito"
                              >
                                +
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        </main>

        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <div className="footer-mark">
                <Image
                  src="/logo-vj-white-transparent.png"
                  alt="Grupo VJ"
                  width={80}
                  height={80}
                  className="footer-logo"
                />
              </div>
              GRUPO VJ
            </div>

           <h1 className="seo-title">
    Grupo VJ - Tienda de bebidas en Córdoba
  </h1>
            <div className="footer-links">
              <Link href={isLoggedIn ? "/tienda/cuenta" : "/tienda/login"}>
                {isLoggedIn ? "Mi cuenta" : "Login"}
              </Link>
              <Link href="/tienda/carrito">Carrito</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
