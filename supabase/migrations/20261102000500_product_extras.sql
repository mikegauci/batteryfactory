-- Battery Factory product extras from the live site:
--  * contact_button: the theme's "Contact us now" (WhatsApp) button, shown
--    instead of add to cart in the shop grid and beside it on the product page;
--  * addons: Advanced Product Fields checkboxes with a fixed price each,
--    [{"id": "jluxu", "label": "Installation", "price_cents": 4000}].
alter table public.products
  add column contact_button boolean not null default false,
  add column addons jsonb not null default '[]'::jsonb;

-- Order lines keep the chosen add-ons (labels and prices at purchase time).
alter table public.order_items
  add column addons jsonb not null default '[]'::jsonb;

-- Where the "Contact us now" button goes, editable in Settings.
insert into public.settings (key, value) values
  ('contact', '{"whatsapp_url": "https://wa.link/i7g4z3"}')
on conflict (key) do nothing;
