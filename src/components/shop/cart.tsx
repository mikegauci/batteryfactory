"use client";
import Link from "next/link";
import Image from "next/image";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CartItem } from "@/lib/shop-types";
import { formatPrice } from "@/lib/format";
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
  open: () => void;
  close: () => void;
  add: (i: CartItem) => void;
  setQuantity: (i: CartItem, n: number) => void;
  clear: () => void;
}>({
  items: [],
  open: () => {},
  close: () => {},
  add: () => {},
  setQuantity: () => {},
  clear: () => {},
});
export const useCart = () => useContext(Context);
const key = (i: CartItem) =>
  `${i.variantId ?? i.productId}:${JSON.stringify(Object.entries(i.options ?? {}).sort())}`;
export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(
    subscribe,
    () => saved,
    () => empty,
  );
  const [opened, setOpened] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!hydrated) {
      hydrated = true;
      try {
        const value = JSON.parse(localStorage.getItem(KEY) ?? "[]");
        if (Array.isArray(value))
          saved = value.filter(
            (i) =>
              i &&
              typeof i.productId === "string" &&
              Number.isInteger(i.quantity) &&
              i.quantity > 0 &&
              i.quantity <= 99 &&
              typeof i.price === "number",
          );
      } catch {}
      listeners.forEach((f) => f());
    }
    const sync = (e: StorageEvent) => {
      if (e.key === KEY) {
        try {
          saved = JSON.parse(e.newValue ?? "[]");
          if (!Array.isArray(saved)) saved = [];
        } catch {
          saved = [];
        }
        listeners.forEach((f) => f());
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (opened) dialog.current?.showModal();
    else dialog.current?.close();
  }, [opened]);
  const close = () => setOpened(false);
  const clear = useCallback(() => {
    saved = [];
    emit();
  }, []);
  return (
    <Context.Provider
      value={{
        items,
        open: () => setOpened(true),
        close,
        clear,
        add: (i) => {
          const old = saved.find((v) => key(v) === key(i));
          saved = old
            ? saved.map((v) =>
                key(v) === key(i)
                  ? { ...v, quantity: Math.min(99, v.quantity + i.quantity) }
                  : v,
              )
            : [...saved, i];
          emit();
          setOpened(true);
        },
        setQuantity: (i, n) => {
          if (!Number.isInteger(n)) return;
          saved =
            n <= 0
              ? saved.filter((v) => key(v) !== key(i))
              : saved.map((v) =>
                  key(v) === key(i) ? { ...v, quantity: Math.min(99, n) } : v,
                );
          emit();
        },
      }}
    >
      {children}
      <dialog
        ref={dialog}
        onCancel={close}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        className="shop-drawer fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[420px] max-w-full bg-white p-0 backdrop:bg-black/50"
        aria-labelledby="cart-title"
      >
        <div className="flex h-full flex-col p-6">
          <div className="mb-6 flex justify-between">
            <h2 id="cart-title" className="text-xl font-bold">
              Shopping cart
            </h2>
            <button autoFocus onClick={close} aria-label="Close cart">
              ✕
            </button>
          </div>
          <CartLines />
          <div className="mt-auto pt-6">
            {items.length > 0 && (
              <>
                <p className="mb-5 flex justify-between font-bold">
                  <span>Subtotal</span>
                  {formatPrice(
                    items.reduce((n, i) => n + i.price * i.quantity, 0),
                  )}
                </p>
                <Link
                  onClick={close}
                  href="/cart/"
                  className="shop-button mb-3 block text-center"
                >
                  View cart
                </Link>
                <Link
                  onClick={close}
                  href="/checkout/"
                  className="shop-button block text-center"
                >
                  Checkout
                </Link>
              </>
            )}
            <Link
              href="/shop/"
              onClick={close}
              className="mt-5 block text-center text-sm underline"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      </dialog>
    </Context.Provider>
  );
}
export function CartLines() {
  const { items, setQuantity, close } = useCart();
  return (
    <div className="space-y-5 overflow-auto">
      {!items.length ? (
        <p>There are no products in the cart!</p>
      ) : (
        items.map((i) => (
          <div
            key={key(i)}
            className="flex gap-4 border-b border-black/10 pb-5"
          >
            {i.image && (
              <Image
                unoptimized
                width={1000}
                height={1000}
                src={i.image}
                alt=""
                className="size-20 object-cover"
              />
            )}
            <div className="flex-1">
              <Link
                onClick={close}
                href={`/product/${i.slug}/`}
                className="font-semibold"
              >
                {i.name}
              </Link>
              <p className="text-sm">{Object.values(i.options).join(" / ")}</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <input
                  aria-label={`Quantity for ${i.name}`}
                  type="number"
                  min="1"
                  max="99"
                  value={i.quantity}
                  onChange={(e) => setQuantity(i, Number(e.target.value))}
                  className="w-16 border border-black/20 p-1"
                />
                {formatPrice(i.price * i.quantity)}
                <button
                  aria-label={`Remove ${i.name}`}
                  onClick={() => setQuantity(i, 0)}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
