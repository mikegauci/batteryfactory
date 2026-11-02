"use client";
import { useEffect } from "react";
import { useCart } from "./cart";
export function ClearPaidCart() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
