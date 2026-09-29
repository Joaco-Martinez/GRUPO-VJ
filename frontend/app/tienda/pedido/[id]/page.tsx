"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  formatMoney,
  shopApi,
  type CatalogProduct,
  type ShopOrder,
} from "@/lib/shop";
import { useShopAuth } from "@/context/ShopAuthContext";
import { formatDateTimeAR } from "@/lib/dateAR";

type DraftLine = {
  productId: string;
  name: string;
  saleUnit: "UNIT" | "KG";
  quantity: number;
  price: number;
  max: number;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function productMax(product: CatalogProduct | null | undefined) {
  if (!product) return 0;
  return Number(
    product.saleUnit === "KG" ? product.availableKg : product.availableQuantity,
  ) || 0;
}

function formatQty(line: Pick<DraftLine, "saleUnit">, value: number) {
  if (line.saleUnit === "KG") return `${round2(value).toLocaleString("es-AR")} kg`;
  const units = Math.trunc(value);
  return `${units} unidad${units === 1 ? "" : "es"}`;
}

function linesFromOrder(order: ShopOrder): DraftLine[] {
  return order.items.map((item) => ({
    productId: item.productId,
    name: item.name,
    saleUnit: item.saleUnit,
    quantity: item.quantity,
    price: item.price,
    // Si el producto ya no existe, al menos se puede mantener lo que tenía.
    max: Math.max(productMax(item.product), item.quantity),
  }));
}

function sameLines(a: DraftLine[], b: DraftLine[]) {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((line) => [line.productId, line.quantity]));
  return a.every((line) => byId.get(line.productId) === line.quantity);
}

