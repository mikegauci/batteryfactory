"use client";

import { useEffect, useState } from "react";

// Astra's "Scroll to Top" button: a small green square in the bottom right,
// shown once the page has scrolled past the first screen.
export function ScrollTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 300);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`bg-brand fixed right-[30px] bottom-[30px] z-50 grid size-[31.5px] place-items-center rounded-[2px] text-white transition-opacity ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-label="Scroll to Top"
      tabIndex={visible ? 0 : -1}
    >
      <svg
        viewBox="57 35.171 26 16.043"
        className="h-[9px] w-[15px] rotate-180 fill-current"
        aria-hidden
      >
        <path d="M57.5,38.193l12.5,12.5l12.5-12.5l-2.5-2.5l-10,10l-10-10L57.5,38.193z" />
      </svg>
    </button>
  );
}
