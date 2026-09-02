import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { SLOGAN } from "@/lib/stands/types";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : "/",
  }),
  component: Login,
});

function Login() {
  const { next } = Route.useSearch();
  return (
    <main className="grid min-h-dvh place-items-center bg-paper p-6 text-ink">
      <div className="w-full max-w-sm space-y-4">
        <Link to="/" className="text-sm text-muted">← Map</Link>
        <h1 className="font-display text-3xl font-semibold">Owner sign in</h1>
        <p className="text-sm text-muted">
          Shoppers stay free. Sign in only to run a listing StandLocal has granted you.
        </p>
        <p className="text-xs italic text-forest">{SLOGAN}</p>
        {authEnabled ? (
          GROK_PROVIDERS.map((p) => (
            <Button
              key={p.providerId}
              type="button"
              className="h-14 w-full"
              variant="outline"
              onClick={() => signIn(p.providerId, { callbackURL: next || "/" })}
            >
              Continue with {p.label}
            </Button>
          ))
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
        <Link to="/admin" className="block h-14 rounded-2xl border border-border text-center leading-[3.5rem]">
          App admin
        </Link>
      </div>
    </main>
  );
}
