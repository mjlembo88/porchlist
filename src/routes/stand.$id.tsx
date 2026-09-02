import { createFileRoute, Link } from "@tanstack/react-router";
import { StandDetail } from "@/components/stand-detail";
import { getStandBundle } from "@/lib/stands/server";
import { APP_NAME, SLOGAN } from "@/lib/stands/types";

export const Route = createFileRoute("/stand/$id")({
  loader: ({ params }) => getStandBundle({ data: { id: params.id } }),
  component: StandPage,
});

function StandPage() {
  const { stand, items, specials, reviews } = Route.useLoaderData();
  if (!stand) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper p-6 text-ink">
        <div className="text-center">
          <p className="font-display text-2xl font-semibold">Stand not listed</p>
          <Link to="/" className="mt-4 inline-block text-forest underline">Back to the map</Link>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="border-b border-border px-4 py-3">
        <Link to="/" className="text-sm text-muted">← Map</Link>
        <p className="font-display text-lg font-semibold">{APP_NAME}</p>
        <p className="text-xs italic text-forest">{SLOGAN}</p>
      </header>
      <div className="mx-auto max-w-lg p-4 pb-20">
        <StandDetail stand={stand} initialItems={items} initialSpecials={specials} initialReviews={reviews} />
      </div>
    </main>
  );
}
