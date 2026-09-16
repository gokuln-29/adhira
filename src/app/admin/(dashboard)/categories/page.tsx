import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import { getAllCategoriesAdmin } from "@/lib/data/admin/categories";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const categories = await getAllCategoriesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <Link href="/admin/categories/new">
          <Button type="button">+ New category</Button>
        </Link>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-hairline) font-mono-label text-[10px] text-(--color-muted)">
              <th className="px-6 py-3 text-start">Image</th>
              <th className="px-6 py-3 text-start">Name</th>
              <th className="px-6 py-3 text-start">Slug</th>
              <th className="px-6 py-3 text-start">Position</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-(--color-hairline) last:border-0">
                <td className="px-6 py-3">
                  <div className="relative h-10 w-16 overflow-hidden rounded-[2px] bg-(--color-hairline)/40">
                    {c.image && (
                      <Image src={c.image} alt="" fill sizes="64px" className="object-cover" />
                    )}
                  </div>
                </td>
                <td className="px-6 py-3">
                  <Link href={`/admin/categories/${c.id}`} className="hover:text-(--color-primary)">
                    {c.name}
                  </Link>
                </td>
                <td className="px-6 py-3 font-mono-label text-xs text-(--color-muted)">
                  {c.slug}
                </td>
                <td className="px-6 py-3">
                  <MonoLabel className="text-[10px]">{c.position}</MonoLabel>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-(--color-muted)">
                  No categories yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
