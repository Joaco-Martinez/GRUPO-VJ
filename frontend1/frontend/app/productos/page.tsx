/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { Product, ProductCategory, ProductComponent } from '@/types';
import {
  categoryName,
  fmtMoney,
  normalizeArray,
  num,
  productMinStock,
  productStock,
} from '@/lib/helpers';
import {
  Layers,
  Package,
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
  Tags,
  RefreshCcw,
  ImagePlus,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

type Modal = 'product-create' | 'product-edit' | 'category' | null;
type ProductFormStep = 'basico' | 'precios' | 'componentes';
type ComponentForm = { componentId: string; quantity: string; quantityKg: string };

type ToastState = {
  type: 'success' | 'error';
  message: string;
} | null;

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

const emptyProductForm = {
  name: '',
  description: '',
  sku: '',
  type: 'SIMPLE',
  categoryId: '',
  isService: 'false',
  saleUnit: 'UNIT',
  price: '',
  clientPrice: '',
  wholesalePrice: '',
  purchasePrice: '',
  pricePerKg: '',
  clientPricePerKg: '',
  wholesalePricePerKg: '',
  stockLocal: '0',
  stockDeposito: '0',
  stockLocalKg: '0',
  stockDepositoKg: '0',
  minStock: '0',
  minStockKg: '0',
};

const PRODUCTS_PAGE_SIZE = 12;

function getProductPublicPrice(product: Product) {
  return product.saleUnit === 'KG'
    ? num((product as any).pricePerKg ?? product.price)
    : num(product.price);
}

function getProductClientPrice(product: Product) {
  const fallback = getProductPublicPrice(product);

  return product.saleUnit === 'KG'
    ? num((product as any).clientPricePerKg ?? (product as any).clientPrice ?? fallback)
    : num((product as any).clientPrice ?? fallback);
}

function getProductWholesalePrice(product: Product) {
  const fallback = getProductPublicPrice(product);

  return product.saleUnit === 'KG'
    ? num(
        (product as any).wholesalePricePerKg ??
          (product as any).wholesalePrice ??
          fallback
      )
    : num((product as any).wholesalePrice ?? fallback);
}



function getDirectGrossCost(product: Product): number {
  return num(
    (product as any).grossCost ??
      (product as any).costPrice ??
      (product as any).costPriceGross ??
      (product as any).costoBruto ??
      (product as any).costoCompra ??
      (product as any).purchaseCost ??
      (product as any).purchasePrice ??
      0
  );
}

function getProductGrossCost(product: Product): number {
  const directCost = getDirectGrossCost(product);

  if (directCost > 0 || product.type !== 'COMPUESTO') return directCost;

  return (product.components ?? []).reduce((total: number, relation: ProductComponent): number => {
    const component = relation.component as Product | undefined;
    if (!component) return total;

    const quantity =
      component.saleUnit === 'KG'
        ? num(relation.quantityKg ?? relation.quantity ?? 0)
        : num(relation.quantity ?? relation.quantityKg ?? 0);

    return total + getProductGrossCost(component) * quantity;
  }, 0);
}

function getProfit(product: Product): number {
  return getProductPublicPrice(product) - getProductGrossCost(product);
}

function getProfitPercent(product: Product): number | null {
  const cost = getProductGrossCost(product);
  if (cost <= 0) return null;

  return (getProfit(product) / cost) * 100;
}



function unitSuffix(product: Product) {
  return product.saleUnit === 'KG' ? '/kg' : '';
}

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [form, setForm] = useState<Record<string, string>>(emptyProductForm);
  const [productFormStep, setProductFormStep] = useState<ProductFormStep>('basico');
  const [components, setComponents] = useState<ComponentForm[]>([]);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');

  const [toast, setToast] = useState<ToastState>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [mobileProductSheet, setMobileProductSheet] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });

    window.setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        api.get('/products'),
        api.get('/categories?includeInactive=true'),
      ]);

      setProducts(normalizeArray<Product>(pRes.data));
      setCategories(normalizeArray<ProductCategory>(cRes.data));
    } catch (e) {
      console.error(e);
      showToast('error', 'Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (productFormStep === 'componentes' && (form.isService === 'true' || form.type !== 'COMPUESTO')) {
      setProductFormStep('basico');
    }
  }, [form.isService, form.type, productFormStep]);

  const simpleProducts = useMemo(
    () => products.filter((p) => p.type === 'SIMPLE' && p.isActive !== false && (p as any).isService !== true),
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter((p) => {
      const matchesText =
        !q ||
        p.name.toLowerCase().includes(q) ||
        String(p.sku ?? '').toLowerCase().includes(q) ||
        String((p as any).description ?? '').toLowerCase().includes(q);

      const matchesCat = !categoryId || p.categoryId === categoryId;

      return matchesText && matchesCat;
    });
  }, [products, search, categoryId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PAGE_SIZE));

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PRODUCTS_PAGE_SIZE;
    return filtered.slice(start, start + PRODUCTS_PAGE_SIZE);
  }, [filtered, currentPage]);

  const pageStart = filtered.length ? (currentPage - 1) * PRODUCTS_PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(currentPage * PRODUCTS_PAGE_SIZE, filtered.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetImage = () => {
    setImageFile(null);
    setImagePreview('');
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyProductForm, categoryId: categories[0]?.id ?? '' });
    setComponents([]);
    resetImage();
    setProductFormStep('basico');
    setModal('product-create');
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name ?? '',
      description: (product as any).description ?? '',
      sku: product.sku ?? '',
      type: product.type,
      categoryId: product.categoryId ?? '',
      isService: String(Boolean((product as any).isService)),
      saleUnit: product.saleUnit,

      price: String(product.price ?? ''),
      clientPrice: String(product.clientPrice ?? ''),
      wholesalePrice: String(product.wholesalePrice ?? ''),
      purchasePrice: String(getProductGrossCost(product) || ''),

      pricePerKg: String(product.pricePerKg ?? ''),
      clientPricePerKg: String(product.clientPricePerKg ?? ''),
      wholesalePricePerKg: String(product.wholesalePricePerKg ?? ''),

      stockLocal: String(product.stockLocal ?? 0),
      stockDeposito: String(product.stockDeposito ?? 0),
      stockLocalKg: String(product.stockLocalKg ?? 0),
      stockDepositoKg: String(product.stockDepositoKg ?? 0),

      minStock: String(product.minStock ?? 0),
      minStockKg: String(product.minStockKg ?? 0),
    });

    setComponents(
      (product.components ?? []).map((c) => ({
        componentId: c.componentId,
        quantity: String(c.quantity ?? ''),
        quantityKg: String(c.quantityKg ?? ''),
      }))
    );

    setImageFile(null);
    setImagePreview(product.imageUrl ?? '');
    setProductFormStep('basico');
    setModal('product-edit');
  };

  const handleImageChange = (file?: File | null) => {
    if (!file) {
      resetImage();
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('error', 'El archivo debe ser una imagen');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const buildPayloadObject = () => {
    const isService = form.isService === 'true';

    return {
      ...form,

      isService,
      type: isService ? 'SIMPLE' : form.type,
      saleUnit: isService ? 'UNIT' : form.saleUnit,

      description: form.description?.trim() || '',

      price: num(form.price),
      clientPrice: num(form.clientPrice),
      wholesalePrice: num(form.wholesalePrice),
      purchasePrice: num(form.purchasePrice),

      pricePerKg: form.pricePerKg === '' ? undefined : num(form.pricePerKg),
      clientPricePerKg:
        form.clientPricePerKg === '' ? undefined : num(form.clientPricePerKg),
      wholesalePricePerKg:
        form.wholesalePricePerKg === '' ? undefined : num(form.wholesalePricePerKg),

      stockLocal: isService ? 0 : num(form.stockLocal),
      stockDeposito: isService ? 0 : num(form.stockDeposito),
      stockLocalKg: isService ? 0 : num(form.stockLocalKg),
      stockDepositoKg: isService ? 0 : num(form.stockDepositoKg),

      minStock: isService ? 0 : num(form.minStock),
      minStockKg: isService ? 0 : num(form.minStockKg),

      components:
        !isService && form.type === 'COMPUESTO'
          ? components
              .filter((c) => c.componentId)
              .map((c) => ({
                componentId: c.componentId,
                quantity: c.quantity ? num(c.quantity) : undefined,
                quantityKg: c.quantityKg ? num(c.quantityKg) : undefined,
              }))
          : undefined,
    };
  };

  const buildProductFormData = () => {
    const payload = buildPayloadObject();
    const fd = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      if (key === 'components') {
        fd.append(key, JSON.stringify(value));
        return;
      }

      fd.append(key, String(value));
    });

    if (imageFile) {
      fd.append('image', imageFile);
    }

    return fd;
  };

  const saveProduct = async () => {
    setSaving(true);

    try {
      const payload = buildPayloadObject();

      if (modal === 'product-create') {
        const fd = buildProductFormData();

        await api.post('/products', fd, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      if (modal === 'product-edit' && editing) {
        await api.put(`/products/${editing.id}`, payload);

        if (form.type === 'COMPUESTO') {
          await api.put(`/products/${editing.id}/components`, {
            components: payload.components ?? [],
          });
        }

        if (imageFile) {
          const fd = new FormData();
          fd.append('image', imageFile);

          await api.patch(`/products/${editing.id}/image`, fd, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
        }
      }

      showToast(
        'success',
        modal === 'product-create'
          ? 'Producto creado correctamente'
          : 'Producto actualizado correctamente'
      );

      setModal(null);
      resetImage();
      await load();
    } catch (e: unknown) {
      showToast(
        'error',
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Error al guardar producto'
      );
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) return;

    setSaving(true);

    try {
      await api.post('/categories', categoryForm);
      setCategoryForm({ name: '', description: '' });
      setModal(null);
      showToast('success', 'Categoría creada correctamente');
      await load();
    } catch (e: unknown) {
      showToast(
        'error',
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Error al crear categoría'
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    setConfirmModal({
      title: 'Eliminar producto',
      message: `¿Eliminar ${product.name}?`,
      confirmText: 'Eliminar',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/products/${product.id}`);
          await load();
          showToast('success', 'Producto eliminado correctamente');
        } catch (e: unknown) {
          showToast(
            'error',
            (e as { response?: { data?: { message?: string } } })?.response?.data
              ?.message ?? 'Error al eliminar producto'
          );
        }
      },
    });
  };

  const confirmAction = async () => {
    if (!confirmModal) return;

    setConfirmLoading(true);

    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const addComponent = () =>
    setComponents((prev) => [
      ...prev,
      { componentId: '', quantity: '1', quantityKg: '' },
    ]);

  const setComponent = (
    idx: number,
    key: keyof ComponentForm,
    value: string
  ) =>
    setComponents((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [key]: value } : c))
    );

  return (
    <AppLayout
      title="Productos"
      subtitle="Catálogo empresarial, promos y stock"
      actions={
        <div className="products-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> Nuevo producto
          </button>
        </div>
      }
    >
      {toast && (
        <div
          className="products-toast"
          style={{
            position: 'fixed',
            top: 18,
            right: 18,
            zIndex: 9999,
            minWidth: 280,
            maxWidth: 420,
            borderRadius: 14,
            border:
              toast.type === 'success'
                ? '1px solid rgba(34,197,94,0.35)'
                : '1px solid rgba(239,68,68,0.35)',
            background: 'rgba(255,255,255,0.96)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} style={{ color: 'var(--success)', marginTop: 1 }} />
          ) : (
            <AlertTriangle size={18} style={{ color: 'var(--danger)', marginTop: 1 }} />
          )}

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 2 }}>
              {toast.type === 'success' ? 'Listo' : 'Atención'}
            </div>

            <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.45 }}>
              {toast.message}
            </div>
          </div>

          <button
            onClick={() => setToast(null)}
            style={{
              border: 0,
              background: 'transparent',
              color: 'var(--text3)',
              cursor: 'pointer',
              padding: 2,
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div
        className="products-stats-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div className="stat-card">
          <div className="stat-value">{products.length}</div>
          <div className="stat-label">Productos</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {products.filter((p) => p.type === 'COMPUESTO').length}
          </div>
          <div className="stat-label">Promos / compuestos</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {categories.filter((c) => c.isActive).length}
          </div>
          <div className="stat-label">Categorías activas</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {products.filter((p) => productStock(p) <= productMinStock(p)).length}
          </div>
          <div className="stat-label">Stock bajo</div>
        </div>
      </div>

      <div className="products-category-action">
        <button
          className="btn btn-secondary btn-sm products-category-btn"
          onClick={() => setModal('category')}
        >
          <Tags size={14} /> Gestionar categorías
        </button>
      </div>

      <div className="products-filters" style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="products-search" style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text3)',
            }}
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU o descripción..."
            style={{ paddingLeft: 34 }}
          />
        </div>

        <select
          className="products-filter-select"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          style={{ width: 220 }}
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <button className="btn btn-secondary btn-sm products-refresh-btn" onClick={load}>
          <RefreshCcw size={14} /> Actualizar
        </button>
      </div>

      <div className="card products-table-card">
        <div className="table-wrap products-desktop-table">
          {loading ? (
            <div style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 220 }} />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Precios</th>
                  <th>Costo bruto</th>
                  <th>Ganancia</th>
                  <th>Stock Mayorista</th>
                  <th>Stock Minorista</th>
                  <th>Tipo</th>
                  <th>Componentes</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {paginatedProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="products-row-main" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt=""
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 8,
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 8,
                              background: 'var(--surface2)',
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            <Package size={15} />
                          </span>
                        )}

                        <div>
                          <div style={{ fontWeight: 800, fontSize: 13 }}>
                            {p.name}
                          </div>

                          <div
                            style={{
                              fontFamily: 'var(--mono)',
                              color: 'var(--text3)',
                              fontSize: 11,
                            }}
                          >
                            {p.sku ?? 'SIN-SKU'}
                          </div>

                          {(p as any).description ? (
                            <div
                              style={{
                                color: 'var(--text2)',
                                fontSize: 11,
                                maxWidth: 260,
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                marginTop: 2,
                              }}
                            >
                              {(p as any).description}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="badge badge-gray">{categoryName(p)}</span>
                    </td>

                    <td>
                      <div style={{ display: 'grid', gap: 4, fontFamily: 'var(--mono)', fontSize: 12 }}>
                        <strong>
                          Público: {fmtMoney(getProductPublicPrice(p))}
                          {unitSuffix(p)}
                        </strong>
                        <span style={{ color: 'var(--text2)' }}>
                          Cliente: {fmtMoney(getProductClientPrice(p))}
                          {unitSuffix(p)}
                        </span>
                        <span style={{ color: 'var(--text2)' }}>
                          Mayorista: {fmtMoney(getProductWholesalePrice(p))}
                          {unitSuffix(p)}
                        </span>
                      </div>
                    </td>

                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--text2)', fontWeight: 800 }}>
                      {fmtMoney(getProductGrossCost(p))}
                      {unitSuffix(p)}
                    </td>

                    <td>
                      <div
                        style={{
                          display: 'grid',
                          gap: 3,
                          fontFamily: 'var(--mono)',
                          fontSize: 12,
                          color: getProfit(p) >= 0 ? 'var(--success)' : 'var(--danger)',
                          fontWeight: 800,
                        }}
                      >
                        <span>{fmtMoney(getProfit(p))}</span>
                        <small style={{ color: 'var(--text3)' }}>
                          {getProfitPercent(p) === null
                            ? 'Sin costo'
                            : `${getProfitPercent(p)!.toFixed(1)}%`}
                        </small>
                      </div>
                    </td>

                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          color:
                            productStock(p) <= productMinStock(p)
                              ? 'var(--danger)'
                              : 'var(--text)',
                        }}
                      >
                        {(p as any).isService ? 'No descuenta stock' : `${productStock(p)} ${p.saleUnit === 'KG' ? 'kg' : ''}`}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontFamily: 'var(--mono)' }}>
                        {(p as any).isService ? '-' : p.saleUnit === 'KG' ? num(p.stockDepositoKg) : num(p.stockDeposito)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          (p as any).isService
                            ? 'badge-gray'
                            : p.type === 'COMPUESTO'
                              ? 'badge-blue'
                              : 'badge-green'
                        }`}
                      >
                        {(p as any).isService ? 'SERVICIO' : p.type === 'COMPUESTO' ? 'PROMO' : 'SIMPLE'}
                      </span>
                    </td>

                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {p.components?.length
                        ? p.components
                            .map(
                              (c: ProductComponent) =>
                                `${c.component?.name ?? 'Componente'} x${
                                  c.quantity ?? c.quantityKg ?? 0
                                }${c.quantityKg ? 'kg' : ''}`
                            )
                            .join(', ')
                        : '—'}
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(p)}
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteProduct(p)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <Package size={36} />
              <p>Sin productos</p>
            </div>
          )}
        </div>

        <div className="products-mobile-list">
          {loading ? (
            <div style={{ padding: 12 }}>
              <div className="skeleton" style={{ height: 180, borderRadius: 16 }} />
            </div>
          ) : (
            paginatedProducts.map((p) => {
              const isService = Boolean((p as any).isService);
              const isLowStock = !isService && productStock(p) <= productMinStock(p);
              const typeLabel = isService ? 'SERVICIO' : p.type === 'COMPUESTO' ? 'PROMO' : 'SIMPLE';
              const stockLabel = isService
                ? 'Servicio'
                : `${productStock(p)}${p.saleUnit === 'KG' ? ' kg' : ''}`;
              const secondaryStockLabel = isService
                ? '—'
                : p.saleUnit === 'KG'
                  ? `${num(p.stockDepositoKg)} kg`
                  : String(num(p.stockDeposito));

              return (
                <article className="products-mobile-item" key={p.id}>
                  <div className="products-mobile-head">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="products-mobile-img" />
                    ) : (
                      <span className="products-mobile-img products-mobile-placeholder">
                        <Package size={15} />
                      </span>
                    )}

                    <div className="products-mobile-title">
                      <div className="products-mobile-title-line">
                        <b>{p.name}</b>
                        <span
                          className={`badge ${
                            isService ? 'badge-gray' : p.type === 'COMPUESTO' ? 'badge-blue' : 'badge-green'
                          }`}
                        >
                          {typeLabel}
                        </span>
                      </div>

                      <span>{p.sku ?? 'SIN-SKU'} · {categoryName(p)}</span>
                    </div>
                  </div>

                  <div className="products-mobile-quick">
                    <div>
                      <small>Precio</small>
                      <strong>
                        {fmtMoney(getProductPublicPrice(p))}
                        {unitSuffix(p)}
                      </strong>
                    </div>

                    <div>
                      <small>Stock mayorista</small>
                      <strong className={isLowStock ? 'products-danger-text' : ''}>
                        {stockLabel}
                      </strong>
                    </div>

                    <div>
                      <small>Stock minorista</small>
                      <strong>{secondaryStockLabel}</strong>
                    </div>
                  </div>

                  <div className="products-mobile-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => setMobileProductSheet(p)}>
                      Ver más
                    </button>

                    <button className="btn btn-primary btn-sm" onClick={() => openEdit(p)}>
                      <Edit2 size={13} /> Editar
                    </button>
                  </div>
                </article>
              );
            })
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <Package size={36} />
              <p>Sin productos</p>
            </div>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="products-pagination">
            <div className="products-pagination-info">
              Mostrando {pageStart} - {pageEnd} de {filtered.length} productos
            </div>

            <div className="products-pagination-actions">
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </button>

              <span className="products-pagination-page">
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

      {mobileProductSheet && typeof document !== 'undefined' &&
        createPortal(
          <div className="products-mobile-sheet-backdrop" onClick={() => setMobileProductSheet(null)}>
            <div className="products-mobile-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="products-mobile-sheet-handle" />

              <div className="products-mobile-sheet-header">
                <div className="products-mobile-sheet-product">
                  {mobileProductSheet.imageUrl ? (
                    <img src={mobileProductSheet.imageUrl} alt="" />
                  ) : (
                    <span>
                      <Package size={17} />
                    </span>
                  )}

                  <div>
                    <b>{mobileProductSheet.name}</b>
                    <small>
                      {mobileProductSheet.sku ?? 'SIN-SKU'} · {categoryName(mobileProductSheet)}
                    </small>
                  </div>
                </div>

                <button className="btn btn-ghost btn-sm" onClick={() => setMobileProductSheet(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="products-mobile-sheet-body">
                <div className="products-mobile-sheet-grid">
                  <div>
                    <small>Precio público</small>
                    <strong>
                      {fmtMoney(getProductPublicPrice(mobileProductSheet))}
                      {unitSuffix(mobileProductSheet)}
                    </strong>
                  </div>

                  <div>
                    <small>Precio cliente</small>
                    <strong>
                      {fmtMoney(getProductClientPrice(mobileProductSheet))}
                      {unitSuffix(mobileProductSheet)}
                    </strong>
                  </div>

                  <div>
                    <small>Precio mayorista</small>
                    <strong>
                      {fmtMoney(getProductWholesalePrice(mobileProductSheet))}
                      {unitSuffix(mobileProductSheet)}
                    </strong>
                  </div>

                  <div>
                    <small>Costo bruto</small>
                    <strong>
                      {fmtMoney(getProductGrossCost(mobileProductSheet))}
                      {unitSuffix(mobileProductSheet)}
                    </strong>
                  </div>

                  <div>
                    <small>Ganancia</small>
                    <strong className={getProfit(mobileProductSheet) < 0 ? 'products-danger-text' : ''}>
                      {fmtMoney(getProfit(mobileProductSheet))}
                      {getProfitPercent(mobileProductSheet) === null
                        ? ''
                        : ` (${getProfitPercent(mobileProductSheet)!.toFixed(1)}%)`}
                    </strong>
                  </div>

                  <div>
                    <small>Stock mayorista</small>
                    <strong
                      className={
                        !(mobileProductSheet as any).isService &&
                        productStock(mobileProductSheet) <= productMinStock(mobileProductSheet)
                          ? 'products-danger-text'
                          : ''
                      }
                    >
                      {(mobileProductSheet as any).isService
                        ? 'No descuenta'
                        : `${productStock(mobileProductSheet)}${mobileProductSheet.saleUnit === 'KG' ? ' kg' : ''}`}
                    </strong>
                  </div>

                  <div>
                    <small>Stock minorista</small>
                    <strong>
                      {(mobileProductSheet as any).isService
                        ? '—'
                        : mobileProductSheet.saleUnit === 'KG'
                          ? `${num(mobileProductSheet.stockDepositoKg)} kg`
                          : num(mobileProductSheet.stockDeposito)}
                    </strong>
                  </div>

                  <div>
                    <small>Tipo</small>
                    <strong>
                      {(mobileProductSheet as any).isService
                        ? 'Servicio'
                        : mobileProductSheet.type === 'COMPUESTO'
                          ? 'Promo / compuesto'
                          : 'Simple'}
                    </strong>
                  </div>
                </div>

                {(mobileProductSheet as any).description ? (
                  <div className="products-mobile-sheet-box">
                    <small>Descripción</small>
                    <p>{(mobileProductSheet as any).description}</p>
                  </div>
                ) : null}

                {mobileProductSheet.components?.length ? (
                  <div className="products-mobile-sheet-box">
                    <small>Componentes</small>
                    <p>
                      {mobileProductSheet.components
                        .map(
                          (c: ProductComponent) =>
                            `${c.component?.name ?? 'Componente'} x${
                              c.quantity ?? c.quantityKg ?? 0
                            }${c.quantityKg ? 'kg' : ''}`
                        )
                        .join(', ')}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="products-mobile-sheet-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const product = mobileProductSheet;
                    setMobileProductSheet(null);
                    openEdit(product);
                  }}
                >
                  <Edit2 size={15} /> Editar producto
                </button>

                <button
                  className="btn btn-danger"
                  onClick={() => {
                    const product = mobileProductSheet;
                    setMobileProductSheet(null);
                    deleteProduct(product);
                  }}
                >
                  <Trash2 size={15} /> Eliminar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {(modal === 'product-create' || modal === 'product-edit') && typeof document !== 'undefined' &&
        createPortal(
        <div className="modal-overlay">
          <div className="modal products-product-modal" style={{ maxWidth: 820 }}>
            <div className="modal-header">
              <b>{modal === 'product-create' ? 'Nuevo producto' : 'Editar producto'}</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body products-product-modal-body">
              <div className="products-mobile-form-tabs">
                <button
                  type="button"
                  className={productFormStep === 'basico' ? 'is-active' : ''}
                  onClick={() => setProductFormStep('basico')}
                >
                  1. Básico
                </button>

                <button
                  type="button"
                  className={productFormStep === 'precios' ? 'is-active' : ''}
                  onClick={() => setProductFormStep('precios')}
                >
                  2. Precios / stock
                </button>

                {form.isService !== 'true' && form.type === 'COMPUESTO' && (
                  <button
                    type="button"
                    className={productFormStep === 'componentes' ? 'is-active' : ''}
                    onClick={() => setProductFormStep('componentes')}
                  >
                    3. Componentes
                  </button>
                )}
              </div>

              <section className={`products-form-section ${productFormStep === 'basico' ? 'products-form-section-active' : ''}`}>
                <div className="products-mobile-section-title">
                  <b>Datos principales</b>
                  <small>Nombre, SKU, foto y tipo de producto.</small>
                </div>

              <div className="form-row products-form-row">
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">SKU *</label>
                  <input
                    value={form.sku}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, sku: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Descripción del producto para el sistema y la futura web..."
                  rows={3}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    minHeight: 90,
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Imagen del producto</label>

                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <label
                    className="btn btn-secondary btn-sm"
                    style={{ cursor: 'pointer' }}
                  >
                    <ImagePlus size={14} />
                    Seleccionar imagen

                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      hidden
                      onChange={(e) => handleImageChange(e.target.files?.[0])}
                    />
                  </label>

                  {imageFile ? (
                    <span style={{ color: 'var(--text2)', fontSize: 12 }}>
                      {imageFile.name}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text3)', fontSize: 12 }}>
                      JPG, PNG o WEBP. Máximo 5MB.
                    </span>
                  )}
                </div>

                {imagePreview ? (
                  <div
                    style={{
                      marginTop: 10,
                      width: 110,
                      height: 110,
                      borderRadius: 14,
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      background: 'var(--surface2)',
                    }}
                  >
                    <img
                      src={imagePreview}
                      alt="Vista previa"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                ) : null}
              </div>

              <div className="form-row products-form-row">
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select
                    value={form.type}
                    disabled={form.isService === 'true'}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        type: e.target.value,
                        saleUnit: e.target.value === 'COMPUESTO' ? 'UNIT' : p.saleUnit,
                      }))
                    }
                  >
                    <option value="SIMPLE">Simple</option>
                    <option value="COMPUESTO">Promo / compuesto</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Categoría</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, categoryId: e.target.value }))
                    }
                  >
                    <option value="">Sin categoría</option>
                    {categories
                      .filter((c) => c.isActive)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="form-row products-form-row">
                <div className="form-group">
                  <label className="form-label">Producto / servicio</label>
                  <select
                    value={form.isService}
                    onChange={(e) => {
                      const nextIsService = e.target.value === 'true';

                      setForm((p) => ({
                        ...p,
                        isService: String(nextIsService),
                        type: nextIsService ? 'SIMPLE' : p.type,
                        saleUnit: nextIsService ? 'UNIT' : p.saleUnit,
                        stockLocal: nextIsService ? '0' : p.stockLocal,
                        stockDeposito: nextIsService ? '0' : p.stockDeposito,
                        stockLocalKg: nextIsService ? '0' : p.stockLocalKg,
                        stockDepositoKg: nextIsService ? '0' : p.stockDepositoKg,
                        minStock: nextIsService ? '0' : p.minStock,
                        minStockKg: nextIsService ? '0' : p.minStockKg,
                      }));

                      if (nextIsService) setComponents([]);
                    }}
                  >
                    <option value="false">Producto físico</option>
                    <option value="true">Servicio</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Unidad de venta</label>
                  <select
                    value={form.saleUnit}
                    disabled={form.type === 'COMPUESTO' || form.isService === 'true'}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, saleUnit: e.target.value }))
                    }
                  >
                    <option value="UNIT">Unidad</option>
                    <option value="KG">Kilogramo</option>
                  </select>
                </div>

