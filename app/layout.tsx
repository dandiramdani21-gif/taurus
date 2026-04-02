import { Providers } from "./providers";
import Sidebar from "@/components/Sidebar";
import "./globals.css";
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <html lang="id">
      <body>
        <Providers>
          <div className="flex">
            <Sidebar />
            <main className="flex-1 p-6 bg-gray-50 min-h-screen">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}