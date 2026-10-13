import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { Cake, CartItem, WeightOption } from '../types';
import { useToast } from './ToastContext';

interface CartContextType {
  items: CartItem[];
  addItem: (cake: Cake, selectedWeight: WeightOption, quantity?: number, customMessage?: string) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'deeps_cake_shop_cart';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Initialize from localStorage
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore write errors
    }
  }, [items]);

  const addItem = useCallback(
    (cake: Cake, selectedWeight: WeightOption, quantity = 1, customMessage = '') => {
      const unitPrice = cake.weightPrices[selectedWeight] || cake.basePrice;
      const cleanMessage = customMessage.trim();
      const itemId = `${cake.id}__${selectedWeight}__${cleanMessage || 'none'}`;

      setItems((prevItems) => {
        const existingIndex = prevItems.findIndex((it) => it.id === itemId);

        if (existingIndex > -1) {
          const updated = [...prevItems];
          updated[existingIndex].quantity += quantity;
          return updated;
        } else {
          return [
            ...prevItems,
            {
              id: itemId,
              cake,
              selectedWeight,
              unitPrice,
              quantity,
              customMessage: cleanMessage || undefined,
            },
          ];
        }
      });

      showToast(`Added ${cake.name} (${selectedWeight}) to your bakery cart!`, 'success');
      setIsCartOpen(true);
    },
    [showToast]
  );

  const removeItem = useCallback(
    (itemId: string) => {
      setItems((prev) => {
        const itemToRemove = prev.find((i) => i.id === itemId);
        if (itemToRemove) {
          showToast(`Removed ${itemToRemove.cake.name} from cart`, 'info');
        }
        return prev.filter((i) => i.id !== itemId);
      });
    },
    [showToast]
  );

  const updateQuantity = useCallback(
    (itemId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(itemId);
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, quantity } : i))
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => setIsCartOpen((prev) => !prev), []);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items]
  );

  // Free delivery for orders >= ₹799, otherwise ₹99 delivery charge
  const deliveryFee = useMemo(() => {
    if (items.length === 0) return 0;
    return subtotal >= 799 ? 0 : 99;
  }, [items.length, subtotal]);

  const total = useMemo(() => subtotal + deliveryFee, [subtotal, deliveryFee]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        subtotal,
        deliveryFee,
        total,
        isCartOpen,
        openCart,
        closeCart,
        toggleCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
