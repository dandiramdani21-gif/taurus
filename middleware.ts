import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/kasir/:path*",
    "/hp/:path*",
    "/voucher/:path*",
    "/pulsa/:path*",
    "/aksesoris/:path*",
    "/transaksi/:path*",
    "/laporan/:path*",
    "/pengaturan/:path*",
  ],
};