{form.isService !== 'true' && (
                <div className="form-group">
                  <label className="form-label">Stock mínimo</label>
                  <input
                    type="number"
                    value={form.saleUnit === 'KG' ? form.minStockKg : form.minStock}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        [form.saleUnit === 'KG' ? 'minStockKg' : 'minStock']:
                          e.target.value,
                      }))
                    }
                  />
                </div>
                )}
              </div>

              </section>

              <section className={`products-form-section ${productFormStep === 'precios' ? 'products-form-section-active' : ''}`}>
                <div className="products-mobile-section-title">
                  <b>Precios y stock</b>
                  <small>Valores de venta, costo, stock inicial y mínimo.</small>
                </div>

              {form.saleUnit === 'KG' ? (
                <div
                  className="products-price-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Precio público/kg</label>
                    <input
                      type="number"
                      value={form.pricePerKg}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, pricePerKg: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cliente/kg</label>
                    <input
                      type="number"
                      value={form.clientPricePerKg}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          clientPricePerKg: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mayorista/kg</label>
                    <input
                      type="number"
                      value={form.wholesalePricePerKg}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          wholesalePricePerKg: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Costo de compra/kg</label>
                    <input
                      type="number"
                      value={form.purchasePrice}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          purchasePrice: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Stock Mayorista kg</label>
                    <input
                      type="number"
                      value={form.stockLocalKg}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, stockLocalKg: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Stock Minorista kg</label>
                    <input
                      type="number"
                      value={form.stockDepositoKg}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          stockDepositoKg: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="products-price-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Precio público</label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, price: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Precio cliente</label>
                    <input
                      type="number"
                      value={form.clientPrice}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, clientPrice: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mayorista</label>
                    <input
                      type="number"
                      value={form.wholesalePrice}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          wholesalePrice: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      {form.type === 'COMPUESTO' ? 'Costo manual' : 'Costo de compra'}
                    </label>
                    <input
                      type="number"
                      value={form.purchasePrice}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          purchasePrice: e.target.value,
                        }))
                      }
                    />
                  </div>

                  {form.type !== 'COMPUESTO' && form.isService !== 'true' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Stock Mayorista</label>
                        <input
                          type="number"
                          value={form.stockLocal}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              stockLocal: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Stock Minorista</label>
                        <input
                          type="number"
                          value={form.stockDeposito}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              stockDeposito: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              </section>

              <section className={`products-form-section ${productFormStep === 'componentes' ? 'products-form-section-active' : ''}`}>
                <div className="products-mobile-section-title">
                  <b>Componentes</b>
                  <small>Elegí qué productos descuenta esta promo o combo.</small>
                </div>

              {form.isService !== 'true' && form.type === 'COMPUESTO' && (
                <div className="card products-components-card" style={{ padding: 14, marginTop: 10 }}>
                  <div
                    className="products-components-head"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}
                  >
                    <b>
                      <Layers size={14} /> Componentes de la promo
                    </b>

                    <button className="btn btn-secondary btn-sm" onClick={addComponent}>
                      <Plus size={13} /> Agregar
                    </button>
                  </div>

                  {components.map((c, idx) => (
                    <div key={idx} className="form-row products-form-row">
                      <div className="form-group">
                        <select
                          value={c.componentId}
                          onChange={(e) =>
                            setComponent(idx, 'componentId', e.target.value)
                          }
                        >
                          <option value="">Seleccionar producto simple...</option>
                          {simpleProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · stock {productStock(p)}{' '}
                              {p.saleUnit === 'KG' ? 'kg' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <input
                          placeholder="Cantidad"
                          value={c.quantity}
                          onChange={(e) =>
                            setComponent(idx, 'quantity', e.target.value)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </section>
            </div>

            <div className="modal-footer products-product-modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                onClick={saveProduct}
                disabled={saving || !form.name || !form.sku}
              >
                {saving ? <span className="spinner" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      {modal === 'category' && typeof document !== 'undefined' &&
        createPortal(
        <div className="modal-overlay">
          <div className="modal products-small-modal">
            <div className="modal-header">
              <b>Nueva categoría</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Ej: Bebidas, Agro, Repuestos"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                onClick={saveCategory}
                disabled={saving || !categoryForm.name}
              >
                {saving ? <span className="spinner" /> : 'Crear'}
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      {confirmModal && typeof document !== 'undefined' &&
        createPortal(
        <div className="modal-overlay">
          <div className="modal products-small-modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <b>{confirmModal.title}</b>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => !confirmLoading && setConfirmModal(null)}
                disabled={confirmLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: confirmModal.danger
                      ? 'rgba(239,68,68,0.12)'
                      : 'var(--surface2)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle
                    size={18}
                    style={{
                      color: confirmModal.danger ? 'var(--danger)' : 'var(--accent)',
                    }}
                  />
                </span>

                <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.55, margin: 0 }}>
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmModal(null)}
                disabled={confirmLoading}
              >
                Cancelar
              </button>

              <button
                className={confirmModal.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={confirmAction}
                disabled={confirmLoading}
              >
                {confirmLoading ? <span className="spinner" /> : confirmModal.confirmText ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 11000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(0, 0, 0, 0.45);
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

        .products-product-modal {
          width: min(820px, calc(100vw - 36px));
        }

        .products-small-modal {
          width: min(520px, calc(100vw - 36px));
        }

        .products-product-modal-body {
          padding: 16px;
        }

        .products-pagination {
          border-top: 1px solid var(--border);
          padding: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          background: var(--surface);
        }

        .products-pagination-info {
          color: var(--text3);
          font-size: 12px;
          font-weight: 800;
        }

        .products-pagination-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .products-pagination-page {
          color: var(--text2);
          font-size: 12px;
          font-weight: 900;
          padding: 0 4px;
        }

        .products-actions {
          align-items: center;
        }

        .products-actions .btn {
          white-space: nowrap;
          flex-shrink: 0;
        }

        .products-table-card {
          min-width: 0;
          overflow: hidden;
        }

        .products-desktop-table {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
        }

        .products-desktop-table table {
          width: 100%;
          min-width: 0;
        }

        .products-desktop-table th,
        .products-desktop-table td {
          vertical-align: middle;
        }

        .products-category-action {
          display: flex;
          justify-content: flex-end;
          margin: 0 0 14px;
        }

        .products-category-btn {
          min-width: 190px;
          justify-content: center;
          white-space: nowrap;
        }

        .products-mobile-list {
          display: none;
        }

        .products-danger-text {
          color: var(--danger);
        }


        .products-mobile-form-tabs,
        .products-mobile-section-title {
          display: none;
        }

        .products-form-section {
          display: block;
        }


        @media (min-width: 769px) {
          .products-stats-grid,
          .products-category-action,
          .products-filters,
          .products-table-card {
            width: 100%;
            max-width: 100%;
            min-width: 0;
          }

          .products-actions {
            margin-right: 0;
            max-width: 100%;
          }

          .products-desktop-table {
            overflow-x: hidden;
          }

          .products-desktop-table table {
            table-layout: fixed;
            width: 100%;
            min-width: 0;
          }

          .products-desktop-table th,
          .products-desktop-table td {
            padding-left: 10px;
            padding-right: 10px;
            font-size: 12px;
            line-height: 1.35;
            overflow: hidden;
          }

          .products-desktop-table th {
            font-size: 10px;
            letter-spacing: 0.18em;
          }

          .products-desktop-table td:nth-child(1) > div,
          .products-desktop-table td:nth-child(3) > div,
          .products-desktop-table td:nth-child(5) > div,
          .products-desktop-table td:nth-child(9) {
            min-width: 0;
          }

          .products-desktop-table td:nth-child(1) img,
          .products-desktop-table td:nth-child(1) span[style*='width: 34px'] {
            width: 30px !important;
            height: 30px !important;
            border-radius: 8px !important;
          }

          .products-desktop-table td:nth-child(1) div[style*='font-weight: 800'] {
            font-size: 12px !important;
            line-height: 1.2;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .products-desktop-table td:nth-child(1) div[style*='maxWidth: 260'] {
            max-width: 100% !important;
          }

          .products-desktop-table td:nth-child(3) div,
          .products-desktop-table td:nth-child(4),
          .products-desktop-table td:nth-child(5) div,
          .products-desktop-table td:nth-child(6) span,
          .products-desktop-table td:nth-child(7) span {
            font-size: 11px !important;
          }

          .products-desktop-table td:nth-child(9) {
            color: var(--text2);
            font-size: 11px !important;
            line-height: 1.35;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .products-desktop-table td:nth-child(10) .btn {
            width: 28px;
            height: 28px;
            min-height: 28px;
            padding: 0;
          }

          .products-desktop-table th:nth-child(1),
          .products-desktop-table td:nth-child(1) {
            width: 16%;
          }

          .products-desktop-table th:nth-child(2),
          .products-desktop-table td:nth-child(2) {
            width: 10%;
          }

          .products-desktop-table th:nth-child(3),
          .products-desktop-table td:nth-child(3) {
            width: 11%;
          }

          .products-desktop-table th:nth-child(4),
          .products-desktop-table td:nth-child(4),
          .products-desktop-table th:nth-child(5),
          .products-desktop-table td:nth-child(5) {
            width: 9%;
          }

          .products-desktop-table th:nth-child(6),
          .products-desktop-table td:nth-child(6),
          .products-desktop-table th:nth-child(7),
          .products-desktop-table td:nth-child(7) {
            width: 10%;
          }

          .products-desktop-table th:nth-child(8),
          .products-desktop-table td:nth-child(8) {
            width: 8%;
          }

          .products-desktop-table th:nth-child(9),
          .products-desktop-table td:nth-child(9) {
            width: 13%;
          }

          .products-desktop-table th:nth-child(10),
          .products-desktop-table td:nth-child(10) {
            width: 5%;
          }
        }

        @media (max-width: 980px) {
          .products-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 768px) {
          .products-actions {
            margin-right: 0;
          }

          .modal-overlay {
            align-items: flex-end;
            justify-content: center;
            padding: 0;
            overflow: hidden;
          }

          .modal {
            margin: 0;
            max-height: calc(100dvh - 8px);
          }

          .products-pagination {
            display: grid;
            grid-template-columns: 1fr;
            justify-items: stretch;
            padding: 10px;
            gap: 8px;
          }

          .products-pagination-info {
            text-align: center;
            font-size: 11px;
          }

          .products-pagination-actions {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .products-pagination-actions button {
            width: 100%;
            justify-content: center;
          }

          .products-pagination-page {
            text-align: center;
          }

          .products-actions {
            width: 100%;
            display: grid !important;
            grid-template-columns: 1fr;
            gap: 8px !important;
          }

          .products-actions button {
            width: 100%;
            justify-content: center;
          }

          .products-toast {
            top: 12px !important;
            right: 12px !important;
            left: 12px !important;
            min-width: 0 !important;
            max-width: none !important;
          }

          .products-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }

          .products-stats-grid .stat-card {
            min-height: 66px;
            padding: 10px !important;
          }

          .products-stats-grid .stat-value {
            font-size: 18px !important;
            line-height: 1.1;
          }

          .products-stats-grid .stat-label {
            font-size: 10px !important;
            line-height: 1.2;
          }

          .products-category-action {
            justify-content: stretch;
            margin: 0 0 10px;
          }

          .products-category-btn {
            width: 100%;
            min-width: 0;
            height: 36px;
          }

          .products-filters {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }

          .products-search {
            min-width: 0 !important;
            width: 100%;
          }

          .products-search input,
          .products-filter-select,
          .products-refresh-btn {
            width: 100% !important;
          }

          .products-refresh-btn {
            justify-content: center;
            height: 36px;
          }

          .products-search input,
          .products-filter-select {
            min-height: 36px;
            height: 36px;
            font-size: 13px;
          }

          .products-table-card {
            overflow: hidden;
            border-radius: 18px;
          }

          .products-desktop-table {
            display: none;
          }

          .products-mobile-list {
            display: grid;
            gap: 8px;
            padding: 10px;
          }

          .products-mobile-item {
            display: grid;
            gap: 8px;
            border: 1px solid var(--border);
            border-radius: 15px;
            background: var(--surface2);
            padding: 10px;
            min-width: 0;
          }

          .products-mobile-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
            min-width: 0;
          }

          .products-mobile-img {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            object-fit: cover;
            flex-shrink: 0;
            border: 1px solid var(--border);
          }

          .products-mobile-placeholder {
            background: var(--surface);
            display: grid;
            place-items: center;
            color: var(--text3);
          }

          .products-mobile-title {
            display: grid;
            gap: 3px;
            min-width: 0;
            flex: 1;
          }

          .products-mobile-title-line {
            display: flex;
            align-items: center;
            gap: 7px;
            min-width: 0;
          }

          .products-mobile-title-line b {
            flex: 1;
            min-width: 0;
          }

          .products-mobile-title-line .badge {
            flex-shrink: 0;
            font-size: 9px;
            padding: 3px 6px;
          }

          .products-mobile-title b {
            color: var(--text);
            font-size: 14px;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .products-mobile-title span {
            font-family: var(--mono);
            color: var(--text3);
            font-size: 11px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .products-mobile-title p {
            margin: 0;
            color: var(--text2);
            font-size: 11px;
            line-height: 1.35;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }

          .products-mobile-head > .badge {
            flex-shrink: 0;
          }

          .products-mobile-quick {
            display: grid;
            grid-template-columns: 1.2fr 1fr 1fr;
            gap: 6px;
          }

          .products-mobile-quick > div {
            min-width: 0;
            border-radius: 11px;
            background: var(--surface);
            padding: 7px 8px;
          }

          .products-mobile-quick small {
            display: block;
            color: var(--text3);
            font-size: 9.5px;
            font-weight: 800;
            line-height: 1.15;
            margin-bottom: 3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .products-mobile-quick strong {
            display: block;
            font-family: var(--mono);
            font-size: 11px;
            line-height: 1.15;
            color: var(--text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .products-mobile-data {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .products-mobile-data > div {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border-radius: 13px;
            background: var(--surface);
            padding: 9px 10px;
            min-width: 0;
          }

          .products-mobile-data small,
          .products-mobile-components small {
            color: var(--text3);
            font-size: 11px;
            font-weight: 800;
          }

          .products-mobile-data strong {
            font-family: var(--mono);
            font-size: 12px;
            text-align: right;
            overflow-wrap: anywhere;
          }

          .products-mobile-components {
            display: grid;
            gap: 5px;
            border-radius: 13px;
            background: var(--surface);
            padding: 10px;
          }

          .products-mobile-components p {
            margin: 0;
            color: var(--text2);
            font-size: 12px;
            line-height: 1.45;
            overflow-wrap: anywhere;
          }

          .products-mobile-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 7px;
          }

          .products-mobile-actions button {
            width: 100%;
            justify-content: center;
            min-height: 32px;
          }

          .products-mobile-sheet-backdrop {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            background: rgba(0, 0, 0, 0.48);
            padding: 0;
          }

          .products-mobile-sheet {
            width: 100%;
            max-height: min(82dvh, 620px);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            border-radius: 22px 22px 0 0;
            border: 1px solid var(--border);
            background: var(--surface);
            box-shadow: 0 -18px 60px rgba(0, 0, 0, 0.35);
          }

          .products-mobile-sheet-handle {
            width: 44px;
            height: 4px;
            border-radius: 999px;
            background: var(--border);
            margin: 10px auto 8px;
            flex-shrink: 0;
          }

          .products-mobile-sheet-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 0 14px 12px;
            border-bottom: 1px solid var(--border);
          }

          .products-mobile-sheet-product {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
            flex: 1;
          }

          .products-mobile-sheet-product img,
          .products-mobile-sheet-product span {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            border: 1px solid var(--border);
            flex-shrink: 0;
            object-fit: cover;
          }

          .products-mobile-sheet-product span {
            display: grid;
            place-items: center;
            background: var(--surface2);
            color: var(--text3);
          }

          .products-mobile-sheet-product b {
            display: block;
            font-size: 14px;
            line-height: 1.2;
            color: var(--text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .products-mobile-sheet-product small {
            display: block;
            margin-top: 3px;
            color: var(--text3);
            font-size: 11px;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .products-mobile-sheet-body {
            overflow-y: auto;
            padding: 12px 14px;
            display: grid;
            gap: 10px;
          }

          .products-mobile-sheet-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .products-mobile-sheet-grid > div,
          .products-mobile-sheet-box {
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--surface2);
            padding: 10px;
            min-width: 0;
          }

          .products-mobile-sheet-grid small,
          .products-mobile-sheet-box small {
            display: block;
            color: var(--text3);
            font-size: 10px;
            font-weight: 800;
            margin-bottom: 5px;
          }

          .products-mobile-sheet-grid strong {
            display: block;
            font-family: var(--mono);
            font-size: 12px;
            color: var(--text);
            overflow-wrap: anywhere;
          }

          .products-mobile-sheet-box p {
            margin: 0;
            color: var(--text2);
            font-size: 12px;
            line-height: 1.45;
            overflow-wrap: anywhere;
          }

          .products-mobile-sheet-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
            border-top: 1px solid var(--border);
            background: var(--surface);
          }

          .products-mobile-sheet-actions button {
            width: 100%;
            justify-content: center;
          }

          .products-product-modal,
          .products-small-modal {
            width: calc(100vw - 24px) !important;
            max-width: calc(100vw - 24px) !important;
            max-height: calc(100dvh - 24px);
            overflow: auto;
            border-radius: 18px;
          }

          .products-product-modal {
            align-self: flex-end;
            width: 100vw !important;
            max-width: 100vw !important;
            height: min(96dvh, calc(100dvh - 6px));
            max-height: min(96dvh, calc(100dvh - 6px));
            border-radius: 22px 22px 0 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .products-product-modal .modal-header {
            position: relative;
            top: auto;
            z-index: 5;
            flex-shrink: 0;
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            min-height: 52px;
          }

          .products-product-modal-body {
            flex: 1 1 auto;
            min-height: 0;
            padding: 0 !important;
            overflow-y: auto !important;
            overflow-x: hidden;
            background: var(--bg);
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            padding-bottom: 92px !important;
          }

          .products-mobile-form-tabs {
            position: sticky;
            top: 0;
            z-index: 4;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
            padding: 10px 12px;
            border-bottom: 1px solid var(--border);
            background: var(--surface);
          }

          .products-mobile-form-tabs button {
            border: 1px solid var(--border);
            background: var(--surface2);
            color: var(--text2);
            border-radius: 999px;
            min-height: 34px;
            padding: 0 10px;
            font-size: 11px;
            font-weight: 900;
            white-space: nowrap;
          }

          .products-mobile-form-tabs button.is-active {
            border-color: var(--accent);
            color: var(--accent);
            background: color-mix(in srgb, var(--accent) 12%, var(--surface));
          }

          .products-form-section {
            display: none;
            padding: 12px;
          }

          .products-form-section-active {
            display: grid;
            gap: 10px;
          }

          .products-mobile-section-title {
            display: grid;
            gap: 3px;
            border: 1px solid var(--border);
            border-radius: 16px;
            background: var(--surface);
            padding: 11px 12px;
          }

          .products-mobile-section-title b {
            font-size: 14px;
            line-height: 1.2;
            color: var(--text);
          }

          .products-mobile-section-title small {
            color: var(--text3);
            font-size: 11px;
            line-height: 1.35;
          }

          .products-form-section .form-group,
          .products-form-section .form-row,
          .products-form-section .products-price-grid,
          .products-form-section .products-components-card {
            border: 1px solid var(--border);
            border-radius: 15px;
            background: var(--surface);
            padding: 10px;
          }

          .products-form-section .form-row .form-group,
          .products-form-section .products-price-grid .form-group,
          .products-form-section .products-components-card .form-group {
            border: 0;
            border-radius: 0;
            background: transparent;
            padding: 0;
          }

          .products-form-section input,
          .products-form-section select,
          .products-form-section textarea {
            min-height: 38px;
            font-size: 14px;
          }

          .products-form-section textarea {
            min-height: 78px !important;
          }

          .products-product-modal-footer {
            position: relative;
            bottom: auto;
            z-index: 6;
            flex-shrink: 0;
            padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
            border-top: 1px solid var(--border);
            background: var(--surface);
            box-shadow: 0 -12px 30px rgba(0, 0, 0, 0.22);
          }

          .products-form-row {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .products-price-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .products-components-card {
            padding: 12px !important;
            border-radius: 16px;
          }

          .products-components-head {
            gap: 10px;
            align-items: flex-start;
          }

          .products-components-head b {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
          }

          .modal-footer {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .modal-footer button {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 420px) {
          .products-mobile-list {
            padding: 8px;
          }

          .products-mobile-item {
            border-radius: 14px;
            padding: 9px;
          }

          .products-mobile-head {
            align-items: center;
          }

          .products-mobile-img {
            width: 36px;
            height: 36px;
          }

          .products-mobile-title b,
          .products-mobile-title span {
            white-space: nowrap;
          }

          .products-mobile-quick {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .products-mobile-quick > div {
            padding: 6px;
          }

          .products-mobile-quick small {
            font-size: 9px;
          }

          .products-mobile-quick strong {
            font-size: 10px;
          }

          .products-mobile-actions {
            grid-template-columns: 1fr 1fr;
          }

          .products-mobile-sheet-grid,
          .products-mobile-sheet-actions {
            grid-template-columns: 1fr;
          }

          .products-mobile-form-tabs {
            display: flex;
            overflow-x: auto;
            scrollbar-width: none;
          }

          .products-mobile-form-tabs::-webkit-scrollbar {
            display: none;
          }

          .products-mobile-form-tabs button {
            flex: 0 0 auto;
          }

          .products-components-head {
            flex-direction: column;
          }

          .products-components-head button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </AppLayout>
  );
}