import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import { getAllPostsAdmin } from "@/lib/data/admin/blog";

export const metadata: Metadata = { title: "Blog" };

export default async function AdminBlogPage() {
  const posts = await getAllPostsAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Blog</h1>
        <Link href="/admin/blog/new">
          <Button type="button">+ New post</Button>
        </Link>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-hairline) font-mono-label text-[10px] text-(--color-muted)">
              <th className="px-6 py-3 text-start">Title</th>
              <th className="px-6 py-3 text-start">Category</th>
              <th className="px-6 py-3 text-start">Status</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-(--color-hairline) last:border-0">
                <td className="px-6 py-3">
                  <Link href={`/admin/blog/${post.id}`} className="hover:text-(--color-primary)">
                    {post.title}
                  </Link>
                </td>
                <td className="px-6 py-3 text-(--color-muted)">{post.category ?? "—"}</td>
                <td className="px-6 py-3">
                  <MonoLabel muted={false} className="text-[10px]">
                    {post.status.toUpperCase()}
                  </MonoLabel>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-10 text-center text-(--color-muted)">
                  No posts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
