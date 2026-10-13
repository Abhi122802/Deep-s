import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Cake } from '../types';
import { useToast } from './ToastContext';

interface WishlistContextType {
  wishlist: Cake[];
  toggleWishlist: (cake: Cake) => void;
  isInWishlist: (cakeId: string) => boolean;
  removeFromWishlist: (cakeId: string) => void;
  wishlistCount: number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const WISHLIST_STORAGE_KEY = 'deeps_cake_shop_wishlist';

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();

  const [wishlist, setWishlist] = useState<Cake[]>(() => {
    try {
      const saved = localStorage.getItem(WISHLIST_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    } catch {
      // Ignore write errors
    }
  }, [wishlist]);

  const isInWishlist = useCallback(
    (cakeId: string) => wishlist.some((c) => c.id === cakeId),
    [wishlist]
  );

  const toggleWishlist = useCallback(
    (cake: Cake) => {
      setWishlist((prev) => {
        const exists = prev.some((c) => c.id === cake.id);
        if (exists) {
          showToast(`Removed "${cake.name}" from your wishlist`, 'info');
          return prev.filter((c) => c.id !== cake.id);
        } else {
          showToast(`Saved "${cake.name}" to your wishlist!`, 'success');
          return [...prev, cake];
        }
      });
    },
    [showToast]
  );

  const removeFromWishlist = useCallback(
    (cakeId: string) => {
      setWishlist((prev) => prev.filter((c) => c.id !== cakeId));
    },
    []
  );

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        toggleWishlist,
        isInWishlist,
        removeFromWishlist,
        wishlistCount: wishlist.length,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = (): WishlistContextType => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
