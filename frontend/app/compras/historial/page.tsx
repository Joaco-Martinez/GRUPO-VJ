/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { fmtMoney, num } from "@/lib/helpers";
import { formatDateAR, formatDateTimeAR, toDateInputAR } from "@/lib/dateAR";
import type { PaymentMethod, Product, Provider } from "@/types";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Eye,
  FileText,
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Warehouse,
  X,
  XCircle,
} from "lucide-react";

const editPaymentMethods: PaymentMethod[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "TARJETA",
  "DEBITO",
  "CREDITO",
  "QR",
  "QR_MERCADOPAGO",
  "QR_NACION",
];

const DELIVERY_SKU = "ENVIO-FLETE2";

function isEditableProduct(product?: Product | null) {
  if (!product) return false;
  if (product.isActive === false) return false;
  if (product.isService) return false;
  if (product.type === "COMPUESTO") return false;
  if (String(product.sku ?? "").trim().toUpperCase() === DELIVERY_SKU) return false;
  return true;
}

type EditItem = {
  productId: string;
  name: string;
  sku: string;
  saleUnit: string;
  quantity: number;
  quantityKg: number;
  unitCost: number;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

const PAGE_SIZE = 12;

type PurchaseItemView = {
  id?: string;
  productId?: string | null;
  productNameSnapshot?: string | null;
  product?: {
    id?: string;
    name?: string | null;
    sku?: string | null;
    saleUnit?: string | null;
  } | null;
  quantity?: number | null;
  quantityKg?: number | null;
  unitCost?: number | null;
  price?: number | null;
  subtotal?: number | null;
  total?: number | null;
};

type PurchaseView = {
  id: string;
  status?: string | null;
  providerName?: string | null;
  providerId?: string | null;
  provider?: Provider | null;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  documentNumber?: string | null;
  description?: string | null;
  paymentMethod?: string | null;
  to?: string | null;
  stockLocation?: string | null;
  location?: string | null;
  date?: string | null;
  purchaseDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  total?: number | null;
  amount?: number | null;
  items?: PurchaseItemView[];
  purchaseItems?: PurchaseItemView[];
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
  userName?: string | null;
};

type PurchasesFetchResult = {
  items: PurchaseView[];
  serverPaginated: boolean;
  totalItems: number;
  totalPages: number;
  page: number;
};

function normalizeArray<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (Array.isArray(data?.items)) return data.items as T[];
  if (Array.isArray(data?.purchases)) return data.purchases as T[];
  if (Array.isArray(data?.data)) return data.data as T[];
  if (Array.isArray(data?.results)) return data.results as T[];
  if (Array.isArray(data?.rows)) return data.rows as T[];
  return [];
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;

    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.error ??
    (error as { message?: string })?.message ??
    fallback
  );
}

function safeNum(value: number | string | null | undefined, fallback?: number | string | null) {
  const parsedValue =
    value === null || value === undefined || value === "" ? undefined : Number(value);

  const parsedFallback =
    fallback === null || fallback === undefined || fallback === "" ? undefined : Number(fallback);

  return num(
    Number.isFinite(parsedValue) ? parsedValue : undefined,
    Number.isFinite(parsedFallback) ? parsedFallback : undefined
  );
}

function fmtDate(value?: string | null) {
  const result = formatDateAR(value);
  return result === "—" ? "Sin fecha" : result;
}

function fmtDateTime(value?: string | null) {
  const result = formatDateTimeAR(value);
  return result === "—" ? "Sin fecha" : result;
}

function getPurchaseDate(purchase: PurchaseView) {
  return purchase.date || purchase.purchaseDate || purchase.createdAt || null;
}

function getProviderName(purchase: PurchaseView) {
  return purchase.providerName || purchase.supplierName || "Sin proveedor";
}

function getInvoiceNumber(purchase: PurchaseView) {
  return purchase.invoiceNumber || purchase.documentNumber || "—";
}

function getPurchaseItems(purchase: PurchaseView) {
  return purchase.items || purchase.purchaseItems || [];
}

function getItemName(item: PurchaseItemView) {
  return item.productNameSnapshot || item.product?.name || "Producto";
}

function getItemSku(item: PurchaseItemView) {
  return item.product?.sku || "SIN-SKU";
}

function getItemUnitCost(item: PurchaseItemView) {
  return safeNum(item.unitCost, item.price);
}

function getItemQty(item: PurchaseItemView) {
  const quantityKg = safeNum(item.quantityKg);

  if (quantityKg > 0) {
    return {
      label: `${quantityKg.toLocaleString("es-AR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      })} kg`,
      value: quantityKg,
    };
  }

  const quantity = safeNum(item.quantity, 1);
  return {
    label: String(quantity),
    value: quantity,
  };
}

function getItemSubtotal(item: PurchaseItemView) {
  const subtotal = safeNum(item.subtotal, item.total);

  if (subtotal > 0) return subtotal;

  return getItemUnitCost(item) * getItemQty(item).value;
}

function getPurchaseTotal(purchase: PurchaseView) {
  const directTotal = safeNum(purchase.total, purchase.amount);

  if (directTotal > 0) return directTotal;

  return getPurchaseItems(purchase).reduce((acc, item) => acc + getItemSubtotal(item), 0);
}

