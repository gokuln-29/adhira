import type { Metadata } from "next";
import { ProductsTable } from "@/components/admin/products/products-table";
import { getAllProductsAdmin } from "@/lib/data/admin/products";
import { getCategories } from "@/lib/data/products";

export const metadata: Metadata = { title: "Products" };

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([
    getAllProductsAdmin(),
    getCategories(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Products</h1>
      <ProductsTable products={products} categories={categories} />
    </div>
  );
}
