"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import { useEffect, useState } from "react";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Halaman tanpa sidebar
  const noSidebarPaths = ["/login", "/invoice"];
  const hideSidebar = noSidebarPaths.some(path => pathname?.startsWith(path));

  // Loading state
  if (!mounted || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-purple-600">Loading...</div>
      </div>
    );
  }

  // Jika tidak login, render tanpa sidebar
  if (!session) {
    return <main className="min-h-screen">{children}</main>;
  }

  // Jika di halaman yang tidak perlu sidebar (login, invoice)
  if (hideSidebar) {
    return <main className="min-h-screen">{children}</main>;
  }

  // Default dengan sidebar
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 bg-gray-50 w-full overflow-x-hidden">
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}