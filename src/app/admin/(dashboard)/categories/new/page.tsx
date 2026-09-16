import type { Metadata } from "next";
import { CategoryForm } from "@/components/admin/categories/category-form";
import { getAllCategoriesAdmin } from "@/lib/data/admin/categories";

export const metadata: Metadata = { title: "New Category" };

export default async function NewCategoryPage() {
  const categories = await getAllCategoriesAdmin();
  const nextPosition =
    categories.length > 0 ? Math.max(...categories.map((c) => c.position)) + 1 : 1;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New category</h1>
      <CategoryForm nextPosition={nextPosition} />
    </div>
  );
}
