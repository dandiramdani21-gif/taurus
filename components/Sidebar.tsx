"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

function MenuIcon({ path }: { path: string }) {
  const className = "w-5 h-5";

  if (path === "/kasir") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
        />
      </svg>
    );
  }

  if (path === "/inventory") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    );
  }

  if (path === "/invoice") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    );
  }

  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
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
      className={`
        w-full flex items-center justify-between rounded-2xl px-4 py-3
        transition-all duration-200
        ${
          active
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }
      `}
    >
      <div className="flex items-center gap-3">{children}</div>

      <svg
        className={`w-4 h-4 transition-transform duration-200 ${
          open ? "rotate-180" : ""
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
}

function MenuItem({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        flex items-center rounded-xl px-4 py-2.5 text-sm font-medium
        transition-all duration-200
        ${
          active
            ? "bg-slate-100 text-slate-950"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
        }
      `}
    >
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [openHandphone, setOpenHandphone] = useState(true);
  const [openProducts, setOpenProducts] = useState(true);
  const [openPulsa, setOpenPulsa] = useState(true);

  const isActive = (path: string) =>
    pathname === path || pathname?.startsWith(path + "/");

  return (
    <>
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="
          lg:hidden fixed top-4 left-4 z-50
          flex items-center justify-center
          h-12 w-12 rounded-2xl
          border border-slate-200
          bg-white text-slate-900
          shadow-lg
        "
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50
          flex h-screen w-[300px] flex-col
          border-r border-slate-200
          bg-white
          transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static
        `}
      >
        <div className="border-b border-slate-100 px-6 py-6">
          <div className="flex items-center gap-4">
            <div
              className="
                flex h-12 w-12 items-center justify-center
                rounded-2xl
                bg-slate-900
                text-white
              "
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>

            <div>
              <h1 className="text-base font-semibold text-slate-900">
                Taurus Cell
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                Kasir Management
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
          <div className="rounded-3xl border border-slate-100 p-2">
            <SectionButton
              active={
                isActive("/kasir/hp") ||
                isActive("/hp") ||
                isActive("/laporan/hp")
              }
              onClick={() => setOpenHandphone((v) => !v)}
              open={openHandphone}
            >
              <MenuIcon path="/kasir" />
              <span className="text-sm font-semibold">Handphone</span>
            </SectionButton>

            {openHandphone && (
              <div className="mt-2 ml-2 space-y-1 border-l border-slate-100 pl-3">
                <MenuItem
                  href="/kasir/hp"
                  label="Kasir"
                  active={isActive("/kasir/hp")}
                  onClick={() => setMobileMenuOpen(false)}
                />

                <MenuItem
                  href="/hp"
                  label="Inventory"
                  active={isActive("/hp")}
                  onClick={() => setMobileMenuOpen(false)}
                />

                <MenuItem
                  href="/laporan/hp"
                  label="Laporan"
                  active={isActive("/laporan/hp")}
                  onClick={() => setMobileMenuOpen(false)}
                />
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-100 p-2">
            <SectionButton
              active={
                isActive("/kasir/aksesoris") ||
                isActive("/aksesoris") ||
                isActive("/kasir/voucher") ||
                isActive("/voucher") ||
                isActive("/laporan/produk-lain")
              }
              onClick={() => setOpenProducts((v) => !v)}
              open={openProducts}
            >
              <MenuIcon path="/inventory" />
              <span className="text-sm font-semibold">Produk Lain</span>
            </SectionButton>

            {openProducts && (
              <div className="mt-2 ml-2 space-y-3 border-l border-slate-100 pl-3">
                <div className="space-y-1">
                  <p className="px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Aksesoris
                  </p>

                  <MenuItem
                    href="/kasir/aksesoris"
                    label="Kasir"
                    active={isActive("/kasir/aksesoris")}
                    onClick={() => setMobileMenuOpen(false)}
                  />

                  <MenuItem
                    href="/aksesoris"
                    label="Inventory"
                    active={isActive("/aksesoris")}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                </div>

                <div className="space-y-1">
                  <p className="px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Voucher
                  </p>

                  <MenuItem
                    href="/kasir/voucher"
                    label="Kasir"
                    active={isActive("/kasir/voucher")}
                    onClick={() => setMobileMenuOpen(false)}
                  />

                  <MenuItem
                    href="/voucher"
                    label="Inventory"
                    active={isActive("/voucher")}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                </div>

                <MenuItem
                  href="/laporan/produk-lain"
                  label="Laporan"
                  active={isActive("/laporan/produk-lain")}
                  onClick={() => setMobileMenuOpen(false)}
                />
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-100 p-2">
            <SectionButton
              active={
                isActive("/kasir/pulsa") ||
                isActive("/laporan/pulsa")
              }
              onClick={() => setOpenPulsa((v) => !v)}
              open={openPulsa}
            >
              <MenuIcon path="/kasir" />
              <span className="text-sm font-semibold">Pulsa</span>
            </SectionButton>

            {openPulsa && (
              <div className="mt-2 ml-2 space-y-1 border-l border-slate-100 pl-3">
                <MenuItem
                  href="/kasir/pulsa"
                  label="Kasir"
                  active={isActive("/kasir/pulsa")}
                  onClick={() => setMobileMenuOpen(false)}
                />

                <MenuItem
                  href="/laporan/pulsa"
                  label="Laporan"
                  active={isActive("/laporan/pulsa")}
                  onClick={() => setMobileMenuOpen(false)}
                />
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-100 p-2 space-y-1">
            <Link
              href="/bukti"
              className={`
                flex items-center gap-3 rounded-2xl px-4 py-3
                text-sm font-medium transition-all
                ${
                  isActive("/bukti")
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }
              `}
            >
              <MenuIcon path="/invoice" />
              <span>Invoices</span>
            </Link>

            <Link
              href="/arsip"
              className={`
                flex items-center gap-3 rounded-2xl px-4 py-3
                text-sm font-medium transition-all
                ${
                  isActive("/arsip")
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }
              `}
            >
              <MenuIcon path="/archive" />
              <span>Arsip</span>
            </Link>

            <Link
              href="/pengaturan"
              className={`
                flex items-center gap-3 rounded-2xl px-4 py-3
                text-sm font-medium transition-all
                ${
                  isActive("/pengaturan")
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }
              `}
            >
              <MenuIcon path="/settings" />
              <span>Pengaturan</span>
            </Link>
          </div>
        </nav>

        <div className="border-t border-slate-100 p-4">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="
              flex w-full items-center gap-3
              rounded-2xl px-4 py-3
              text-sm font-medium text-rose-500
              transition-all
              hover:bg-rose-50
            "
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>

            Logout
          </button>
        </div>
      </aside>
    </>
  );
}