import { Providers } from "./providers";
import ClientLayout from "./components/ClientLayout";
import "./globals.css";

export const metadata = {
  title: "Taurus Cellular - Aplikasi Pembukuan",
  description: "Aplikasi pembukuan untuk toko",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=yes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=yes" />
      </head>
      <body>
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
}