"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  // Halaman tanpa sidebar
  const noSidebarPaths = ["/login", "/invoice"];
  const hideSidebar = noSidebarPaths.some(path => pathname?.startsWith(path));

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
        <div className="rounded-2xl border border-white/70 bg-white/85 px-5 py-3 text-slate-600 shadow-lg backdrop-blur-xl">
          Loading...
        </div>
      </div>
    );
  }

  // Jika tidak login, render tanpa sidebar
  if (!session) {
    return <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">{children}</main>;
  }

  // Jika di halaman yang tidak perlu sidebar (login, invoice)
  if (hideSidebar) {
    return <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">{children}</main>;
  }

  // Default dengan sidebar
  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-900">
      <Sidebar />
      <main className="flex-1 w-full overflow-x-hidden">
        <div className="mx-auto max-w-[1700px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
