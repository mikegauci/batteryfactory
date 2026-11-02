# Battery Factory — batteryfactory.mt rebuild

Rebuild of batteryfactory.mt (Malta lithium battery shop) from WordPress/WooCommerce to **Next.js + Supabase on Vercel**, with a custom in-house CMS modelled on the Rotta rebuild (`~/GitHub/rotta`). WordPress is retired after launch.

## Ground rules

- **Exact 1:1 design and content** with the live site. When in doubt, compare against https://batteryfactory.mt.
- **Never point batteryfactory.mt DNS (Cloudflare) at Vercel without explicit go-ahead from Mike.**
- Never commit secrets or anything in `migration/exports/`.
- English only. One admin to start: mikegauci@gmail.com.
- Shop: Malta + Gozo shipping, prices include 18% VAT, free delivery on orders of €200+. Customers migrated and reset their password by magic link.
- Stripe keys are entered in the admin (Settings → Stripe), not env vars: admin pastes secret + publishable key (restricted keys allowed); on save the server validates the key, creates the webhook endpoint via the Stripe API and stores its signing secret. Keys stay server-only and are shown masked.
- Custom in-house SEO replaces Yoast (carry over Yoast titles, descriptions and OG images).
- Reuse Rotta's patterns (auth, admin, media, shop, SEO, email) rather than reinventing them.

## Stack

| Layer               | Choice                                                |
| ------------------- | ----------------------------------------------------- |
| App                 | Next.js (App Router), TypeScript, Tailwind            |
| Hosting             | Vercel — team "mikegauci's projects"                  |
| DB / Auth / Storage | Supabase project `batteryfactory` (ref `dvrjnuvpvkvoyndnrwqr`, eu-north-1), org "Org 8" — a separate Supabase account from Rotta |
| Payments            | Stripe — same account as the current WooCommerce store |
| Email               | Mailjet, sender and admin notifications `info@batteryfactory.mt` |
| Repo                | github.com/mikegauci/batteryfactory                   |

## Current site (source of truth for migration)

WordPress + Astra (child theme `battery-factory`) + Spectra (ultimate-addons-for-gutenberg) blocks, Yoast SEO, DNS on Cloudflare (proxied).

| Section  | WP implementation                                             | Volume                                    |
| -------- | ------------------------------------------------------------- | ----------------------------------------- |
| Pages    | Home, Custom Battery Manufacturing, Shop, Cart, Checkout, My Account | 6                                  |
| Shop     | WooCommerce + Stripe gateway, Advanced Product Fields (custom options) | 12 products (simple + variable), 6 categories |
| Forms    | Contact Form 7                                                |                                           |
| Popups   | Spectra popups                                                |                                           |
| Blog     | Only the default "Hello world" post — drop it                 | 1                                         |

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
```
