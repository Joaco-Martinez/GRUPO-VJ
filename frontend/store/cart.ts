'use client';

import { create } from 'zustand';
import type { CatalogProduct } from '@/lib/shop';

type CartItem = {
  product: CatalogProduct;
  quantity: number;
  quantityKg?: number;
};

type CartState = {
  items: CartItem[];
  add: (product: CatalogProduct, amount?: number) => void;
  remove: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  total: () => number;
  count: () => number;
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  add(product, amount = 1) {
    set((state) => {
      const existing = state.items.find((item) => item.product.id === product.id);

      if (existing) {
        return {
          items: state.items.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + amount }
              : item
          ),
        };
      }

      return {
        items: [...state.items, { product, quantity: amount }],
      };
    });
  },

  remove(productId) {
    set((state) => ({
      items: state.items.filter((item) => item.product.id !== productId),
    }));
  },

  setQuantity(productId, quantity) {
    const safeQuantity = Math.max(1, Number(quantity) || 1);

    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, quantity: safeQuantity } : item
      ),
    }));
  },

  clear() {
    set({ items: [] });
  },

  total() {
    return get().items.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  },

  count() {
    return get().items.reduce((acc, item) => acc + item.quantity, 0);
  },
}));
