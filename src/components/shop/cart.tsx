"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { CartItem } from "@/lib/shop-types";

// The cart lives in localStorage (like WooCommerce's session cart) and is
// shared across tabs. Adding a product shows WooCommerce's "has been added
// to your cart" notice instead of opening a drawer.
const KEY = "bf-cart-v1";
let saved: CartItem[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
function emit() {
  localStorage.setItem(KEY, JSON.stringify(saved));
  listeners.forEach((f) => f());
}
function subscribe(f: () => void) {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}
const empty: CartItem[] = [];
const Context = createContext<{
  items: CartItem[];
  added: { name: string; slug: string } | null;
  add: (i: CartItem) => void;
  setQuantity: (i: CartItem, n: number) => void;
  clear: () => void;
}>({
  items: [],
  added: null,
  add: () => {},
  setQuantity: () => {},
  clear: () => {},
});
export const useCart = () => useContext(Context);
export const cartKey = (i: CartItem) =>
  `${i.variantId ?? i.productId}:${JSON.stringify(Object.entries(i.options ?? {}).sort())}:${(
    i.addons ?? []
  )
    .map((a) => a.id)
    .sort()
    .join(",")}`;
function valid(i: CartItem) {
  return (
    i &&
    typeof i.productId === "string" &&
    Number.isInteger(i.quantity) &&
    i.quantity > 0 &&
    i.quantity <= 99 &&
    typeof i.price === "number"
  );
}
export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(
    subscribe,
    () => saved,
    () => empty,
  );
  const [added, setAdded] = useState<{ name: string; slug: string } | null>(
    null,
  );
  useEffect(() => {
    if (!hydrated) {
      hydrated = true;
      try {
        const value = JSON.parse(localStorage.getItem(KEY) ?? "[]");
        if (Array.isArray(value)) saved = value.filter(valid);
      } catch {}
      listeners.forEach((f) => f());
    }
    const sync = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      try {
        const value = JSON.parse(e.newValue ?? "[]");
        saved = Array.isArray(value) ? value.filter(valid) : [];
      } catch {
        saved = [];
      }
      listeners.forEach((f) => f());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const clear = useCallback(() => {
    saved = [];
    emit();
  }, []);
  return (
    <Context.Provider
      value={{
        items,
        added,
        clear,
        add: (i) => {
          const old = saved.find((v) => cartKey(v) === cartKey(i));
          saved = old
            ? saved.map((v) =>
                cartKey(v) === cartKey(i)
                  ? { ...v, quantity: Math.min(99, v.quantity + i.quantity) }
                  : v,
              )
            : [...saved, i];
          emit();
          setAdded({ name: i.name, slug: i.slug });
        },
        setQuantity: (i, n) => {
          if (!Number.isInteger(n)) return;
          saved =
            n <= 0
              ? saved.filter((v) => cartKey(v) !== cartKey(i))
              : saved.map((v) =>
                  cartKey(v) === cartKey(i)
                    ? { ...v, quantity: Math.min(99, n) }
                    : v,
                );
          emit();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