function getLocationLabel(purchase: PurchaseView) {
  const location = String(purchase.to || purchase.stockLocation || purchase.location || "").toUpperCase();

  if (location === "LOCAL") return "Mayorista";
  if (location === "DEPOSITO") return "Minorista";

  return "Sin dato";
}

function getLocationBadgeClass(purchase: PurchaseView) {
  const location = String(purchase.to || purchase.stockLocation || purchase.location || "").toUpperCase();

  if (location === "LOCAL") return "badge-green";
  if (location === "DEPOSITO") return "badge-yellow";

  return "badge-gray";
}

function getUserLabel(purchase: PurchaseView) {
  return purchase.user?.name || purchase.userName || purchase.user?.email || "Sin usuario";
}

function normalizePurchasesFetchResponse(data: any, fallbackPage: number): PurchasesFetchResult {
  const items = normalizeArray<PurchaseView>(data);
  const meta = data?.meta ?? data?.pagination ?? data;

  const totalItems = firstNumber(meta?.totalItems, meta?.total, meta?.count, items.length);
  const totalPages = Math.max(
    1,
    firstNumber(meta?.totalPages, meta?.pages, Math.ceil(totalItems / PAGE_SIZE)),
  );
  const page = Math.max(1, firstNumber(meta?.page, meta?.currentPage, fallbackPage));

  return {
    items,
    serverPaginated: Boolean(data?.meta || data?.pagination || meta?.total || meta?.totalItems || meta?.count),
    totalItems,
    totalPages,
    page,
  };
}

async function fetchPurchases(params?: {
  page?: number;
  limit?: number;
  search?: string;
  from?: string;
  to?: string;
}) {
  const response = await api.get("/purchases", { params });
  return normalizePurchasesFetchResponse(response.data, params?.page ?? 1);
}

