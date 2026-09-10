import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { MonoLabel } from "@/components/ui/mono-label";
import { getAllCustomersAdmin } from "@/lib/data/admin/customers";

export const metadata: Metadata = { title: "Customers" };

export default async function AdminCustomersPage() {
  const customers = await getAllCustomersAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Customers</h1>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-hairline) font-mono-label text-[10px] text-(--color-muted)">
              <th className="px-6 py-3 text-start">Name</th>
              <th className="px-6 py-3 text-start">Email</th>
              <th className="px-6 py-3 text-start">Phone</th>
              <th className="px-6 py-3 text-start">Company</th>
              <th className="px-6 py-3 text-start">Type</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-(--color-hairline) last:border-0">
                <td className="px-6 py-3">{c.name}</td>
                <td className="px-6 py-3 text-(--color-muted)">{c.email}</td>
                <td className="px-6 py-3 text-(--color-muted)">{c.phone ?? "—"}</td>
                <td className="px-6 py-3 text-(--color-muted)">{c.company ?? "—"}</td>
                <td className="px-6 py-3">
                  <MonoLabel className="text-[10px]">{c.type.toUpperCase()}</MonoLabel>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-(--color-muted)">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
