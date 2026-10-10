"use client";

import { useEffect, useRef } from "react";

/* Subscribe to live server events pushed over the socket.
   GlobalAuthGuard fans every socket event out as a window CustomEvent:
     "zapto:live"  detail = { event: "activity:update", detail: {...} }
   Pages call:  useLive("activity:update", (payload, event) => {...})
   Pass a falsy event name to receive EVERY live event. */
export default function useLive(event, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const h = (e) => {
      const d = e.detail || {};
      if (event && d.event !== event) return;
      try {
        ref.current(d.detail || {}, d.event);
      } catch (err) {}
    };
    window.addEventListener("zapto:live", h);
    return () => window.removeEventListener("zapto:live", h);
  }, [event]);
}
