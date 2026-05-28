'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { Product, ProductCategory, ProductComponent } from '@/types';
import {
  categoryName,
  fmtMoney,
  normalizeArray,
  num,
  productMinStock,
  productPrice,
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
} from 'lucide-react';

type Modal = 'product-create' | 'product-edit' | 'category' | null;
type ComponentForm = { componentId: string; quantity: string; quantityKg: string };

const emptyProductForm = {
  name: '',
  description: '',
  sku: '',
  type: 'SIMPLE',
  categoryId: '',
  saleUnit: 'UNIT',
  price: '',
  clientPrice: '',
  wholesalePrice: '',
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
  const [components, setComponents] = useState<ComponentForm[]>([]);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        api.get('/products'),
        api.get('/categories?includeInactive=true'),
      ]);

      setProducts(normalizeArray<Product>(pRes.data));
      setCategories(normalizeArray<ProductCategory>(cRes.data));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const simpleProducts = useMemo(
    () => products.filter((p) => p.type === 'SIMPLE' && p.isActive !== false),
    [products]
  );

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesText =
      !q ||
      p.name.toLowerCase().includes(q) ||
      String(p.sku ?? '').toLowerCase().includes(q) ||
      String((p as any).description ?? '').toLowerCase().includes(q);

    const matchesCat = !categoryId || p.categoryId === categoryId;

    return matchesText && matchesCat;
  });

  const resetImage = () => {
    setImageFile(null);
    setImagePreview('');
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyProductForm, categoryId: categories[0]?.id ?? '' });
    setComponents([]);
    resetImage();
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
      saleUnit: product.saleUnit,

      price: String(product.price ?? ''),
      clientPrice: String(product.clientPrice ?? ''),
      wholesalePrice: String(product.wholesalePrice ?? ''),

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
    setModal('product-edit');
  };

  const handleImageChange = (file?: File | null) => {
    if (!file) {
      resetImage();
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('El archivo debe ser una imagen');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const buildPayloadObject = () => {
    return {
      ...form,

      description: form.description?.trim() || '',

      price: num(form.price),
      clientPrice: num(form.clientPrice),
      wholesalePrice: num(form.wholesalePrice),

      pricePerKg: form.pricePerKg === '' ? undefined : num(form.pricePerKg),
      clientPricePerKg:
        form.clientPricePerKg === '' ? undefined : num(form.clientPricePerKg),
      wholesalePricePerKg:
        form.wholesalePricePerKg === '' ? undefined : num(form.wholesalePricePerKg),

      stockLocal: num(form.stockLocal),
      stockDeposito: num(form.stockDeposito),
      stockLocalKg: num(form.stockLocalKg),
      stockDepositoKg: num(form.stockDepositoKg),

      minStock: num(form.minStock),
      minStockKg: num(form.minStockKg),

      components:
        form.type === 'COMPUESTO'
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

      setModal(null);
      resetImage();
      await load();
    } catch (e: unknown) {
      alert(
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
      await load();
    } catch (e: unknown) {
      alert(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Error al crear categoría'
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!confirm(`¿Eliminar ${product.name}?`)) return;

    await api.delete(`/products/${product.id}`);
    await load();
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setModal('category')}
          >
            <Tags size={14} /> Categoría
          </button>

          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> Nuevo producto
          </button>
        </div>
      }
    >
      <div
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

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
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

        <button className="btn btn-secondary btn-sm" onClick={load}>
          <RefreshCcw size={14} /> Actualizar
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
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
                  <th>Precio</th>
                  <th>Stock local</th>
                  <th>Depósito</th>
                  <th>Tipo</th>
                  <th>Componentes</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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

                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 800 }}>
                      {fmtMoney(productPrice(p))}
                      {p.saleUnit === 'KG' ? '/kg' : ''}
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
                        {productStock(p)} {p.saleUnit === 'KG' ? 'kg' : ''}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontFamily: 'var(--mono)' }}>
                        {p.saleUnit === 'KG' ? num(p.stockDepositoKg) : num(p.stockDeposito)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          p.type === 'COMPUESTO' ? 'badge-blue' : 'badge-green'
                        }`}
                      >
                        {p.type === 'COMPUESTO' ? 'PROMO' : 'SIMPLE'}
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
      </div>

      {(modal === 'product-create' || modal === 'product-edit') && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <div className="modal" style={{ maxWidth: 820 }}>
            <div className="modal-header">
              <b>{modal === 'product-create' ? 'Nuevo producto' : 'Editar producto'}</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
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

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select
                    value={form.type}
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

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Unidad de venta</label>
                  <select
                    value={form.saleUnit}
                    disabled={form.type === 'COMPUESTO'}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, saleUnit: e.target.value }))
                    }
                  >
                    <option value="UNIT">Unidad</option>
                    <option value="KG">Kilogramo</option>
                  </select>
                </div>

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
              </div>

              {form.saleUnit === 'KG' ? (
                <div
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
                    <label className="form-label">Stock local kg</label>
                    <input
                      type="number"
                      value={form.stockLocalKg}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, stockLocalKg: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Depósito kg</label>
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

                  {form.type !== 'COMPUESTO' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Stock local</label>
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
                        <label className="form-label">Depósito</label>
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

              {form.type === 'COMPUESTO' && (
                <div className="card" style={{ padding: 14, marginTop: 10 }}>
                  <div
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
                    <div key={idx} className="form-row">
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
            </div>

            <div className="modal-footer">
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
      )}

      {modal === 'category' && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <div className="modal">
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
      )}
    </AppLayout>
  );
}