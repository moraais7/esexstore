import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "esex_cart_v1";
const CartContext = createContext(null);

const readStorage = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

export function CartProvider({ children }) {
  const [items, setItems] = useState(readStorage);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      /* armazenamento indisponível não impede a compra */
    }
  }, [items]);

  const addItem = (item, quantity = 1) => {
    setItems((previous) => {
      const existing = previous.find((entry) => entry.variant_id === item.variant_id);
      if (existing) {
        return previous.map((entry) =>
          entry.variant_id === item.variant_id
            ? { ...entry, quantity: Math.min(entry.quantity + quantity, Math.max(1, item.max_stock || 99)) }
            : entry
        );
      }
      return [...previous, { ...item, quantity }];
    });
  };

  const updateQuantity = (variantId, quantity) => {
    setItems((previous) =>
      previous
        .map((entry) => (entry.variant_id === variantId ? { ...entry, quantity } : entry))
        .filter((entry) => entry.quantity > 0)
    );
  };

  const removeItem = (variantId) => setItems((previous) => previous.filter((entry) => entry.variant_id !== variantId));

  const clear = () => setItems([]);

  const value = useMemo(() => {
    const count = items.reduce((total, item) => total + item.quantity, 0);
    const subtotal = items.reduce((total, item) => total + Number(item.unit_price || 0) * item.quantity, 0);
    return { items, count, subtotal, addItem, updateQuantity, removeItem, clear };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart precisa estar dentro de CartProvider");
  return context;
}