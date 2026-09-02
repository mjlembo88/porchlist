import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminDesk } from "@/components/admin-desk";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="border-b border-border px-4 py-3">
        <Link to="/" className="text-sm text-muted">← Map</Link>
      </header>
      <AdminDesk />
    </main>
  );
}
