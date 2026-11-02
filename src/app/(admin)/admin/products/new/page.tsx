import { ProductEditor, blankProduct } from "@/components/admin/product-editor";
import { AdminPageHeader } from "@/components/admin/page-header";
export default function Page() {
  return (
    <>
      <AdminPageHeader title="New product" />
      <ProductEditor initial={blankProduct} />
    </>
  );
}
