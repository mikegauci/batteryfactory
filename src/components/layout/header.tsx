"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { Container } from "@/components/layout/container";
import { CartLink } from "@/components/layout/cart-link";
import { isActive, primaryNav, type NavItem } from "@/lib/navigation";

// Astra header: white 80px bar with a grey rule, logo left, menu and basket
// right. The URL is runtime data, so the prerendered shell shows the header
// without an active link and the highlighted version streams in.
export function Header({
  navigation = primaryNav,
}: {
  navigation?: NavItem[];
}) {
  return (
    <Suspense fallback={<HeaderView navigation={navigation} pathname={null} />}>
      <HeaderWithPath navigation={navigation} />
    </Suspense>
  );
}

function HeaderWithPath({ navigation }: { navigation: NavItem[] }) {
  return <HeaderView navigation={navigation} pathname={usePathname()} />;
}

function HeaderView({
  pathname,
  navigation,
}: {
  pathname: string | null;
  navigation: NavItem[];
}) {
  // Remember which page the menu was opened on so navigating closes it.
  // Without a pathname (the prerendered fallback) the menu is always closed.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = pathname !== null && openOn === pathname;
  const close = () => setOpenOn(null);

  return (
    <header className="relative z-40 border-b border-[#d1d5db] bg-white">
      <Container className="flex h-20 items-center">
        <Link href="/" className="shrink-0" aria-label="Battery Factory home">
          <Image
            src="/brand/logo.svg"
            alt="Battery Factory"
            width={177}
            height={37}
            priority
            className="h-auto w-[176px]"
          />
        </Link>

        <nav
          aria-label="Main"
          className="desk:flex ml-auto hidden items-center"
        >
          <ul className="flex items-center">
            {navigation.map((item) => {
              const active = pathname ? isActive(pathname, item.href) : false;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`hover:text-brand block px-5 text-xl leading-[80px] font-semibold transition-colors ${
                      active ? "text-brand" : "text-black"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="desk:ml-5 ml-auto flex items-center">
          <CartLink />
        </div>

        <button
          type="button"
          className="desk:hidden text-brand ml-8 px-1"
          aria-controls="mobile-menu"
          aria-expanded={open}
          onClick={() => setOpenOn(open ? null : pathname)}
        >
          <span className="sr-only">Main menu toggle</span>
          <MenuIcon open={open} />
        </button>
      </Container>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Main"
          className="desk:hidden absolute inset-x-0 top-full border-b border-[#d1d5db] bg-white"
        >
          <ul>
            {navigation.map((item) => {
              const active = pathname ? isActive(pathname, item.href) : false;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className={`hover:text-brand block border-t border-[#eaeaea] px-5 text-lg leading-[50px] font-semibold ${
                      active ? "text-brand" : "text-black"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden fill="currentColor">
      {open ? (
        <path d="M14.95 6.46 11.41 10l3.54 3.54-1.41 1.41L10 11.42l-3.53 3.53-1.42-1.42L8.58 10 5.05 6.47l1.42-1.42L10 8.58l3.54-3.53z" />
      ) : (
        <path d="M0 4h20v1.5H0zm0 5.25h20v1.5H0zm0 5.25h20V16H0z" />
      )}
    </svg>
  );
}
