import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/admin/categories/category-form";
import { getCategoryByIdAdmin } from "@/lib/data/admin/categories";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const category = await getCategoryByIdAdmin(id);
  return { title: category?.name ?? "Edit Category" };
}

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await getCategoryByIdAdmin(id);
  if (!category) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{category.name}</h1>
      <CategoryForm category={category} nextPosition={category.position} />
    </div>
  );
}
