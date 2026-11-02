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
pnpm dev           # local dev server (the Claude preview runs it on port 3001)
pnpm build         # production build (stop `pnpm dev` first: both write to .next)
pnpm lint          # eslint
pnpm typecheck     # next typegen + tsc
pnpm format        # prettier (with Tailwind class sorting)
pnpm migrate       # WordPress import dry run; --apply writes to Supabase
```

## Conventions (inherited from Rotta)

- Next.js 16: middleware is `src/proxy.ts`; `cacheComponents` is on. Read `node_modules/next/dist/docs/` before using unfamiliar APIs.
- `trailingSlash: true` keeps WordPress URLs (`/product/<slug>/`, `/shop-batteries-and-accessories/`, `/product-category/<slug>/`). Internal links always end with a slash.
- One header style for every page (`SiteShell`); `(hero)` and `(plain)` route groups are only folders.
- Design tokens live in `src/app/globals.css` (`brand` #009245, `ink` #424142, `panel` #f2f2f2). Font is Sofia Pro, self-hosted from the live theme. Section titles use `.section-title`, buttons `.bf-button`. Desktop breakpoint is 922px: use the `desk:` variant.
- Homepage text and images are CMS fields in `src/lib/page-fields.ts` (defaults = live content). In text fields `*word*` is a green highlight and `**word**` bold (`RichLine`).
- Supabase clients: `@/lib/supabase/server`, `@/lib/supabase/client`; `createAdminClient()` bypasses RLS (server only, validate input). Public data is read through `publicDb` inside `"use cache"` functions tagged by type; admin saves call `revalidateTag`.
- Roles: `profiles.role` is `admin` or `customer`; `admin_capabilities` null = full admin, else a section allowlist (`pages`, `products`, `orders`, `media`).
- DB changes are SQL files in `supabase/migrations/`, applied with the Supabase connector. Every migrated table has a `wp_id`. Money is integer euro cents including 18% VAT.
- Media: public `media` bucket, rows in `public.media`, `mediaUrl(path)`. Imported files are `wp/<yyyy>/<mm>/<name>.webp`. Contact-form files go to the private `contact-uploads` bucket via signed upload URLs.
- Email: `sendEmail()` (`@/lib/email/send`) sends through Mailjet; without keys it logs instead.
- Shop follows WooCommerce: `/shop-batteries-and-accessories/` (search `?s=`, sort `?orderby=`), `/product-category/<slug>/` (includes subcategories), `/product/<slug>/`, `/cart/`, `/checkout/`, `/my-account/` (login, `lost-password/`, `reset-password/`). No cart drawer: adding shows WooCommerce's notice. A zero price means "not for sale" (WooCommerce's empty price).
- Checkout: billing/delivery entered on our page and stored on `shop_checkouts.customer_details`; Stripe hosted Checkout takes only the card. Free delivery from `settings.shop.free_shipping_min_cents`, otherwise `shipping[0].price_cents`.
- Products have `contact_button` (WhatsApp "Contact us now", URL in `settings.contact`) and `addons` (Advanced Product Fields checkboxes with a fixed price).
