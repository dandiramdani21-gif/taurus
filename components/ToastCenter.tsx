"use client";

import { useEffect, useRef, useState } from "react";

type ToastItem = {
  id: number;
  message: string;
};

export default function ToastCenter() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(1);
  const nativeAlertRef = useRef<typeof window.alert | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    nativeAlertRef.current = window.alert.bind(window);

    window.alert = (message?: string) => {
      const text = String(message ?? "");
      const id = nextIdRef.current++;

      // Defer state update to avoid updating a different component during render.
      // Calling setTimeout moves this to the macrotask queue so React won't warn
      // about setState being called while another component is rendering.
      window.setTimeout(() => {
        setToasts((current) => [...current, { id, message: text }]);

        window.setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== id));
        }, 3200);
      }, 0);
    };

    return () => {
      if (nativeAlertRef.current) {
        window.alert = nativeAlertRef.current;
      }
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-3 px-4 sm:px-0 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-2xl border border-white/20 bg-slate-950/90 px-4 py-3 text-sm text-white shadow-2xl shadow-slate-950/30 backdrop-blur-xl ring-1 ring-white/10 animate-[toastIn_.24s_ease-out]"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="leading-6 text-white/95">{toast.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
