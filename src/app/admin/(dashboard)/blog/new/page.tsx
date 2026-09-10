import type { Metadata } from "next";
import { PostForm } from "@/components/admin/blog/post-form";

export const metadata: Metadata = { title: "New Post" };

export default function NewPostPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New post</h1>
      <PostForm />
    </div>
  );
}
