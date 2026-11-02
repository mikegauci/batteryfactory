-- Nested product categories (Batteries > Cylindrical Cells), shown in the
-- product breadcrumb as on WooCommerce.
alter table public.product_categories
  add column parent_id uuid references public.product_categories (id) on delete set null;
create index product_categories_parent_idx on public.product_categories (parent_id);