export default function ComprasHistorialPage() {
  const [purchases, setPurchases] = useState<PurchaseView[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [serverPaginated, setServerPaginated] = useState(false);
  const [serverTotalItems, setServerTotalItems] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);

  const [detail, setDetail] = useState<PurchaseView | null>(null);

  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [editProviderId, setEditProviderId] = useState("");
  const [editProvider, setEditProvider] = useState("");
  const [editInvoice, setEditInvoice] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>("EFECTIVO");
  const [editDate, setEditDate] = useState("");
  const [editItems, setEditItems] = useState<EditItem[]>([]);

  const [addProductQuery, setAddProductQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);

  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, fromDate, toDate]);

  const load = useCallback(
    async (showSuccess = false) => {
      setLoading(true);

      try {
        const result = await fetchPurchases({
          page: currentPage,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        });

        setPurchases(result.items);
        setServerPaginated(result.serverPaginated);
        setServerTotalItems(result.totalItems);
        setServerTotalPages(result.totalPages);

        if (showSuccess) toast.success("Historial actualizado");
      } catch (error) {
        console.error(error);
        toast.error(getErrorMessage(error, "No se pudo cargar el historial de compras"));
      } finally {
        setLoading(false);
      }
    },
    [currentPage, debouncedSearch, fromDate, toDate],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (serverPaginated) return purchases;

    const q = debouncedSearch.toLowerCase();

    return purchases.filter((purchase) => {
      const purchaseDate = getPurchaseDate(purchase);
      const dateOnly = purchaseDate ? new Date(purchaseDate).toISOString().slice(0, 10) : "";

      const matchesSearch =
        !q ||
        purchase.id.toLowerCase().includes(q) ||
        getProviderName(purchase).toLowerCase().includes(q) ||
        getInvoiceNumber(purchase).toLowerCase().includes(q) ||
        getPurchaseItems(purchase).some((item) =>
          `${getItemName(item)} ${getItemSku(item)}`.toLowerCase().includes(q),
        );

      const matchesFrom = !fromDate || !dateOnly || dateOnly >= fromDate;
      const matchesTo = !toDate || !dateOnly || dateOnly <= toDate;

      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [purchases, debouncedSearch, fromDate, toDate, serverPaginated]);

  const totalPages = serverPaginated
    ? serverTotalPages
    : Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paginatedPurchases = useMemo(() => {
    if (serverPaginated) return filtered;

    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage, serverPaginated]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const totalFilteredItems = serverPaginated ? serverTotalItems : filtered.length;
  const pageStart = totalFilteredItems ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, totalFilteredItems);

  const summaryTotal = filtered.reduce((acc, purchase) => acc + getPurchaseTotal(purchase), 0);
  const summaryProducts = filtered.reduce(
    (acc, purchase) => acc + getPurchaseItems(purchase).length,
    0,
  );

  const openPurchaseDetail = (purchase: PurchaseView) => {
    setDetail(purchase);
    setEditing(false);
  };

  const closeDetail = () => {
    setDetail(null);
    setEditing(false);
  };

  const loadProductsForEdit = async () => {
    if (productsLoaded || productsLoading) return;

    setProductsLoading(true);

    try {
      const response = await api.get("/products");
      setProducts(normalizeArray<Product>(response.data));
      setProductsLoaded(true);
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cargar los productos para editar la compra");
    } finally {
      setProductsLoading(false);
    }
  };

  const loadProviders = async () => {
    try {
      const response = await api.get("/providers");
      setProviders(normalizeArray<Provider>(response.data?.providers ?? response.data));
    } catch (error) {
      console.error(error);
    }
  };

  const startEdit = (purchase: PurchaseView) => {
    const items = getPurchaseItems(purchase).map((item) => {
      const qty = getItemQty(item);
      const isKg = String(item.product?.saleUnit ?? "").toUpperCase() === "KG" || (safeNum(item.quantityKg) > 0);

      return {
        productId: item.productId || item.product?.id || "",
        name: getItemName(item),
        sku: getItemSku(item),
        saleUnit: item.product?.saleUnit || (isKg ? "KG" : "UNIT"),
        quantity: isKg ? 0 : qty.value,
        quantityKg: isKg ? qty.value : 0,
        unitCost: getItemUnitCost(item),
      };
    }).filter((item) => item.productId);

    setEditItems(items);
    setEditProviderId(purchase.providerId || "");
    setEditProvider(getProviderName(purchase) === "Sin proveedor" ? "" : getProviderName(purchase));
    setEditInvoice(getInvoiceNumber(purchase) === "—" ? "" : getInvoiceNumber(purchase));
    setEditDescription(purchase.description || "");
    setEditPaymentMethod((purchase.paymentMethod as PaymentMethod) || "EFECTIVO");
    setEditDate(toDateInputAR(getPurchaseDate(purchase)) || toDateInputAR(new Date()));
    setAddProductQuery("");
    setEditing(true);
    void loadProductsForEdit();
    void loadProviders();
  };

  const handleEditProviderSelect = (id: string) => {
    setEditProviderId(id);
    if (!id) return;
    const provider = providers.find((p) => p.id === id);
    if (provider) {
      setEditProvider(provider.razonSocial || provider.nombreFantasia || "");
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setAddProductQuery("");
  };

  const setEditItemQty = (productId: string, value: number) => {
    setEditItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity: Math.max(1, Math.trunc(value)) } : item)),
    );
  };

  const setEditItemKg = (productId: string, value: number) => {
    setEditItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantityKg: Math.max(0.001, value) } : item)),
    );
  };

  const setEditItemCost = (productId: string, value: number) => {
    setEditItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, unitCost: Math.max(0, value) } : item)),
    );
  };

  const removeEditItem = (productId: string) => {
    setEditItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const addEditItem = (product: Product) => {
    if (editItems.some((item) => item.productId === product.id)) {
      toast.error("Ese producto ya está en la compra");
      return;
    }

    const isKg = product.saleUnit === "KG";

    setEditItems((prev) => [
      ...prev,
      {
        productId: product.id,
        name: product.name,
        sku: product.sku || "SIN-SKU",
        saleUnit: product.saleUnit,
        quantity: isKg ? 0 : 1,
        quantityKg: isKg ? 1 : 0,
        unitCost: num((product as Product & { purchasePrice?: number | null }).purchasePrice),
      },
    ]);
    setAddProductQuery("");
  };

  const addProductResults = useMemo(() => {
    const q = addProductQuery.trim().toLowerCase();
    if (!q) return [];

    return products
      .filter((product) => isEditableProduct(product))
      .filter((product) => !editItems.some((item) => item.productId === product.id))
      .filter(
        (product) =>
          product.name.toLowerCase().includes(q) || String(product.sku ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [addProductQuery, products, editItems]);

  const editTotal = useMemo(
    () =>
      editItems.reduce((acc, item) => {
        const qty = item.saleUnit === "KG" ? item.quantityKg : item.quantity;
        return acc + item.unitCost * qty;
      }, 0),
    [editItems],
  );

  const saveEdit = async () => {
    if (!detail) return;

    if (!editItems.length) {
      toast.error("La compra debe tener al menos un producto");
      return;
    }

    for (const item of editItems) {
      const qty = item.saleUnit === "KG" ? item.quantityKg : item.quantity;
      if (!(qty > 0)) {
        toast.error(`Cantidad inválida para ${item.name}`);
        return;
      }
      if (!Number.isFinite(item.unitCost) || item.unitCost < 0) {
        toast.error(`Costo inválido para ${item.name}`);
        return;
      }
    }

    setEditSaving(true);
    const toastId = toast.loading("Guardando cambios...");

    try {
      const payload = {
        providerId: editProviderId || null,
        providerName: editProvider.trim() || null,
        invoiceNumber: editInvoice.trim() || null,
        description: editDescription.trim() || null,
        paymentMethod: editPaymentMethod,
        date: editDate,
        items: editItems.map((item) => ({
          productId: item.productId,
          unitCost: item.unitCost,
          quantity: item.saleUnit === "KG" ? undefined : item.quantity,
          quantityKg: item.saleUnit === "KG" ? item.quantityKg : undefined,
        })),
      };

      const response = await api.patch(`/purchases/${detail.id}`, payload);
      const updatedPurchase: PurchaseView = response.data;

      setPurchases((prev) =>
        prev.map((purchase) => (purchase.id === updatedPurchase.id ? updatedPurchase : purchase)),
      );
      setDetail(updatedPurchase);
      setEditing(false);
      toast.success("Compra actualizada. El stock se ajustó según los cambios.", { id: toastId });
      await load();
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, "No se pudo actualizar la compra"), { id: toastId });
    } finally {
      setEditSaving(false);
    }
  };

  const performDeletePurchase = async (purchase: PurchaseView) => {
    const toastId = toast.loading("Eliminando compra...");

    try {
      const response = await api.patch(`/purchases/${purchase.id}/cancel`);
      const updatedPurchase: PurchaseView = response.data;

      setPurchases((prev) =>
        prev.map((p) => (p.id === updatedPurchase.id ? updatedPurchase : p)),
      );
      setDetail((prev) => (prev && prev.id === updatedPurchase.id ? updatedPurchase : prev));
      toast.success("Compra eliminada. El stock ingresado fue revertido.", { id: toastId });
      await load();
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, "No se pudo eliminar la compra"), { id: toastId });
    }
  };

  const openDeleteConfirm = (purchase: PurchaseView) => {
    setConfirmModal({
      title: "Eliminar compra",
      message: `¿Eliminar la compra #${purchase.id.slice(-8)}? Se va a descontar del stock la mercadería que había ingresado y se va a revertir el egreso en finanzas.`,
      confirmText: "Eliminar compra",
      danger: true,
      onConfirm: () => performDeletePurchase(purchase),
    });
  };

  const confirmModalAction = async () => {
    if (!confirmModal) return;

    setConfirmLoading(true);

    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <AppLayout
      title="Historial de compras"
      subtitle="Compras registradas, proveedores, comprobantes e ingreso de stock"
      actions={
        <Link href="/compras" className="btn btn-secondary btn-sm">
          <ArrowLeft size={15} />
          Volver a compras
        </Link>
      }
    >
      <div className="purchase-history-stats">
        <div className="stat-card">
          <div className="stat-value">{totalFilteredItems}</div>
          <div className="stat-label">Compras</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--accent)" }}>
            {fmtMoney(summaryTotal)}
          </div>
          <div className="stat-label">Total comprado</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{summaryProducts}</div>
          <div className="stat-label">Líneas de productos</div>
        </div>
      </div>

      <div className="purchase-history-filters">
        <div className="purchase-history-search">
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por proveedor, comprobante, producto o ID..."
          />
        </div>

        <label>
          <span>Desde</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>

        <label>
          <span>Hasta</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>

        <button className="btn btn-secondary btn-sm" onClick={() => load(true)} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
          Actualizar
        </button>
      </div>

      <div className="card purchase-history-card">
        <div className="purchase-history-desktop">
          {loading ? (
            <div style={{ padding: 18 }}>
              <div className="skeleton" style={{ height: 260 }} />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Comprobante</th>
                  <th>Ingreso</th>
                  <th>Pago</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Usuario</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {paginatedPurchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    onClick={() => openPurchaseDetail(purchase)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ fontFamily: "var(--mono)", color: "var(--text2)" }}>
                      #{purchase.id.slice(-8)}
                    </td>
                    <td>{fmtDate(getPurchaseDate(purchase))}</td>
                    <td>{getProviderName(purchase)}</td>
                    <td>{getInvoiceNumber(purchase)}</td>
                    <td>
                      <span className={`badge ${getLocationBadgeClass(purchase)}`}>
                        {getLocationLabel(purchase)}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-gray">{purchase.paymentMethod || "—"}</span>
                    </td>
                    <td>{getPurchaseItems(purchase).length}</td>
                    <td style={{ fontFamily: "var(--mono)", fontWeight: 900, color: "var(--accent)" }}>
                      {fmtMoney(getPurchaseTotal(purchase))}
                    </td>
                    <td>{getUserLabel(purchase)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openPurchaseDetail(purchase)}>
                        <Eye size={14} />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <FileText size={36} />
              <p>Sin compras registradas</p>
            </div>
          )}
        </div>

        <div className="purchase-history-mobile">
          {loading ? (
            <div style={{ padding: 14 }}>
              <div className="skeleton" style={{ height: 240 }} />
            </div>
          ) : (
            paginatedPurchases.map((purchase) => (
              <article
                key={`${purchase.id}-mobile`}
                className="purchase-history-item"
                onClick={() => openPurchaseDetail(purchase)}
              >
                <div className="purchase-history-item-head">
                  <div>
                    <span>#{purchase.id.slice(-8)}</span>
                    <b>{getProviderName(purchase)}</b>
                    <small>{fmtDateTime(getPurchaseDate(purchase))}</small>
                  </div>
                  <strong>{fmtMoney(getPurchaseTotal(purchase))}</strong>
                </div>

                <div className="purchase-history-badges">
                  <span className={`badge ${getLocationBadgeClass(purchase)}`}>
                    <Warehouse size={12} />
                    {getLocationLabel(purchase)}
                  </span>
                  <span className="badge badge-gray">{purchase.paymentMethod || "Sin pago"}</span>
                  <span className="badge badge-gray">
                    <Package size={12} />
                    {getPurchaseItems(purchase).length} productos
                  </span>
                </div>

                <div className="purchase-history-item-data">
                  <div>
                    <small>Comprobante</small>
                    <b>{getInvoiceNumber(purchase)}</b>
                  </div>
                  <div>
                    <small>Usuario</small>
                    <b>{getUserLabel(purchase)}</b>
                  </div>
                </div>
              </article>
            ))
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <FileText size={36} />
              <p>Sin compras registradas</p>
            </div>
          )}
        </div>

        {!loading && totalFilteredItems > 0 && (
          <div className="purchase-history-pagination">
            <div>
              Mostrando {pageStart} - {pageEnd} de {totalFilteredItems} compras
            </div>

            <div>
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </button>

              <span>
                Página {currentPage} de {totalPages}
              </span>

              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {mounted && detail &&
        createPortal(
          (() => {
            const isCancelled = String(detail.status || "").toUpperCase() === "CANCELLED";

            return (
              <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !editing && closeDetail()}>
                <div className="modal purchase-detail-modal">
                  <div className="modal-header">
                    <div>
                      <b>
                        Compra #{detail.id.slice(-8)}
                        {isCancelled && <span className="badge badge-red purchase-cancelled-badge">Eliminada</span>}
                      </b>
                      <small>{fmtDateTime(getPurchaseDate(detail))}</small>
                    </div>

                    <button className="btn btn-ghost btn-sm" onClick={closeDetail}>
                      <X size={16} />
                    </button>
                  </div>

                  <div className="modal-body">
                    {isCancelled && (
                      <div className="purchase-cancelled-banner">
                        <AlertTriangle size={15} />
                        Esta compra fue eliminada. El stock que había ingresado ya fue revertido y no se puede editar.
                      </div>
                    )}

                    {!editing && (
                      <div className="purchase-detail-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={isCancelled}
                          onClick={() => startEdit(detail)}
                        >
                          <Pencil size={14} />
                          Editar compra
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={isCancelled}
                          onClick={() => openDeleteConfirm(detail)}
                        >
                          <Trash2 size={14} />
                          Eliminar compra
                        </button>
                      </div>
                    )}

                    {editing ? (
                      <div className="purchase-edit-form">
                        <div className="purchase-edit-grid">
                          <label>
                            <span>Proveedor</span>
                            <select value={editProviderId} onChange={(e) => handleEditProviderSelect(e.target.value)}>
                              <option value="">Sin seleccionar / otro</option>
                              {providers.map((p) => (
                                <option key={p.id} value={p.id}>{p.razonSocial || p.nombreFantasia || "Proveedor"}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Nombre del proveedor</span>
                            <input value={editProvider} onChange={(e) => setEditProvider(e.target.value)} placeholder="Opcional" />
                          </label>
                          <label>
                            <span>Comprobante</span>
                            <input value={editInvoice} onChange={(e) => setEditInvoice(e.target.value)} placeholder="Factura/remito" />
                          </label>
                          <label>
                            <span>Fecha</span>
                            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                          </label>
                          <label>
                            <span>Método de pago</span>
                            <select value={editPaymentMethod} onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethod)}>
                              {editPaymentMethods.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <label className="purchase-edit-description">
                          <span>Observación</span>
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={2}
                            placeholder="Opcional"
                          />
                        </label>

                        <div className="purchase-edit-items">
                          <div className="purchase-edit-items-head">
                            <b>Productos</b>
                            <span>Ingresan a {getLocationLabel(detail)} · no se puede cambiar el destino</span>
                          </div>

                          {editItems.map((item) => (
                            <div key={item.productId} className="purchase-edit-item-row">
                              <div className="purchase-edit-item-info">
                                <strong>{item.name}</strong>
                                <small>{item.sku}</small>
                              </div>

                              {item.saleUnit === "KG" ? (
                                <label className="purchase-edit-qty">
                                  <span>Kg</span>
                                  <input
                                    type="number"
                                    step="0.001"
                                    value={item.quantityKg}
                                    onChange={(e) => setEditItemKg(item.productId, num(e.target.value))}
                                  />
                                </label>
                              ) : (
                                <div className="purchase-edit-stepper">
                                  <button type="button" onClick={() => setEditItemQty(item.productId, item.quantity - 1)}>
                                    <Minus size={13} />
                                  </button>
                                  <span>{item.quantity}</span>
                                  <button type="button" onClick={() => setEditItemQty(item.productId, item.quantity + 1)}>
                                    <Plus size={13} />
                                  </button>
                                </div>
                              )}

                              <label className="purchase-edit-cost">
                                <span>Costo</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.unitCost}
                                  onFocus={(e) => e.currentTarget.select()}
                                  onChange={(e) => setEditItemCost(item.productId, num(e.target.value))}
                                />
                              </label>

                              <button
                                type="button"
                                className="purchase-edit-remove"
                                onClick={() => removeEditItem(item.productId)}
                                title="Quitar producto"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}

                          {!editItems.length && (
                            <div className="empty-state compact">
                              <Package size={26} />
                              <p>Agregá al menos un producto</p>
                            </div>
                          )}
                        </div>

                        <div className="purchase-edit-add">
                          <label>
                            <span>Agregar producto</span>
                            <input
                              value={addProductQuery}
                              onChange={(e) => setAddProductQuery(e.target.value)}
                              placeholder={productsLoading ? "Cargando productos..." : "Buscar por nombre o SKU..."}
                              disabled={productsLoading}
                            />
                          </label>

                          {addProductResults.length > 0 && (
                            <div className="purchase-edit-add-results">
                              {addProductResults.map((product) => (
                                <button type="button" key={product.id} onClick={() => addEditItem(product)}>
                                  <span>{product.name}</span>
                                  <small>{product.sku || "SIN-SKU"}</small>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="purchase-edit-total">
                          <span>Total compra</span>
                          <b>{fmtMoney(editTotal)}</b>
                        </div>

                        <div className="purchase-edit-actions">
                          <button type="button" className="btn btn-secondary" onClick={cancelEdit} disabled={editSaving}>
                            <XCircle size={15} />
                            Cancelar
                          </button>
                          <button type="button" className="btn btn-primary" onClick={() => void saveEdit()} disabled={editSaving}>
                            {editSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                            {editSaving ? "Guardando..." : "Guardar cambios"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="purchase-detail-grid">
                          <div>
                            <small>Proveedor</small>
                            <b>{getProviderName(detail)}</b>
                          </div>

                          <div>
                            <small>Comprobante</small>
                            <b>{getInvoiceNumber(detail)}</b>
                          </div>

                          <div>
                            <small>Ingreso de stock</small>
                            <b>
                              <span className={`badge ${getLocationBadgeClass(detail)}`}>
                                {getLocationLabel(detail)}
                              </span>
                            </b>
                          </div>

                          <div>
                            <small>Método de pago</small>
                            <b>{detail.paymentMethod || "—"}</b>
                          </div>

                          <div>
                            <small>Usuario</small>
                            <b>{getUserLabel(detail)}</b>
                          </div>

                          <div>
                            <small>Total</small>
                            <b className="purchase-detail-total">{fmtMoney(getPurchaseTotal(detail))}</b>
                          </div>
                        </div>

                        {detail.description && (
                          <div className="purchase-detail-note">
                            <small>Observación</small>
                            <p>{detail.description}</p>
                          </div>
                        )}

                        <div className="purchase-detail-products">
                          <div className="purchase-detail-products-head">
                            <b>Productos</b>
                            <span>{getPurchaseItems(detail).length} líneas</span>
                          </div>

                          <div className="purchase-detail-products-table">
                            <table>
                              <thead>
                                <tr>
                                  <th>Producto</th>
                                  <th>SKU</th>
                                  <th>Cantidad</th>
                                  <th>Costo</th>
                                  <th>Subtotal</th>
                                </tr>
                              </thead>

                              <tbody>
                                {getPurchaseItems(detail).map((item, index) => (
                                  <tr key={item.id || `${getItemName(item)}-${index}`}>
                                    <td>{getItemName(item)}</td>
                                    <td>{getItemSku(item)}</td>
                                    <td>{getItemQty(item).label}</td>
                                    <td>{fmtMoney(getItemUnitCost(item))}</td>
                                    <td>{fmtMoney(getItemSubtotal(item))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {!getPurchaseItems(detail).length && (
                              <div className="empty-state compact">
                                <Package size={30} />
                                <p>Esta compra no trajo detalle de productos</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })(),
          document.body,
        )}

      {mounted && confirmModal &&
        createPortal(
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !confirmLoading && setConfirmModal(null)}>
            <div className="modal purchase-confirm-modal">
              <div className="modal-header">
                <b>{confirmModal.title}</b>
                <button className="btn btn-ghost btn-sm" onClick={() => !confirmLoading && setConfirmModal(null)} disabled={confirmLoading}>
                  <X size={16} />
                </button>
              </div>
              <div className="modal-body">
                <div className="purchase-confirm-box">
                  <span className={confirmModal.danger ? "purchase-confirm-icon danger" : "purchase-confirm-icon"}>
                    <AlertTriangle size={18} />
                  </span>
                  <p>{confirmModal.message}</p>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConfirmModal(null)} disabled={confirmLoading}>
                  Cancelar
                </button>
                <button
                  className={confirmModal.danger ? "btn btn-danger" : "btn btn-primary"}
                  onClick={() => void confirmModalAction()}
                  disabled={confirmLoading}
                >
                  {confirmLoading ? <Loader2 size={15} className="animate-spin" /> : (confirmModal.confirmText ?? "Confirmar")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <style jsx>{`
        .purchase-history-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .purchase-history-filters {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 160px 160px auto;
          gap: 10px;
          align-items: end;
          margin-bottom: 16px;
        }

        .purchase-history-search {
          position: relative;
        }

        .purchase-history-search svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text3);
        }

        .purchase-history-search input {
          width: 100%;
          padding-left: 34px;
        }

        .purchase-history-filters label {
          display: grid;
          gap: 5px;
        }

        .purchase-history-filters label span {
          color: var(--text3);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .purchase-history-card {
          overflow: hidden;
        }

        .purchase-history-desktop {
          overflow-x: auto;
        }

        .purchase-history-desktop table {
          min-width: 1080px;
        }

        .purchase-history-mobile {
          display: none;
        }

        .purchase-history-pagination {
          border-top: 1px solid var(--border);
          padding: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          background: var(--surface);
          color: var(--text3);
          font-size: 12px;
          font-weight: 800;
        }

        .purchase-history-pagination > div:last-child {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .modal-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483000 !important;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          overflow-y: auto;
        }

        .modal {
          margin: auto;
          max-height: calc(100dvh - 36px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-body {
          overflow-y: auto;
        }

        .purchase-detail-modal {
          width: min(880px, calc(100vw - 32px));
        }

        .modal-header > div {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .modal-header small {
          color: var(--text3);
          font-size: 12px;
        }

        .purchase-detail-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .purchase-detail-grid > div,
        .purchase-detail-note {
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface2);
          padding: 12px;
          display: grid;
          gap: 5px;
          min-width: 0;
        }

        .purchase-detail-grid small,
        .purchase-detail-note small {
          color: var(--text3);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .purchase-detail-grid b {
          overflow-wrap: anywhere;
        }

        .purchase-detail-total {
          color: var(--accent);
          font-family: var(--mono);
          font-size: 18px;
        }

        .purchase-cancelled-badge {
          margin-left: 8px;
          vertical-align: middle;
          font-size: 10px;
        }

        .purchase-cancelled-banner {
          display: flex;
          gap: 8px;
          align-items: center;
          border: 1px solid rgba(239,68,68,.28);
          background: rgba(239,68,68,.1);
          color: var(--danger);
          border-radius: 13px;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.4;
          margin-bottom: 14px;
        }

        .purchase-detail-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .purchase-edit-form {
          display: grid;
          gap: 14px;
        }

        .purchase-edit-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .purchase-edit-grid label,
        .purchase-edit-description,
        .purchase-edit-add label {
          display: grid;
          gap: 5px;
          min-width: 0;
        }

        .purchase-edit-grid span,
        .purchase-edit-description span,
        .purchase-edit-add span,
        .purchase-edit-qty span,
        .purchase-edit-cost span {
          color: var(--text3);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .purchase-edit-grid input,
        .purchase-edit-grid select,
        .purchase-edit-description textarea,
        .purchase-edit-add input {
          width: 100%;
          min-width: 0;
        }

        .purchase-edit-items {
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--surface2);
          padding: 10px;
          display: grid;
          gap: 8px;
        }

        .purchase-edit-items-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 10px;
        }

        .purchase-edit-items-head span {
          color: var(--text3);
          font-size: 11px;
          font-weight: 700;
        }

        .purchase-edit-item-row {
          display: grid;
          grid-template-columns: minmax(0,1fr) 108px 100px auto;
          gap: 8px;
          align-items: end;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          padding: 8px;
        }

        .purchase-edit-item-info {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .purchase-edit-item-info strong {
          font-size: 12px;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .purchase-edit-item-info small {
          color: var(--text3);
          font-size: 10px;
        }

        .purchase-edit-qty,
        .purchase-edit-cost {
          display: grid;
          gap: 4px;
        }

        .purchase-edit-qty input,
        .purchase-edit-cost input {
          height: 34px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface2);
          color: var(--text);
          padding: 0 8px;
          width: 100%;
          font-weight: 800;
          font-family: var(--mono);
        }

        .purchase-edit-stepper {
          display: inline-grid;
          grid-template-columns: 30px 30px 30px;
          align-items: center;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface2);
          height: 34px;
        }

        .purchase-edit-stepper button {
          height: 100%;
          border: 0;
          background: transparent;
          color: var(--text);
          display: grid;
          place-items: center;
        }

        .purchase-edit-stepper span {
          text-align: center;
          font-weight: 900;
          font-family: var(--mono);
          font-size: 12px;
        }

        .purchase-edit-remove {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface2);
          color: var(--danger);
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .purchase-edit-add {
          position: relative;
        }

        .purchase-edit-add-results {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          z-index: 5;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          box-shadow: 0 14px 34px rgba(0,0,0,.22);
          max-height: 220px;
          overflow-y: auto;
          display: grid;
        }

        .purchase-edit-add-results button {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          padding: 9px 12px;
          border: 0;
          border-bottom: 1px solid var(--border);
          background: transparent;
          color: var(--text);
          text-align: left;
          font-size: 12px;
          font-weight: 700;
        }

        .purchase-edit-add-results button:last-child {
          border-bottom: 0;
        }

        .purchase-edit-add-results button:hover {
          background: var(--surface2);
        }

        .purchase-edit-add-results small {
          color: var(--text3);
          font-size: 10px;
          white-space: nowrap;
        }

        .purchase-edit-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid var(--border);
          padding-top: 10px;
        }

        .purchase-edit-total span {
          color: var(--text3);
          font-size: 12px;
          font-weight: 800;
        }

        .purchase-edit-total b {
          font-family: var(--mono);
          color: var(--accent);
          font-size: 18px;
        }

        .purchase-edit-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .purchase-confirm-modal {
          width: min(480px, calc(100vw - 24px));
        }

        .purchase-confirm-box {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .purchase-confirm-box p {
          margin: 0;
          color: var(--text2);
          font-size: 13px;
          line-height: 1.55;
        }

        .purchase-confirm-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--surface2);
          display: grid;
          place-items: center;
          flex-shrink: 0;
          color: var(--accent);
        }

        .purchase-confirm-icon.danger {
          background: rgba(239,68,68,.12);
          color: var(--danger);
        }

        .purchase-detail-note {
          margin-bottom: 16px;
        }

        .purchase-detail-note p {
          margin: 0;
          color: var(--text2);
          line-height: 1.45;
          font-size: 13px;
        }

        .purchase-detail-products {
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          background: var(--surface);
        }

        .purchase-detail-products-head {
          padding: 12px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          border-bottom: 1px solid var(--border);
        }

        .purchase-detail-products-head span {
          color: var(--text3);
          font-size: 12px;
          font-weight: 900;
        }

        .purchase-detail-products-table {
          overflow-x: auto;
        }

        .purchase-detail-products-table table {
          min-width: 680px;
        }

        .empty-state.compact {
          min-height: 160px;
        }

        @media (max-width: 900px) {
          .purchase-history-stats {
            grid-template-columns: 1fr;
          }

          .purchase-history-filters {
            grid-template-columns: 1fr 1fr;
          }

          .purchase-history-search {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 768px) {
          .purchase-history-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 10px;
          }

          .purchase-history-filters {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 10px;
          }

          .purchase-history-filters button {
            grid-column: 1 / -1;
            width: 100%;
            justify-content: center;
          }

          .purchase-history-desktop {
            display: none;
          }

          .purchase-history-mobile {
            display: grid;
            gap: 9px;
            padding: 10px;
          }

          .purchase-history-item {
            border: 1px solid var(--border);
            border-radius: 16px;
            background: var(--surface2);
            padding: 11px;
            display: grid;
            gap: 10px;
            cursor: pointer;
          }

          .purchase-history-item-head {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            align-items: flex-start;
          }

          .purchase-history-item-head > div {
            min-width: 0;
            display: grid;
            gap: 3px;
          }

          .purchase-history-item-head span {
            color: var(--text3);
            font-family: var(--mono);
            font-size: 10px;
            font-weight: 800;
          }

          .purchase-history-item-head b {
            font-size: 14px;
            line-height: 1.2;
            overflow-wrap: anywhere;
          }

          .purchase-history-item-head small {
            color: var(--text3);
            font-size: 11px;
          }

          .purchase-history-item-head strong {
            color: var(--accent);
            font-family: var(--mono);
            font-size: 12px;
            white-space: nowrap;
          }

          .purchase-history-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }

          .purchase-history-badges .badge {
            display: inline-flex;
            gap: 4px;
            align-items: center;
          }

          .purchase-history-item-data {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 7px;
          }

          .purchase-history-item-data > div {
            border-radius: 12px;
            background: var(--bg);
            padding: 8px;
            display: grid;
            gap: 3px;
            min-width: 0;
          }

          .purchase-history-item-data small {
            color: var(--text3);
            font-size: 10px;
            font-weight: 900;
          }

          .purchase-history-item-data b {
            font-size: 12px;
            overflow-wrap: anywhere;
          }

          .purchase-history-pagination {
            display: grid;
            grid-template-columns: 1fr;
            text-align: center;
          }

          .purchase-history-pagination > div:last-child {
            display: grid;
            grid-template-columns: 1fr;
          }

          .purchase-history-pagination button {
            width: 100%;
            justify-content: center;
          }

          .modal-overlay {
            align-items: flex-start;
            padding: 12px;
          }

          .purchase-detail-modal {
            width: calc(100vw - 24px);
            max-width: calc(100vw - 24px);
            max-height: calc(100dvh - 24px);
            border-radius: 18px;
          }

          .purchase-detail-grid {
            grid-template-columns: 1fr;
          }

          .purchase-edit-grid {
            grid-template-columns: 1fr;
          }

          .purchase-edit-item-row {
            grid-template-columns: 1fr;
          }

          .purchase-edit-remove {
            justify-self: end;
          }

          .purchase-detail-actions {
            flex-direction: column;
          }

          .purchase-detail-actions button {
            width: 100%;
            justify-content: center;
          }

          .purchase-edit-actions {
            flex-direction: column-reverse;
          }

          .purchase-edit-actions button {
            width: 100%;
            justify-content: center;
          }

          .modal-footer {
            display: grid !important;
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 420px) {
          .purchase-history-stats,
          .purchase-history-filters,
          .purchase-history-item-data {
            grid-template-columns: 1fr;
          }

          .purchase-history-search {
            grid-column: auto;
          }

          .purchase-history-item-head {
            display: grid;
          }

          .purchase-history-item-head strong {
            white-space: normal;
          }
        }
      `}</style>
    </AppLayout>
  );
}
