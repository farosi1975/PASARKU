import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Product } from "@/data/catalog";

export type CartItem = Product & { quantity: number };

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const value = useMemo<CartContextValue>(() => {
    const addItem = (product: Product) => {
      setItems((current) => {
        if (product.stock === 0) return current;
        const existing = current.find((item) => item.id === product.id);
        if (existing) {
          const nextQuantity = product.stock === undefined ? existing.quantity + 1 : Math.min(existing.quantity + 1, product.stock);
          return current.map((item) => item.id === product.id ? { ...item, ...product, quantity: nextQuantity } : item);
        }
        return [...current, { ...product, quantity: 1 }];
      });
    };

    const removeItem = (productId: string) => setItems((current) => current.filter((item) => item.id !== productId));
    const updateQuantity = (productId: string, quantity: number) => {
      if (quantity <= 0) return removeItem(productId);
      setItems((current) => current.map((item) => item.id === productId ? { ...item, quantity: item.stock === undefined ? quantity : Math.min(quantity, item.stock) } : item));
    };
    const clearCart = () => setItems([]);

    return {
      items,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
