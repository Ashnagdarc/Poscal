import { useEffect } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// Measurement IDs are public. Restrict the default to the live site's domains
// so preview builds and local production previews do not pollute reports.
const productionHosts = new Set(["poscalfx.com", "www.poscalfx.com"]);
const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()
  ?? (productionHosts.has(window.location.hostname) ? "G-SRPBN79PVE" : undefined);
let initialized = false;
let previousLocation: string | undefined;

function pagePath(pathname: string): string {
  // Keep private record IDs and journal dates out of analytics.
  if (pathname.startsWith("/journal/trade/")) return "/journal/trade/:tradeId";
  if (pathname.startsWith("/journal/day/")) return "/journal/day/:dateKey";
  const routes = ["/", "/calculator", "/welcome", "/signin", "/signup",
    "/forgot-password", "/verify-email", "/journal", "/history", "/settings",
    "/pricing", "/upgrade", "/calendar", "/news", "/signals", "/profile",
    "/terms", "/privacy", "/admin/users", "/admin/updates", "/admin/ingestor-health"];
  return routes.includes(pathname) ? pathname : "/404";
}

export function GoogleAnalytics() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!import.meta.env.PROD || !measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) return;

    const location = `${window.location.origin}${pagePath(pathname)}`;
    if (!initialized) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        // gtag requires an arguments object, rather than a rest-parameter array.
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", measurementId, {
        send_page_view: false,
        page_location: location,
        page_referrer: "",
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script);
      initialized = true;
    }

    if (location === previousLocation) return;
    window.gtag!("set", { page_location: location, page_referrer: previousLocation ?? "" });
    window.gtag!("event", "page_view", {
      page_location: location,
      page_referrer: previousLocation ?? "",
      page_title: "Poscal",
      send_to: measurementId,
    });
    previousLocation = location;
  }, [pathname]);

  return null;
}
