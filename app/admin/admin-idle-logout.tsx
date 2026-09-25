"use client";

import { useEffect, useRef } from "react";
import { logout } from "@/app/login/actions";

const INACTIVITY_LIMIT_MS = 10 * 60 * 1000;
const LAST_ACTIVITY_KEY = "admin-last-activity";
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"];

export function AdminIdleLogout() {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecordedActivity = useRef(0);
  const signingOut = useRef(false);

  useEffect(() => {
    const signOut = () => {
      if (signingOut.current) return;
      signingOut.current = true;
      window.localStorage.removeItem(LAST_ACTIVITY_KEY);
      void logout();
    };

    const scheduleLogout = (lastActivity: number) => {
      if (timeout.current) clearTimeout(timeout.current);
      const remaining = INACTIVITY_LIMIT_MS - (Date.now() - lastActivity);
      if (remaining <= 0) {
        signOut();
        return;
      }
      timeout.current = setTimeout(signOut, remaining);
    };

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastRecordedActivity.current < 1000) return;
      lastRecordedActivity.current = now;
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      scheduleLogout(now);
    };

    const storedActivity = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));
    const initialActivity = Number.isFinite(storedActivity) && storedActivity > 0 ? storedActivity : Date.now();
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(initialActivity));
    lastRecordedActivity.current = initialActivity;
    scheduleLogout(initialActivity);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LAST_ACTIVITY_KEY) return;
      if (event.newValue === null) {
        signOut();
        return;
      }
      const activity = Number(event.newValue);
      if (Number.isFinite(activity) && activity > 0) scheduleLogout(activity);
    };

    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    window.addEventListener("storage", handleStorage);

    return () => {
      if (timeout.current) clearTimeout(timeout.current);
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return null;
}
