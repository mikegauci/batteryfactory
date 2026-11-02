import type { Metadata } from "next";
import localFont from "next/font/local";
import { env } from "@/lib/env";
import "./globals.css";
import { CartProvider } from "@/components/shop/cart";

// Sofia Pro, self-hosted by the live theme (same files and weights).
const sofia = localFont({
  src: [
    { path: "./fonts/Sofia-Pro-ExtraLight.otf", weight: "200" },
    { path: "./fonts/Sofia-Pro-Light.otf", weight: "400" },
    { path: "./fonts/Sofia-Pro-Medium.otf", weight: "500" },
    { path: "./fonts/Sofia-Pro-Black.otf", weight: "900" },
  ],
  variable: "--font-sofia",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: "Battery Factory | Powering your future one battery at a time",
    template: "%s | Battery Factory",
  },
  description: "Powering your future one battery at a time",
  openGraph: {
    siteName: "Battery Factory",
    locale: "en_US",
    type: "website",
    images: ["/brand/og-default.jpg"],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sofia.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
