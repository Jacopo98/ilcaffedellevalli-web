"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const FEEDBACK_DELAY_MS = 180;
const SAFETY_TIMEOUT_MS = 10_000;

export function AdminNavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  // Il cambio di chiave smonta lo stato precedente e chiude il feedback
  // anche quando cambia soltanto la query string (settimana, focus, ecc.).
  return <NavigationFeedbackState key={routeKey} />;
}

function NavigationFeedbackState() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("Caricamento…");
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (delayTimer.current) clearTimeout(delayTimer.current);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      if (formTimer.current) clearInterval(formTimer.current);
      delayTimer.current = null;
      safetyTimer.current = null;
      formTimer.current = null;
    };

    const hideFeedback = () => {
      clearTimers();
      setVisible(false);
    };

    const scheduleFeedback = (nextMessage: string) => {
      clearTimers();
      setMessage(nextMessage);
      delayTimer.current = setTimeout(() => {
        setVisible(true);
        safetyTimer.current = setTimeout(hideFeedback, SAFETY_TIMEOUT_MS);
      }, FEEDBACK_DELAY_MS);
    };

    const handleNavigationClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || !destination.pathname.startsWith("/admin")) return;

      const currentRoute = `${window.location.pathname}${window.location.search}`;
      const destinationRoute = `${destination.pathname}${destination.search}`;
      if (destinationRoute === currentRoute) return;

      scheduleFeedback("Caricamento…");
    };

    const handleFormSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      const submitter = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
      if (!form || !submitter || form.dataset.noLoading === "true") return;

      const command = submitter.textContent?.trim() ?? "";
      if (!/(salva|crea|importa|invia|aggiorna|conferma|approva|registra|aggiungi)/i.test(command)) return;

      scheduleFeedback("Salvataggio…");
      let pendingObserved = false;
      let checks = 0;
      formTimer.current = setInterval(() => {
        checks += 1;
        pendingObserved ||= submitter.disabled || form.getAttribute("aria-busy") === "true";

        if ((pendingObserved && !submitter.disabled && form.getAttribute("aria-busy") !== "true") || (!pendingObserved && checks >= 8)) {
          hideFeedback();
        }
      }, 100);
    };

    document.addEventListener("click", handleNavigationClick, true);
    document.addEventListener("submit", handleFormSubmit, true);
    return () => {
      document.removeEventListener("click", handleNavigationClick, true);
      document.removeEventListener("submit", handleFormSubmit, true);
      clearTimers();
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="admin-navigation-feedback" role="status" aria-live="polite">
      <span className="admin-navigation-spinner" aria-hidden="true" />
      <strong>{message}</strong>
    </div>
  );
}
