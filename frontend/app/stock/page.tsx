"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import type { MovementLocation, Product, StockMovement } from "@/types";
import { fmtDate, normalizeArray, num } from "@/lib/helpers";
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  BarChart2,
  Search,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

type StockMode = "ADD" | "TRANSFER";
type MobileTab = "stock" | "movements";

type StockForm = {
  productId: string;
  from: MovementLocation;
  to: MovementLocation;
  location: MovementLocation;
  quantity: string;
  quantityKg: string;
  mode: StockMode;
};

const emptyForm: StockForm = {
  productId: "",
  from: "LOCAL",
  to: "DEPOSITO",
  location: "LOCAL",
  quantity: "",
  quantityKg: "",
  mode: "ADD",
};

const MOBILE_STOCK_PAGE_SIZE = 8;
const MOBILE_MOVEMENTS_PAGE_SIZE = 12;

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })
      ?.response?.data?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })
      ?.response?.data?.error ??
    fallback
  );
}

async function fetchStockData() {
  const [p, m] = await Promise.all([
    api.get("/products"),
    api.get("/products/movements").catch(() => ({ data: [] })),
  ]);

  return {
    products: normalizeArray<Product>(p.data),
    movements: normalizeArray<StockMovement>(m.data),
  };
}

function movementIcon(type?: string) {
  if (type === "SALE") {
    return <ArrowUpCircle size={14} style={{ color: "var(--danger)" }} />;
  }

  if (type === "TRANSFER") {
    return <ArrowLeftRight size={14} style={{ color: "var(--accent2)" }} />;
  }

  return <ArrowDownCircle size={14} style={{ color: "var(--accent)" }} />;
}

type ProductComponentLike = {
  quantity?: number | null;
  quantityKg?: number | null;
  component?: Product | null;
};

type ProductWithComponents = Product & {
  components?: ProductComponentLike[];
};

type StockLocationKey = "LOCAL" | "DEPOSITO";

function isCompositeProduct(product: Product) {
  const productWithComponents = product as ProductWithComponents;

  return (
    product.type === "COMPUESTO" &&
    Array.isArray(productWithComponents.components) &&
    productWithComponents.components.length > 0
  );
}

function getProductMinStock(product: Product, location: StockLocationKey) {
  if (product.saleUnit === "KG") {
    return location === "DEPOSITO"
      ? num((product as any).minStockDepositoKg)
      : num(product.minStockKg);
  }

  return location === "DEPOSITO"
    ? num((product as any).minStockDeposito)
    : num(product.minStock);
}

function getSimpleProductStock(
  product: Product,
  location: StockLocationKey,
  useKg: boolean,
) {
  if (location === "LOCAL") {
    return useKg ? num(product.stockLocalKg) : num(product.stockLocal);
  }

  return useKg ? num(product.stockDepositoKg) : num(product.stockDeposito);
}

function getComponentRequiredAmount(component: ProductComponentLike) {
  const quantityKg = num(component.quantityKg);
  const quantity = num(component.quantity);

  if (quantityKg > 0) {
    return {
      amount: quantityKg,
      useKg: true,
    };
  }

  return {
    amount: quantity,
    useKg: false,
  };
}

function getCompositeAvailableStock(
  product: Product,
  location: StockLocationKey,
) {
  const components = (product as ProductWithComponents).components ?? [];

  if (!components.length) return 0;

  let available = Number.POSITIVE_INFINITY;

  for (const item of components) {
    const componentProduct = item.component;

    if (!componentProduct) return 0;

    const required = getComponentRequiredAmount(item);

    if (required.amount <= 0) continue;

    const componentStock = getSimpleProductStock(
      componentProduct,
      location,
      required.useKg,
    );
    const possibleUnits = Math.floor(componentStock / required.amount);

    available = Math.min(available, possibleUnits);
  }

  if (!Number.isFinite(available)) return 0;

  return Math.max(0, available);
}

function getProductStockByLocation(
  product: Product,
  location: StockLocationKey,
) {
  if (isCompositeProduct(product)) {
    return getCompositeAvailableStock(product, location);
  }

  return getSimpleProductStock(product, location, product.saleUnit === "KG");
}

function getProductLocalStock(product: Product) {
  return getProductStockByLocation(product, "LOCAL");
}

function getProductDepositoStock(product: Product) {
  return getProductStockByLocation(product, "DEPOSITO");
}

