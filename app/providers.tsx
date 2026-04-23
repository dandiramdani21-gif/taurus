"use client";

import { SessionProvider } from "next-auth/react";
import ToastCenter from "@/components/ToastCenter";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <ToastCenter />
    </SessionProvider>
  );
}
