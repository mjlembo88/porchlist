import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { StandCalc } from "@/components/stand-calc";
import appCss from "../styles.css?url";

const APP_NAME = "StandLocal";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#2F4A38" },
      {
        name: "description",
        content: "Stand strong and Farm on. Local farm stands near you — Tampa Bay, Pasco, Hernando, and Pinellas.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Source+Sans+3:ital,wght@0,400;0,500;0,600;1,400&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans bg-paper text-ink">
        <PreviewHostBridge />
        <AuthProvider>
          <RootChrome />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});

function RootChrome() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hideCalc = path === "/login" || path === "/admin";
  return (
    <>
      <Outlet />
      {!hideCalc && <StandCalc />}
    </>
  );
}
