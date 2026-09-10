import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SignInForm } from "@/components/account/sign-in-form";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/sign-in">): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Sign in",
    robots: { index: false, follow: false },
    alternates: buildAlternates(locale, "/account/sign-in"),
  };
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <SignInForm />
      </main>
      <Footer />
    </div>
  );
}