function getStockUnit(product: Product) {
  if (isCompositeProduct(product)) return " promos";

  return product.saleUnit === "KG" ? " kg" : "";
}

function isLowStock(stock: number, min: number) {
  return min > 0 && stock <= min;
}

function getStockStatus(localLow: boolean, depositoLow: boolean) {
  if (localLow && depositoLow) return "BAJO EN AMBOS";
  if (localLow) return "BAJO EN MAYORISTA";
  if (depositoLow) return "BAJO EN MINORISTA";
  return "OK";
}

function getStockLowDetail(localLow: boolean, depositoLow: boolean) {
  if (localLow && depositoLow) return "Bajo de stock en Mayorista y Minorista";
  if (localLow) return "Bajo de stock en Mayorista";
  if (depositoLow) return "Bajo de stock en Minorista";
  return "Stock correcto en ambos depósitos";
}

function getStockBadgeClass(localLow: boolean, depositoLow: boolean) {
  return localLow || depositoLow ? "badge-red" : "badge-green";
}

function movementLocationLabel(location?: MovementLocation | null) {
  if (location === "LOCAL") return "Mayorista";
  if (location === "DEPOSITO") return "Minorista";
  return "—";
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<StockForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("stock");
  const [mobileStockPage, setMobileStockPage] = useState(1);
  const [mobileMovementsPage, setMobileMovementsPage] = useState(1);

  const load = async (showSuccess = false) => {
    setLoading(true);

    try {
      const data = await fetchStockData();

      setProducts(data.products);
      setMovements(data.movements);

      if (showSuccess) {
        toast.success("Stock actualizado correctamente");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar stock");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    fetchStockData()
      .then((data) => {
        if (!alive) return;

        setProducts(data.products);
        setMovements(data.movements);
      })
      .catch((e) => {
        console.error(e);

        if (!alive) return;

        toast.error("Error al cargar stock");
      })
      .finally(() => {
        if (!alive) return;

        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          !search ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          String(p.sku ?? "")
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [products, search],
  );

  const mobileStockTotalPages = Math.max(
    1,
    Math.ceil(filtered.length / MOBILE_STOCK_PAGE_SIZE),
  );
  const mobileMovementsTotalPages = Math.max(
    1,
    Math.ceil(movements.length / MOBILE_MOVEMENTS_PAGE_SIZE),
  );

  const safeMobileStockPage = Math.min(
    Math.max(1, mobileStockPage),
    mobileStockTotalPages,
  );
  const safeMobileMovementsPage = Math.min(
    Math.max(1, mobileMovementsPage),
    mobileMovementsTotalPages,
  );

  const mobileStockItems = filtered.slice(
    (safeMobileStockPage - 1) * MOBILE_STOCK_PAGE_SIZE,
    safeMobileStockPage * MOBILE_STOCK_PAGE_SIZE,
  );

  const mobileMovementItems = movements.slice(
    (safeMobileMovementsPage - 1) * MOBILE_MOVEMENTS_PAGE_SIZE,
    safeMobileMovementsPage * MOBILE_MOVEMENTS_PAGE_SIZE,
  );

  const lowStockCount = products.filter((p) => {
    const localMin = getProductMinStock(p, "LOCAL");
    const depositoMin = getProductMinStock(p, "DEPOSITO");

    return (
      isLowStock(getProductLocalStock(p), localMin) ||
      isLowStock(getProductDepositoStock(p), depositoMin)
    );
  }).length;


  const selected = products.find((p) => p.id === form.productId);

  const save = async () => {
    if (!selected) {
      toast.error("Seleccioná un producto");
      return;
    }

    const quantity = num(form.quantity);
    const quantityKg = num(form.quantityKg);
    const isKg = selected.saleUnit === "KG";
    const isTransfer = form.mode === "TRANSFER";

    if (isKg && quantityKg <= 0) {
      toast.error("Ingresá una cantidad válida en kg");
      return;
    }

    if (!isKg && quantity <= 0) {
      toast.error("Ingresá una cantidad válida");
      return;
    }

    if (isTransfer && form.from === form.to) {
      toast.error("El origen y el destino no pueden ser iguales");
      return;
    }

    setSaving(true);

    const toastId = toast.loading(
      isTransfer ? "Transfiriendo stock..." : "Agregando stock...",
    );

    try {
      if (isTransfer) {
        if (isKg) {
          await api.post(`/products/${selected.id}/transfer-kg`, {
            from: form.from,
            to: form.to,
            quantityKg,
          });
        } else {
          await api.post("/products/transfer", {
            productId: selected.id,
            from: form.from,
            to: form.to,
            quantity,
          });
        }
      } else {
        if (isKg) {
          await api.post(`/products/${selected.id}/add-stock-kg`, {
            to: form.location,
            quantityKg,
          });
        } else {
          await api.post("/products/add-stock", {
            productId: selected.id,
            to: form.location,
            quantity,
          });
        }
      }

      setForm(emptyForm);
      setMobileSheetOpen(false);

      toast.success(
        isTransfer
          ? "Stock transferido correctamente"
          : "Stock agregado correctamente",
        { id: toastId },
      );

      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Error al mover stock"), { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const stockFormContent = (
    <div
      className="stock-form-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 0.9fr 1fr 1fr auto",
        gap: 10,
        alignItems: "end",
      }}
    >
      <div>
        <label className="form-label">Producto</label>

        <select
          value={form.productId}
          onChange={(e) =>
            setForm((p) => ({ ...p, productId: e.target.value }))
          }
          disabled={saving}
        >
          <option value="">Seleccionar...</option>

          {products
            .filter((p) => p.type === "SIMPLE" && !p.isService)
            .map((p) => {
              const local = getProductLocalStock(p);
              const deposito = getProductDepositoStock(p);
              const unit = getStockUnit(p);

              return (
                <option key={p.id} value={p.id}>
                  {p.name} · Mayorista: {local}
                  {unit} · Minorista: {deposito}
                  {unit}
                </option>
              );
            })}
        </select>
      </div>

      <div>
        <label className="form-label">Operación</label>

        <select
          value={form.mode}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              mode: e.target.value as StockMode,
            }))
          }
          disabled={saving}
        >
          <option value="ADD">Agregar</option>
          <option value="TRANSFER">Transferir</option>
        </select>
      </div>

      {form.mode === "TRANSFER" ? (
        <>
          <div>
            <label className="form-label">Desde</label>

            <select
              value={form.from}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  from: e.target.value as MovementLocation,
                }))
              }
              disabled={saving}
            >
              <option value="LOCAL">Mayorista</option>
              <option value="DEPOSITO">Minorista</option>
            </select>
          </div>

          <div>
            <label className="form-label">Hacia</label>

            <select
              value={form.to}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  to: e.target.value as MovementLocation,
                }))
              }
              disabled={saving}
            >
              <option value="LOCAL">Mayorista</option>
              <option value="DEPOSITO">Minorista</option>
            </select>
          </div>
        </>
      ) : (
        <div className="stock-location-field">
          <label className="form-label">Destino</label>

          <select
            value={form.location}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                location: e.target.value as MovementLocation,
              }))
            }
            disabled={saving}
          >
            <option value="LOCAL">Mayorista</option>
            <option value="DEPOSITO">Minorista</option>
          </select>
        </div>
      )}

      <div>
        <label className="form-label">
          Cantidad {selected?.saleUnit === "KG" ? "kg" : ""}
        </label>

        <input
          type="number"
          min="0"
          step={selected?.saleUnit === "KG" ? "0.001" : "1"}
          value={selected?.saleUnit === "KG" ? form.quantityKg : form.quantity}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              [selected?.saleUnit === "KG" ? "quantityKg" : "quantity"]:
                e.target.value,
            }))
          }
          disabled={saving}
        />
      </div>

      <button
        className="btn btn-primary stock-submit-btn"
        onClick={save}
        disabled={saving || !selected}
      >
        {saving ? (
          <span className="spinner" />
        ) : form.mode === "TRANSFER" ? (
          <>
            <ArrowLeftRight size={14} /> Transferir
          </>
        ) : (
          "Agregar stock"
        )}
      </button>
    </div>
  );

  return (
    <AppLayout
      title="Stock"
      subtitle="Inventario mayorista, minorista y movimientos"
    >
      <div className="stock-mobile-summary">
        <div className="stock-mobile-summary-grid">
          <div>
            <small>Productos</small>
            <b>{products.length}</b>
          </div>

          <div>
            <small>Stock bajo</small>
            <b className={lowStockCount > 0 ? "stock-danger" : ""}>
              {lowStockCount}
            </b>
          </div>

          <div>
            <small>Movimientos</small>
            <b>{movements.length}</b>
          </div>
        </div>

        <button
          className="btn btn-primary stock-mobile-open-sheet"
          onClick={() => setMobileSheetOpen(true)}
        >
          {form.mode === "TRANSFER" ? (
            <ArrowLeftRight size={15} />
          ) : (
            <ArrowDownCircle size={15} />
          )}
          Mover stock
        </button>
      </div>

      <div className="stock-mobile-tabs">
        <button
          type="button"
          className={mobileTab === "stock" ? "is-active" : ""}
          onClick={() => setMobileTab("stock")}
        >
          Inventario
        </button>

        <button
          type="button"
          className={mobileTab === "movements" ? "is-active" : ""}
          onClick={() => setMobileTab("movements")}
        >
          Movimientos
        </button>
      </div>

      <div
        className="card stock-form-card"
        style={{ padding: 16, marginBottom: 18 }}
      >
        {stockFormContent}
      </div>

      <div
        className="stock-search"
        style={{ position: "relative", marginBottom: 18, maxWidth: 420 }}
      >
        <Search
          size={14}
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text3)",
          }}
        />

        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setMobileStockPage(1);
          }}
          placeholder="Buscar producto..."
          style={{ paddingLeft: 34 }}
        />
      </div>

      <div
        className="card stock-card stock-inventory-card"
        style={{ marginBottom: 18 }}
      >
        <div className="table-wrap stock-desktop-table">
          {loading ? (
            <div style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 200 }} />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Unidad</th>
                  <th>Mayorista</th>
                  <th>Minorista</th>
                  <th>Mín. Mayorista</th>
                  <th>Mín. Minorista</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((p) => {
                  const local = getProductLocalStock(p);
                  const deposito = getProductDepositoStock(p);
                  const localMin = getProductMinStock(p, "LOCAL");
                  const depositoMin = getProductMinStock(p, "DEPOSITO");
                  const unit = getStockUnit(p);

                  const localLow = isLowStock(local, localMin);
                  const depositoLow = isLowStock(deposito, depositoMin);
                  const status = getStockStatus(localLow, depositoLow);
                  const badgeClass = getStockBadgeClass(localLow, depositoLow);

                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="stock-product-name">
                          <b>{p.name}</b>

                          {isCompositeProduct(p) && (
                            <span className="stock-product-note">
                              Promo calculada por componentes
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ fontFamily: "var(--mono)" }}>
                        {p.sku || "—"}
                      </td>

                      <td>
                        <span className="badge badge-gray">
                          {isCompositeProduct(p) ? "PROMO" : p.saleUnit}
                        </span>
                      </td>

                      <td
                        style={{
                          fontFamily: "var(--mono)",
                          color: localLow ? "var(--danger)" : "var(--text)",
                          fontWeight: localLow ? 900 : 500,
                        }}
                      >
                        {local}
                        {unit}
                      </td>

                      <td
                        style={{
                          fontFamily: "var(--mono)",
                          color: depositoLow ? "var(--danger)" : "var(--text)",
                          fontWeight: depositoLow ? 900 : 500,
                        }}
                      >
                        {deposito}
                        {unit}
                      </td>

                      <td>
                        {localMin}
                        {unit}
                      </td>

                      <td>
                        {depositoMin}
                        {unit}
                      </td>

                      <td>
                        <div className="stock-status-cell">
                          <span className={`badge ${badgeClass}`}>
                            {status}
                          </span>

                          {(localLow || depositoLow) && (
                            <small className="stock-low-detail">
                              {getStockLowDetail(localLow, depositoLow)}
                            </small>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <BarChart2 size={36} />
              <p>Sin productos</p>
            </div>
          )}
        </div>

        <div className="stock-mobile-list">
          {loading ? (
            <div style={{ padding: 10 }}>
              <div
                className="skeleton"
                style={{ height: 170, borderRadius: 16 }}
              />
            </div>
          ) : (
            mobileStockItems.map((p) => {
              const local = getProductLocalStock(p);
              const deposito = getProductDepositoStock(p);
              const localMin = getProductMinStock(p, "LOCAL");
              const depositoMin = getProductMinStock(p, "DEPOSITO");
              const unit = getStockUnit(p);

              const localLow = isLowStock(local, localMin);
              const depositoLow = isLowStock(deposito, depositoMin);
              const status = getStockStatus(localLow, depositoLow);
              const badgeClass = getStockBadgeClass(localLow, depositoLow);

              return (
                <article className="stock-mobile-item" key={p.id}>
                  <div className="stock-mobile-head">
                    <div>
                      <h3>{p.name}</h3>
                      <span>
                        {p.sku || "Sin SKU"} ·{" "}
                        {isCompositeProduct(p) ? "PROMO" : p.saleUnit} · Mín. May.{" "}
                        {localMin}
                        {unit} · Mín. Min. {depositoMin}
                        {unit}
                      </span>
                    </div>

                    <span className={`badge ${badgeClass}`}>{status}</span>
                  </div>

                  {(localLow || depositoLow) && (
                    <div className="stock-mobile-alert">
                      {getStockLowDetail(localLow, depositoLow)}
                    </div>
                  )}

                  {isCompositeProduct(p) && (
                    <div className="stock-mobile-chip-row">
                      <span className="badge badge-gray">
                        Stock por componentes
                      </span>
                    </div>
                  )}

                  <div className="stock-mobile-data">
                    <div>
                      <small>Mayorista</small>
                      <strong className={localLow ? "stock-danger" : ""}>
                        {local}
                        {unit}
                      </strong>
                    </div>

                    <div>
                      <small>Minorista</small>
                      <strong className={depositoLow ? "stock-danger" : ""}>
                        {deposito}
                        {unit}
                      </strong>
                    </div>
                  </div>
                </article>
              );
            })
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <BarChart2 size={36} />
              <p>Sin productos</p>
            </div>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="stock-mobile-pagination">
            <span>
              Página {safeMobileStockPage} de {mobileStockTotalPages} ·{" "}
              {filtered.length} productos
            </span>

            <div>
              <button
                className="btn btn-secondary btn-sm"
                disabled={safeMobileStockPage === 1}
                onClick={() =>
                  setMobileStockPage((prev) => Math.max(1, prev - 1))
                }
              >
                Anterior
              </button>

              <button
                className="btn btn-secondary btn-sm"
                disabled={safeMobileStockPage === mobileStockTotalPages}
                onClick={() =>
                  setMobileStockPage((prev) =>
                    Math.min(mobileStockTotalPages, prev + 1),
                  )
                }
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card stock-card stock-movements-card">
        <div
          className="stock-card-title"
          style={{
            padding: 16,
            borderBottom: "1px solid var(--border)",
            fontWeight: 800,
          }}
        >
          Movimientos recientes
        </div>

        <div className="table-wrap stock-desktop-table">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Desde</th>
                <th>Hacia</th>
                <th>Cantidad</th>
                <th>Referencia</th>
              </tr>
            </thead>

            <tbody>
              {movements.slice(0, 80).map((m) => (
                <tr key={m.id}>
                  <td>{fmtDate(m.createdAt)}</td>

                  <td>{m.product?.name ?? m.productId}</td>

                  <td>
                    <span
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      {movementIcon(m.type)}
                      {m.type}
                    </span>
                  </td>

                  <td>{movementLocationLabel(m.from)}</td>

                  <td>{movementLocationLabel(m.to)}</td>

                  <td style={{ fontFamily: "var(--mono)" }}>
                    {m.quantityKg ? `${m.quantityKg} kg` : (m.quantity ?? "—")}
                  </td>

                  <td>{m.reason ?? m.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!movements.length && !loading && (
            <div className="empty-state">
              <BarChart2 size={36} />
              <p>Sin movimientos</p>
            </div>
          )}
        </div>

        <div className="stock-mobile-list stock-movements-mobile-list">
          {mobileMovementItems.map((m) => (
            <article
              className="stock-mobile-item stock-mobile-movement-item"
              key={m.id}
            >
              <div className="stock-mobile-head">
                <div>
                  <h3>{m.product?.name ?? m.productId}</h3>
                  <span>{fmtDate(m.createdAt)}</span>
                </div>

                <span className="stock-movement-type">
                  {movementIcon(m.type)}
                  {m.type}
                </span>
              </div>

              <div className="stock-mobile-data stock-mobile-movement-data">
                <div>
                  <small>Desde</small>
                  <strong>{movementLocationLabel(m.from)}</strong>
                </div>

                <div>
                  <small>Hacia</small>
                  <strong>{movementLocationLabel(m.to)}</strong>
                </div>

                <div>
                  <small>Cantidad</small>
                  <strong>
                    {m.quantityKg ? `${m.quantityKg} kg` : (m.quantity ?? "—")}
                  </strong>
                </div>

                <div>
                  <small>Referencia</small>
                  <strong>{m.reason ?? m.reference ?? "—"}</strong>
                </div>
              </div>
            </article>
          ))}

          {!movements.length && !loading && (
            <div className="empty-state">
              <BarChart2 size={36} />
              <p>Sin movimientos</p>
            </div>
          )}
        </div>

        {!loading && movements.length > 0 && (
          <div className="stock-mobile-pagination">
            <span>
              Página {safeMobileMovementsPage} de {mobileMovementsTotalPages} ·{" "}
              {movements.length} movimientos
            </span>

            <div>
              <button
                className="btn btn-secondary btn-sm"
                disabled={safeMobileMovementsPage === 1}
                onClick={() =>
                  setMobileMovementsPage((prev) => Math.max(1, prev - 1))
                }
              >
                Anterior
              </button>

              <button
                className="btn btn-secondary btn-sm"
                disabled={safeMobileMovementsPage === mobileMovementsTotalPages}
                onClick={() =>
                  setMobileMovementsPage((prev) =>
                    Math.min(mobileMovementsTotalPages, prev + 1),
                  )
                }
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {mobileSheetOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="stock-mobile-sheet-backdrop"
            onClick={() => !saving && setMobileSheetOpen(false)}
          >
            <div
              className="stock-mobile-sheet"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="stock-mobile-sheet-handle" />

              <div className="stock-mobile-sheet-header">
                <div>
                  <b>Mover stock</b>
                  <small>Agregá o transferí inventario rápido.</small>
                </div>

                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => !saving && setMobileSheetOpen(false)}
                  disabled={saving}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="stock-mobile-sheet-body">{stockFormContent}</div>
            </div>
          </div>,
          document.body,
        )}

      <style jsx global>{`
        .stock-mobile-list,
        .stock-mobile-summary,
        .stock-mobile-tabs,
        .stock-mobile-pagination {
          display: none;
        }

        .stock-location-field {
          grid-column: auto;
        }

        .stock-product-name {
          display: grid;
          gap: 4px;
        }

        .stock-product-note {
          color: var(--text3);
          font-size: 11px;
          font-weight: 800;
        }

        .stock-status-cell {
          display: grid;
          gap: 5px;
          align-items: start;
        }

        .stock-low-detail {
          color: var(--danger);
          font-size: 11px;
          font-weight: 800;
          line-height: 1.2;
        }

        .stock-mobile-alert {
          border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
          background: color-mix(in srgb, var(--danger) 10%, transparent);
          color: var(--danger);
          border-radius: 10px;
          padding: 6px 8px;
          font-size: 11px;
          font-weight: 900;
          line-height: 1.25;
        }

        @media (max-width: 1200px) {
          .stock-form-grid {
            grid-template-columns: 1.5fr 1fr 1fr !important;
          }

          .stock-submit-btn {
            grid-column: 1 / -1;
            width: 100%;
            justify-content: center;
          }

          .stock-location-field {
            grid-column: auto;
          }
        }

        @media (max-width: 768px) {
          .stock-mobile-summary {
            display: grid;
            gap: 10px;
            margin-bottom: 10px;
          }

          .stock-mobile-summary-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
          }

          .stock-mobile-summary-grid > div {
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--surface2);
            padding: 8px;
            min-width: 0;
          }

          .stock-mobile-summary-grid small {
            display: block;
            color: var(--text3);
            font-size: 9.5px;
            font-weight: 900;
            margin-bottom: 3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .stock-mobile-summary-grid b {
            display: block;
            color: var(--text);
            font-family: var(--mono);
            font-size: 16px;
            line-height: 1;
          }

          .stock-mobile-open-sheet {
            width: 100%;
            min-height: 40px;
            justify-content: center;
          }

          .stock-mobile-tabs {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 10px;
            position: sticky;
            top: 0;
            z-index: 5;
            background: var(--bg);
            padding: 2px 0 8px;
          }

          .stock-mobile-tabs button {
            border: 1px solid var(--border);
            border-radius: 999px;
            min-height: 34px;
            background: var(--surface2);
            color: var(--text2);
            font-size: 12px;
            font-weight: 900;
          }

          .stock-mobile-tabs button.is-active {
            border-color: var(--accent);
            color: var(--accent);
            background: color-mix(in srgb, var(--accent) 12%, var(--surface));
          }

          .stock-form-card {
            display: none;
          }

          .stock-search {
            max-width: none !important;
            width: 100%;
            margin-bottom: 10px !important;
          }

          .stock-search input {
            width: 100%;
            height: 38px;
            min-height: 38px;
            font-size: 13px;
          }

          .stock-card {
            border-radius: 18px;
            overflow: hidden;
          }

          .stock-card-title {
            padding: 12px !important;
            font-size: 13px;
          }

          .stock-desktop-table {
            display: none;
          }

          .stock-inventory-card {
            display: ${mobileTab === "stock" ? "block" : "none"};
          }

          .stock-movements-card {
            display: ${mobileTab === "movements" ? "block" : "none"};
          }

          .stock-mobile-list {
            display: grid;
            gap: 7px;
            padding: 8px;
          }

          .stock-mobile-item {
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--surface2);
            padding: 9px;
            display: grid;
            gap: 8px;
            min-width: 0;
          }

          .stock-mobile-head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 8px;
            min-width: 0;
          }

          .stock-mobile-head > div {
            min-width: 0;
            display: grid;
            gap: 3px;
          }

          .stock-mobile-head h3 {
            font-size: 13px;
            line-height: 1.2;
            font-weight: 900;
            color: var(--text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .stock-mobile-head span:not(.badge):not(.stock-movement-type) {
            color: var(--text3);
            font-size: 10.5px;
            font-family: var(--mono);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .stock-mobile-head > .badge {
            flex-shrink: 0;
            font-size: 9px;
            padding: 4px 6px;
            max-width: 112px;
            white-space: normal;
            text-align: center;
            line-height: 1.05;
          }

          .stock-mobile-chip-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }

          .stock-mobile-chip-row .badge {
            font-size: 9px;
            padding: 4px 6px;
          }

          .stock-mobile-data {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
          }

          .stock-mobile-data > div {
            display: grid;
            gap: 3px;
            border-radius: 11px;
            background: var(--bg);
            padding: 7px 8px;
            min-width: 0;
          }

          .stock-mobile-data small {
            color: var(--text3);
            font-size: 9.5px;
            font-weight: 900;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .stock-mobile-data strong {
            font-family: var(--mono);
            font-size: 12px;
            line-height: 1.15;
            color: var(--text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .stock-danger {
            color: var(--danger) !important;
          }

          .stock-movement-type {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 10px;
            font-weight: 900;
            color: var(--text2);
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 4px 7px;
            flex-shrink: 0;
          }

          .stock-movements-mobile-list {
            padding-top: 8px;
          }

          .stock-mobile-movement-data {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .stock-mobile-pagination {
            display: grid;
            gap: 8px;
            padding: 9px 10px 10px;
            border-top: 1px solid var(--border);
            background: var(--surface);
          }

          .stock-mobile-pagination span {
            text-align: center;
            color: var(--text3);
            font-size: 11px;
            font-weight: 900;
          }

          .stock-mobile-pagination > div {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .stock-mobile-pagination button {
            width: 100%;
            justify-content: center;
          }

          .stock-mobile-sheet-backdrop {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            background: rgba(0, 0, 0, 0.48);
          }

          .stock-mobile-sheet {
            width: 100%;
            height: auto;
            max-height: min(92dvh, 680px);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            border-radius: 22px 22px 0 0;
            border: 1px solid var(--border);
            background: var(--surface);
            box-shadow: 0 -18px 60px rgba(0, 0, 0, 0.35);
          }

          .stock-mobile-sheet-handle {
            width: 44px;
            height: 4px;
            border-radius: 999px;
            background: var(--border);
            margin: 10px auto 8px;
            flex-shrink: 0;
          }

          .stock-mobile-sheet-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding: 0 14px 12px;
            border-bottom: 1px solid var(--border);
            flex-shrink: 0;
          }

          .stock-mobile-sheet-header b {
            display: block;
            color: var(--text);
            font-size: 15px;
            line-height: 1.2;
          }

          .stock-mobile-sheet-header small {
            display: block;
            margin-top: 3px;
            color: var(--text3);
            font-size: 11px;
            line-height: 1.25;
          }

          .stock-mobile-sheet-body {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 12px 14px calc(14px + env(safe-area-inset-bottom));
            -webkit-overflow-scrolling: touch;
          }

          .stock-mobile-sheet-body .stock-form-grid {
            display: flex !important;
            flex-direction: column !important;
            grid-template-columns: none !important;
            gap: 10px !important;
            align-items: stretch !important;
            width: 100% !important;
            min-width: 0 !important;
          }

          .stock-mobile-sheet-body .stock-form-grid > div {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--surface2);
            padding: 10px;
          }

          .stock-mobile-sheet-body .stock-form-grid label {
            display: block;
            margin-bottom: 6px;
            font-size: 10px;
            letter-spacing: 0.08em;
            color: var(--text3);
          }

          .stock-mobile-sheet-body .stock-submit-btn {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            min-height: 46px;
            justify-content: center;
            grid-column: auto !important;
            border-radius: 14px;
            margin-top: 2px;
          }

          .stock-mobile-sheet-body select,
          .stock-mobile-sheet-body input {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            min-height: 42px;
            font-size: 14px;
          }

          .stock-mobile-sheet-body select {
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }

        @media (max-width: 420px) {
          .stock-mobile-summary-grid {
            gap: 6px;
          }

          .stock-mobile-summary-grid > div {
            padding: 7px;
            border-radius: 12px;
          }

          .stock-mobile-list {
            padding: 7px;
          }

          .stock-mobile-item {
            padding: 8px;
            border-radius: 13px;
          }

          .stock-mobile-head {
            align-items: flex-start;
          }

          .stock-mobile-head h3 {
            font-size: 12.5px;
          }

          .stock-mobile-data > div {
            padding: 6px 7px;
          }

          .stock-mobile-data strong {
            font-size: 11px;
          }

          .stock-mobile-sheet {
            max-height: 94dvh;
          }
        }
      `}</style>

      <style jsx global>{`
        @media (max-width: 768px) {
          body:has(.stock-mobile-sheet-backdrop) {
            overflow: hidden;
          }

          .stock-mobile-sheet-backdrop {
            position: fixed !important;
            inset: 0 !important;
            z-index: 2147483000 !important;
            display: flex !important;
            align-items: flex-end !important;
            justify-content: center !important;
            background: rgba(0, 0, 0, 0.55) !important;
            padding: 0 !important;
          }

          .stock-mobile-sheet {
            width: 100% !important;
            max-width: 100vw !important;
            height: auto !important;
            max-height: min(92dvh, 680px) !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            border-radius: 22px 22px 0 0 !important;
            border: 1px solid var(--border) !important;
            background: var(--surface) !important;
            box-shadow: 0 -18px 60px rgba(0, 0, 0, 0.45) !important;
          }

          .stock-mobile-sheet-handle {
            width: 44px !important;
            height: 4px !important;
            border-radius: 999px !important;
            background: var(--border) !important;
            margin: 10px auto 8px !important;
            flex-shrink: 0 !important;
          }

          .stock-mobile-sheet-header {
            display: flex !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
            gap: 12px !important;
            padding: 0 14px 12px !important;
            border-bottom: 1px solid var(--border) !important;
            flex-shrink: 0 !important;
          }

          .stock-mobile-sheet-header b {
            display: block !important;
            color: var(--text) !important;
            font-size: 15px !important;
            line-height: 1.2 !important;
          }

          .stock-mobile-sheet-header small {
            display: block !important;
            margin-top: 3px !important;
            color: var(--text3) !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
          }

          .stock-mobile-sheet-body {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            padding: 12px 14px calc(14px + env(safe-area-inset-bottom)) !important;
            -webkit-overflow-scrolling: touch !important;
          }

          .stock-mobile-sheet-body .stock-form-grid {
            display: flex !important;
            flex-direction: column !important;
            grid-template-columns: none !important;
            gap: 10px !important;
            align-items: stretch !important;
            width: 100% !important;
            min-width: 0 !important;
          }

          .stock-mobile-sheet-body .stock-form-grid > div {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            border: 1px solid var(--border) !important;
            border-radius: 14px !important;
            background: var(--surface2) !important;
            padding: 10px !important;
          }

          .stock-mobile-sheet-body .stock-form-grid label {
            display: block !important;
            margin-bottom: 6px !important;
            font-size: 10px !important;
            letter-spacing: 0.08em !important;
            color: var(--text3) !important;
          }

          .stock-mobile-sheet-body select,
          .stock-mobile-sheet-body input {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            min-height: 42px !important;
            font-size: 14px !important;
          }

          .stock-mobile-sheet-body select {
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          .stock-mobile-sheet-body .stock-submit-btn {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            min-height: 46px !important;
            justify-content: center !important;
            grid-column: auto !important;
            border-radius: 14px !important;
            margin-top: 2px !important;
          }
        }
      `}</style>

    </AppLayout>
  );
}
