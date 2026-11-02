import { AdminThumbnail } from "@/components/admin/thumbnail";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatPrice } from "@/lib/format";
export const metadata = { title: "Products" };
export default async function Page() {
  const db = await createClient();
  const { data, error } = await db
    .from("products")
    .select(
      "id,name,status,price_cents,stock_status,thumbnail:media!products_featured_media_id_fkey(path,alt)",
    )
    .order("name");
  if (error) throw error;
  return (
    <>
      <AdminPageHeader
        title="Products"
        actions={
          <Link href="/admin/products/new/" className="shop-button">
            New product
          </Link>
        }
      />
      <Link
        href="/admin/tools/?view=bulk&table=products"
        className="mb-4 inline-block text-sm underline"
      >
        Bulk edit products →
      </Link>
      <div className="overflow-auto rounded-lg bg-white p-5">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="w-20 px-4 py-3">
                <span className="sr-only">Thumbnail</span>
              </th>
              {["Product", "Status", "Price", "Stock"].map((v) => (
                <th key={v} className="p-3">
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-t border-black/10">
                <td className="px-4 py-3">
                  <AdminThumbnail image={p.thumbnail} />
                </td>
                <td className="p-3">
                  <Link
                    className="font-semibold underline"
                    href={`/admin/products/${p.id}/`}
                  >
                    {p.name}
                  </Link>
                </td>
                <td>{p.status}</td>
                <td>
                  {p.price_cents === null
                    ? "Variants"
                    : formatPrice(p.price_cents)}
                </td>
                <td>{p.stock_status.replaceAll("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
