"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

function MenuIcon({ path }: { path: string }) {
  if (path === "/kasir") {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    );
  }

  if (path === "/inventory") {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    );
  }

  if (path === "/invoice") {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }

  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SectionButton({
  active,
  children,
  onClick,
  open,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  open: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between rounded-2xl px-3 py-2.5 transition ${
        active ? "bg-white text-slate-950 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      <div className="flex items-center gap-3">{children}</div>
      <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openHandphone, setOpenHandphone] = useState(true);
  const [openProducts, setOpenProducts] = useState(true);
  const [openPulsa, setOpenPulsa] = useState(true);

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + "/");

  return (
    <>
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 inline-flex items-center justify-center rounded-2xl border border-white/40 bg-slate-950/90 p-3 text-white shadow-[0_20px_40px_rgba(15,23,42,0.25)] backdrop-blur-xl"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-40 flex h-full min-h-screen w-80 flex-col overflow-hidden border-r border-white/30 bg-slate-950/95 text-white shadow-[0_30px_80px_rgba(15,23,42,0.28)] backdrop-blur-2xl
          transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:w-80 lg:min-h-full lg:self-stretch
        `}
      >
        <div className="border-b border-white/10 bg-white/5 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-emerald-400 text-white shadow-lg shadow-violet-500/25">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold leading-none">Taurus Cell</p>
              <p className="mt-1 text-xs uppercase tracking-[0.28em] text-white/50">Kasir Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
            <SectionButton active={isActive("/kasir/hp") || isActive("/hp") || isActive("/laporan/hp")} onClick={() => setOpenHandphone((v) => !v)} open={openHandphone}>
              <MenuIcon path="/kasir" />
              <span className="text-sm font-medium">Handphone</span>
            </SectionButton>
            {openHandphone && (
              <div className="ml-4 mt-2 space-y-1">
                <Link href="/kasir/hp" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-2xl px-3 py-2 transition ${isActive("/kasir/hp") ? "bg-white text-slate-950 shadow-lg shadow-black/10" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>
                  <span className="text-sm">Kasir</span>
                </Link>
                <Link href="/hp" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-2xl px-3 py-2 transition ${isActive("/hp") ? "bg-white text-slate-950 shadow-lg shadow-black/10" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>
                  <span className="text-sm">Inventory</span>
                </Link>
                <Link href="/laporan/hp" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-2xl px-3 py-2 transition ${isActive("/laporan/hp") ? "bg-white text-slate-950 shadow-lg shadow-black/10" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>
                  <span className="text-sm">Laporan</span>
                </Link>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
            <SectionButton
              active={isActive("/kasir/aksesoris") || isActive("/aksesoris") || isActive("/kasir/voucher") || isActive("/voucher") || isActive("/laporan/produk-lain")}
              onClick={() => setOpenProducts((v) => !v)}
              open={openProducts}
            >
              <MenuIcon path="/inventory" />
              <span className="text-sm font-medium">Produk Lain</span>
            </SectionButton>
            {openProducts && (
              <div className="ml-4 mt-2 space-y-1">
                <div className="space-y-1">
                  <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/40">Aksesoris</p>
                  <Link href="/kasir/aksesoris" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-2xl px-3 py-2 transition ${isActive("/kasir/aksesoris") ? "bg-white text-slate-950 shadow-lg shadow-black/10" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>
                    <span className="text-sm">Kasir</span>
                  </Link>
                  <Link href="/aksesoris" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-2xl px-3 py-2 transition ${isActive("/aksesoris") ? "bg-white text-slate-950 shadow-lg shadow-black/10" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>
                    <span className="text-sm">Inventory</span>
                  </Link>
                </div>

                <div className="space-y-1">
                  <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/40">Voucher</p>
                  <Link href="/kasir/voucher" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-2xl px-3 py-2 transition ${isActive("/kasir/voucher") ? "bg-white text-slate-950 shadow-lg shadow-black/10" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>
                    <span className="text-sm">Kasir</span>
                  </Link>
                  <Link href="/voucher" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-2xl px-3 py-2 transition ${isActive("/voucher") ? "bg-white text-slate-950 shadow-lg shadow-black/10" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>
                    <span className="text-sm">Inventory</span>
                  </Link>
                </div>

                <Link href="/laporan/produk-lain" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-2xl px-3 py-2 transition ${isActive("/laporan/produk-lain") ? "bg-white text-slate-950 shadow-lg shadow-black/10" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>
                  <span className="text-sm">Laporan</span>
                </Link>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
            <SectionButton active={isActive("/kasir/pulsa") || isActive("/laporan/pulsa")} onClick={() => setOpenPulsa((v) => !v)} open={openPulsa}>
              <MenuIcon path="/kasir" />
              <span className="text-sm font-medium">Pulsa</span>
            </SectionButton>
            {openPulsa && (
              <div className="ml-4 mt-2 space-y-1">
                <Link href="/kasir/pulsa" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-2xl px-3 py-2 transition ${isActive("/kasir/pulsa") ? "bg-white text-slate-950 shadow-lg shadow-black/10" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>
                  <span className="text-sm">Kasir</span>
                </Link>
                <Link href="/laporan/pulsa" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-2xl px-3 py-2 transition ${isActive("/laporan/pulsa") ? "bg-white text-slate-950 shadow-lg shadow-black/10" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>
                  <span className="text-sm">Laporan</span>
                </Link>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
            <Link
              href="/bukti"
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${isActive("/bukti") ? "bg-white text-slate-950 shadow-lg shadow-black/10" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
            >
              <MenuIcon path="/invoice" />
              <span className="text-sm font-medium">Invoices</span>
            </Link>

            <Link
              href="/arsip"
              className={`mt-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${isActive("/arsip") ? "bg-white text-slate-950 shadow-lg shadow-black/10" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
            >
              <MenuIcon path="/archive" />
              <span className="text-sm font-medium">Arsip</span>
            </Link>
            <Link
              href="/pengaturan"
              className={`mt-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${isActive("/pengaturan") ? "bg-white text-slate-950 shadow-lg shadow-black/10" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
            >
              <MenuIcon path="/settings" />
              <span className="text-sm font-medium">Pengaturan</span>
            </Link>
          </div>
        </nav>

        <div className="border-t border-white/10 bg-white/5 p-4">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-white/75 transition hover:bg-rose-500/15 hover:text-rose-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
