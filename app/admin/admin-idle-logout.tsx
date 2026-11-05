"use client";

import Image from "next/image";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { logout } from "@/app/login/actions";

const INACTIVITY_LIMIT_MS = 10 * 60 * 1000;
const LAST_ACTIVITY_KEY = "admin-last-activity";
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"];
const subscribeToClient = () => () => {};

export function AdminIdleLogout() {
  const mounted = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecordedActivity = useRef(0);
  const signingOut = useRef(false);

  useEffect(() => {
    const obscureApp = () => document.documentElement.classList.add("admin-session-obscured");
    const revealApp = () => document.documentElement.classList.remove("admin-session-obscured");

    const signOut = () => {
      if (signingOut.current) return;
      signingOut.current = true;
      obscureApp();
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
    revealApp();

    const verifyAfterRestore = () => {
      const restoredActivity = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));
      if (!Number.isFinite(restoredActivity) || restoredActivity <= 0 || Date.now() - restoredActivity >= INACTIVITY_LIMIT_MS) {
        signOut();
        return;
      }
      scheduleLogout(restoredActivity);
      revealApp();
    };

    const handlePageHide = () => obscureApp();
    const handlePageShow = () => verifyAfterRestore();
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") obscureApp();
      else verifyAfterRestore();
    };

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
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (timeout.current) clearTimeout(timeout.current);
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  if (!mounted) return null;
  return createPortal(<div className="admin-session-shield" aria-hidden="true"><Image src="/Logo_black_trasparent.png" alt="" width={2843} height={820} priority style={{ width: "min(11rem, 52vw)", height: "auto" }} /><span /></div>, document.body);
}
