import type { ProductCategory } from "@/generated/client";

function categoryTag(category: ProductCategory) {
  if (category === "HANDPHONE") return "HP";
  if (category === "PRODUK_LAIN") return "PRODUKLAIN";
  return "PULSA";
}

function randomUpperAlnum(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function generateInvoiceNumber(category: ProductCategory, date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `INV-${categoryTag(category)}-${y}${m}${d}-${randomUpperAlnum(8)}`;
}

