"use client";

import Link from "next/link";

const cards = [
  {
    title: "Handphone",
    description: "Kasir, inventory, dan laporan untuk handphone.",
    links: [
      { label: "Kasir HP", href: "/kasir/hp" },
      { label: "Inventory HP", href: "/hp" },
      { label: "Laporan", href: "/laporan?category=HANDPHONE" },
    ],
  },
  {
    title: "Produk Lain",
    description: "Kasir, inventory, dan laporan untuk aksesoris dan voucher.",
    links: [
      { label: "Aksesoris - Kasir", href: "/kasir/aksesoris" },
      { label: "Aksesoris - Inventory", href: "/aksesoris" },
      { label: "Voucher - Kasir", href: "/kasir/voucher" },
      { label: "Voucher - Inventory", href: "/voucher" },
      { label: "Laporan", href: "/laporan?category=PRODUK_LAIN" },
    ],
  },
  {
    title: "Pulsa",
    description: "Transaksi pulsa langsung tanpa master data inventory.",
    links: [
      { label: "Kasir Pulsa", href: "/kasir/pulsa" },
      { label: "Laporan", href: "/laporan?category=PULSA" },
    ],
  },
];

export default function KasirHubPage() {
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.35fr_0.85fr] lg:px-10 lg:py-10">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
              Dashboard Kasir
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold sm:text-4xl lg:text-5xl">
                Kasir Taurus Cell
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                Pilih kategori kerja yang ingin dibuka. Alur dibagi per produk supaya kasir lebih cepat,
                rapi, dan terasa seperti aplikasi toko yang serius.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-emerald-200">
                Handphone
              </span>
              <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-violet-200">
                Produk Lain
              </span>
              <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sky-200">
                Pulsa
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { label: "Handphone", href: "/kasir/hp", tone: "from-cyan-500 to-sky-600", desc: "Kasir & inventory HP" },
              { label: "Produk Lain", href: "/kasir/aksesoris", tone: "from-violet-500 to-fuchsia-600", desc: "Aksesoris & voucher" },
              { label: "Pulsa", href: "/kasir/pulsa", tone: "from-emerald-500 to-teal-600", desc: "Transaksi cepat" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:-translate-y-1 hover:bg-white/10"
              >
                <div className={`inline-flex rounded-2xl bg-gradient-to-br ${item.tone} px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-black/20`}>
                  {item.label}
                </div>
                <p className="mt-3 text-sm text-white/65">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {cards.map((card) => (
          <section
            key={card.title}
            className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl space-y-4"
          >
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{card.title}</h2>
              <p className="mt-2 text-sm text-slate-500">{card.description}</p>
            </div>

            <div className="space-y-2">
              {card.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50"
                >
                  <span>{link.label}</span>
                  <span className="font-semibold text-violet-600">Buka</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