export default function EditarPedidoPage() {
  const params = useParams<{ id: string }>();
  const orderId = String(params?.id ?? "");
  const router = useRouter();
  const { user, loading } = useShopAuth();

  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CatalogProduct[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!loading && !user?.id) router.replace("/tienda/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user?.id || !orderId) return;

    let alive = true;

    async function loadOrder() {
      setLoadingOrder(true);
      setLoadError("");

      try {
        const data = await shopApi.getOrder(orderId);
        if (!alive) return;
        setOrder(data);
        setLines(linesFromOrder(data));
      } catch (err: unknown) {
        if (!alive) return;
        setLoadError(
          err instanceof Error ? err.message : "No se pudo cargar el pedido",
        );
      } finally {
        if (alive) setLoadingOrder(false);
      }
    }

    loadOrder();

    return () => {
      alive = false;
    };
  }, [loading, user, orderId]);

  useEffect(() => {
    const term = search.trim();

    if (term.length < 2) return;

    let alive = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await shopApi.getProducts({ search: term, limit: 8 });
        if (alive) setResults(data.products ?? []);
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 300);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search]);

  const visibleResults = search.trim().length >= 2 ? results : [];
  const editable = Boolean(order?.editable);
  const originalLines = useMemo(
    () => (order ? linesFromOrder(order) : []),
    [order],
  );
  const dirty = !sameLines(lines, originalLines);

  const extrasTotal = useMemo(
    () =>
      (order?.extras ?? []).reduce(
        (acc, extra) => acc + Number(extra.subtotal || 0),
        0,
      ),
    [order],
  );

  const estimatedTotal = useMemo(
    () =>
      round2(
        lines.reduce((acc, line) => acc + line.price * line.quantity, 0) +
          extrasTotal,
      ),
    [lines, extrasTotal],
  );

  function setLineQuantity(productId: string, value: number) {
    const line = lines.find((l) => l.productId === productId);
    if (!line) return;

    const min = line.saleUnit === "KG" ? 0.1 : 1;
    let next = line.saleUnit === "KG" ? round2(value) : Math.trunc(value);

    if (!Number.isFinite(next) || next < min) next = min;

    if (next > line.max) {
      toast.error(
        `De ${line.name} solo hay ${formatQty(line, line.max)} disponibles.`,
      );
      next = line.max;
    }

    setLines((current) =>
      current.map((l) =>
        l.productId === productId ? { ...l, quantity: next } : l,
      ),
    );
  }

  function stepLine(line: DraftLine, direction: 1 | -1) {
    const step = line.saleUnit === "KG" ? 0.1 : 1;
    setLineQuantity(line.productId, round2(line.quantity + step * direction));
  }

  function removeLine(productId: string) {
    setLines((current) => current.filter((l) => l.productId !== productId));
  }

  function addProduct(product: CatalogProduct) {
    const existing = lines.find((line) => line.productId === product.id);

    if (existing) {
      stepLine(existing, 1);
      return;
    }

    // Si el producto estaba en el pedido original (y se quitó), su
    // disponibilidad incluye lo que el pedido ya tenía reservado.
    const original = order?.items.find((item) => item.productId === product.id);
    const max = original
      ? Math.max(productMax(original.product), original.quantity)
      : productMax(product);

    if (!product.canSell && !original) {
      toast.error(`${product.name} no tiene stock disponible.`);
      return;
    }

    const quantity = product.saleUnit === "KG" ? Math.min(1, max) : 1;

    if (max <= 0 || quantity > max) {
      toast.error(`${product.name} no tiene stock disponible.`);
      return;
    }

    setLines((current) => [
      ...current,
      {
        productId: product.id,
        name: product.name,
        saleUnit: product.saleUnit,
        quantity,
        price: original ? original.price : product.price,
        max,
      },
    ]);

    toast.success(`${product.name} agregado al pedido`);
  }

  async function handleSave() {
    if (!order || saving) return;

    if (lines.length === 0) {
      toast.error("El pedido tiene que tener al menos un producto.");
      return;
    }

    setSaving(true);

    try {
      const updated = await shopApi.updateOrder(order.id, {
        items: lines.map((line) =>
          line.saleUnit === "KG"
            ? { productId: line.productId, quantityKg: line.quantity }
            : { productId: line.productId, quantity: line.quantity },
        ),
      });

      setOrder(updated);
      setLines(linesFromOrder(updated));
      toast.success("Pedido actualizado");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo actualizar el pedido",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{`
        .order-page {
          min-height: 100vh;
          background: #f6f7f9;
          color: #111827;
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .order-main {
          max-width: 920px;
          margin: 0 auto;
          padding: 28px 16px 60px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #6b7280;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          width: fit-content;
        }

        .card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 24px;
          padding: 20px;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
        }

        .card h1, .card h2 {
          margin: 0;
          letter-spacing: -0.03em;
        }

        .card h1 { font-size: 24px; font-weight: 900; }
        .card h2 { font-size: 17px; font-weight: 900; }

        .muted {
          margin: 6px 0 0;
          color: #6b7280;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.5;
        }

        .notice {
          margin-top: 14px;
          border-radius: 16px;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 700;
          background: #fff1f2;
          color: #e11d48;
        }

        .notice.info {
          background: #eff6ff;
          color: #2563eb;
        }

        .lines {
          margin-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .line {
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 12px 14px;
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 12px;
          align-items: center;
        }

        .line-name {
          margin: 0;
          font-size: 14px;
          font-weight: 800;
        }

        .line-meta {
          margin: 4px 0 0;
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
        }

        .stepper {
          display: inline-flex;
          align-items: center;
          border: 1px solid #d1d5db;
          border-radius: 999px;
          overflow: hidden;
        }

        .stepper button {
          border: 0;
          background: #fff;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .stepper button:disabled { opacity: 0.35; cursor: not-allowed; }

        .stepper input {
          width: 64px;
          border: 0;
          text-align: center;
          font-size: 14px;
          font-weight: 800;
          font-family: inherit;
          outline: none;
        }

        .line-right {
          display: flex;
          align-items: center;
          gap: 10px;
          white-space: nowrap;
          font-weight: 900;
        }

        .icon-btn {
          border: 0;
          background: #fff1f2;
          color: #e11d48;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .extra {
          display: flex;
          justify-content: space-between;
          color: #6b7280;
          font-size: 13px;
          font-weight: 700;
          padding: 0 4px;
        }

        .search-box {
          margin-top: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #d1d5db;
          border-radius: 999px;
          padding: 0 14px;
          background: #fff;
        }

        .search-box input {
          flex: 1;
          border: 0;
          height: 44px;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          background: transparent;
          min-width: 0;
        }

        .result {
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .add-btn, .save-btn {
          border: 0;
          border-radius: 999px;
          background: #111827;
          color: #fff;
          font-family: inherit;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .add-btn { padding: 8px 12px; font-size: 12px; }
        .add-btn:disabled, .save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }

        .summary strong {
          display: block;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .save-btn { padding: 13px 22px; font-size: 14px; }

        @media (max-width: 640px) {
          .line { grid-template-columns: 1fr; }
          .line-right { justify-content: space-between; }
          .save-btn { width: 100%; justify-content: center; }
        }
      `}</style>

      <div className="order-page">
        <main className="order-main">
          <Link href="/tienda/cuenta" className="back-link">
            <ArrowLeft size={16} />
            Volver a mi cuenta
          </Link>

          {loading || loadingOrder ? (
            <div className="card">Cargando pedido...</div>
          ) : loadError || !order ? (
            <div className="card">
              <h1>No pudimos abrir el pedido</h1>
              <div className="notice">{loadError || "Pedido no encontrado"}</div>
            </div>
          ) : (
            <>
              <section className="card">
                <h1>Pedido #{order.id.slice(0, 8)}</h1>
                <p className="muted">
                  {formatDateTimeAR(order.createdAt)} · Total actual{" "}
                  {formatMoney(order.total)}
                </p>

                {editable ? (
                  <div className="notice info">
                    Tu pedido todavía está pendiente: podés sumar productos,
                    cambiar cantidades o quitar lo que no necesites. Vamos a
                    revisar el stock al guardar.
                  </div>
                ) : (
                  <div className="notice">
                    {order.blockReason ?? "Este pedido no se puede modificar."}
                  </div>
                )}
              </section>

              <section className="card">
                <h2>Productos del pedido</h2>

                <div className="lines">
                  {lines.length === 0 && (
                    <p className="muted">
                      No quedan productos. Agregá al menos uno para guardar.
                    </p>
                  )}

                  {lines.map((line) => {
                    const step = line.saleUnit === "KG" ? 0.1 : 1;

                    return (
                      <div className="line" key={line.productId}>
                        <div>
                          <p className="line-name">{line.name}</p>
                          <p className="line-meta">
                            {formatMoney(line.price)}
                            {line.saleUnit === "KG" ? " / kg" : " c/u"}
                            {editable &&
                              ` · Máx. ${formatQty(line, line.max)}`}
                          </p>
                        </div>

                        {editable ? (
                          <div className="stepper">
                            <button
                              type="button"
                              onClick={() => stepLine(line, -1)}
                              disabled={line.quantity <= step}
                              aria-label="Restar"
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="number"
                              min={step}
                              max={line.max}
                              step={step}
                              value={line.quantity}
                              onChange={(e) =>
                                setLineQuantity(
                                  line.productId,
                                  Number(e.target.value),
                                )
                              }
                            />
                            <button
                              type="button"
                              onClick={() => stepLine(line, 1)}
                              disabled={line.quantity + step > line.max + 1e-9}
                              aria-label="Sumar"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className="line-meta">
                            {formatQty(line, line.quantity)}
                          </span>
                        )}

                        <div className="line-right">
                          {formatMoney(line.price * line.quantity)}
                          {editable && (
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => removeLine(line.productId)}
                              aria-label={`Quitar ${line.name}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {order.extras.map((extra) => (
                    <div className="extra" key={extra.id}>
                      <span>{extra.name}</span>
                      <span>{formatMoney(extra.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </section>

              {editable && (
                <section className="card">
                  <h2>Agregar productos</h2>
                  <p className="muted">
                    Buscá productos de la tienda para sumarlos a este pedido.
                  </p>

                  <div className="search-box">
                    <Search size={16} color="#6b7280" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por nombre o código..."
                    />
                  </div>

                  <div className="lines">
                    {searching && visibleResults.length === 0 && (
                      <p className="muted">Buscando...</p>
                    )}

                    {!searching &&
                      search.trim().length >= 2 &&
                      visibleResults.length === 0 && (
                        <p className="muted">No encontramos productos.</p>
                      )}

                    {visibleResults.map((product) => {
                      const inOrder = lines.find(
                        (line) => line.productId === product.id,
                      );
                      const wasInOrder = order.items.some(
                        (item) => item.productId === product.id,
                      );
                      const atMax =
                        inOrder &&
                        inOrder.quantity +
                          (product.saleUnit === "KG" ? 0.1 : 1) >
                          inOrder.max + 1e-9;
                      const disabled =
                        (!product.canSell && !wasInOrder) || Boolean(atMax);

                      return (
                        <div className="result" key={product.id}>
                          <div>
                            <p className="line-name">{product.name}</p>
                            <p className="line-meta">
                              {formatMoney(product.price)}
                              {product.saleUnit === "KG" ? " / kg" : " c/u"} ·{" "}
                              {product.stockLabel}
                            </p>
                          </div>

                          <button
                            type="button"
                            className="add-btn"
                            disabled={disabled}
                            onClick={() => addProduct(product)}
                          >
                            <Plus size={13} />
                            {inOrder ? "Sumar" : "Agregar"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="card summary">
                <div>
                  <span className="muted">
                    {editable && dirty ? "Total estimado" : "Total"}
                  </span>
                  <strong>
                    {formatMoney(editable && dirty ? estimatedTotal : order.total)}
                  </strong>
                  {editable && dirty && (
                    <p className="muted">
                      Los precios se confirman con la lista vigente al guardar.
                    </p>
                  )}
                </div>

                {editable && (
                  <button
                    type="button"
                    className="save-btn"
                    onClick={handleSave}
                    disabled={!dirty || saving || lines.length === 0}
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}
