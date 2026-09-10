import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/products/product-form";
import { getCategories } from "@/lib/data/products";

export const metadata: Metadata = { title: "New Product" };

export default async function NewProductPage() {
  const categories = await getCategories();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New product</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
