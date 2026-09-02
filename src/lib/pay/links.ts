export type PayHandles = {
  venmoUsername?: string | null;
  zelleHandle?: string | null;
  zelleDestination?: string | null;
  cashappCashtag?: string | null;
  paypalMeSlug?: string | null;
};

function dollars(cents: number) {
  return (Math.max(0, cents) / 100).toFixed(2);
}

export function venmoLinks(username: string, cents: number, note: string) {
  const amount = dollars(cents);
  const user = username.replace(/^@/, "");
  const q = new URLSearchParams({ recipients: user, amount, note });
  return {
    web: `https://account.venmo.com/pay?${q.toString()}`,
    native: `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(user)}&amount=${amount}&note=${encodeURIComponent(note)}`,
  };
}

export function cashAppLink(cashtag: string, cents: number) {
  const tag = cashtag.replace(/^\$/, "");
  return `https://cash.app/$${tag}/${dollars(cents)}`;
}

export function paypalMeLink(slug: string, cents: number) {
  const clean = slug.replace(/^https?:\/\/(www\.)?paypal\.me\//i, "").replace(/^\//, "");
  return `https://paypal.me/${clean}/${dollars(cents)}`;
}

export function paymentLinks(handles: PayHandles, cents: number, note: string) {
  const venmo = handles.venmoUsername ? venmoLinks(handles.venmoUsername, cents, note) : null;
  const cashapp = handles.cashappCashtag ? cashAppLink(handles.cashappCashtag, cents) : null;
  const paypal = handles.paypalMeSlug ? paypalMeLink(handles.paypalMeSlug, cents) : null;
  return {
    amount: dollars(cents),
    note,
    venmo,
    cashapp,
    paypal,
    zelle: {
      handle: handles.zelleHandle ?? "",
      destination: handles.zelleDestination ?? "",
    },
  };
}

export function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
