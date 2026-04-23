export type InvoicePdfItem = {
  name: string;
  code?: string | null;
  detail?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type InvoicePdfData = {
  invoiceNumber: string;
  invoiceDate: string;
  storeName: string;
  storeAddressLines: string[];
  categoryLabel: string;
  items: InvoicePdfItem[];
  totalAmount: number;
  totalCost?: number;
  profit?: number;
  notes?: string[];
  footer?: string;
};

type PdfLine = {
  text: string;
  bold?: boolean;
  size?: number;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 42;
const MARGIN_TOP = 44;
const MARGIN_BOTTOM = 44;
const MAX_LINES_PER_PAGE = 36;

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function escapePdfText(value: string) {
  return normalizeText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function money(value: number) {
  return `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
}

function wrapText(value: string, maxChars: number) {
  const text = normalizeText(value).trim();
  if (!text) return [""];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function buildPageBlocks(data: InvoicePdfData) {
  const header: PdfLine[] = [
    { text: data.storeName, bold: true, size: 18 },
    ...data.storeAddressLines.map((line) => ({ text: line, size: 10 })),
    { text: "", size: 10 },
    { text: `Invoice: ${data.invoiceNumber}`, bold: true, size: 12 },
    { text: `Tanggal: ${data.invoiceDate}`, size: 10 },
    { text: `Kategori: ${data.categoryLabel}`, size: 10 },
    { text: "", size: 10 },
  ];

  const blocks: PdfLine[][] = [];

  data.items.forEach((item, index) => {
    const nameLines = wrapText(`${index + 1}. ${item.name}`, 58);
    const code = item.code ? `Kode: ${item.code}` : "-";
    const detail = item.detail ? `Detail: ${item.detail}` : "-";
    const summary = `Qty ${item.quantity} | ${money(item.unitPrice)} | ${money(item.total)}`;

    const block: PdfLine[] = [
      { text: nameLines[0], size: 10 },
      ...nameLines.slice(1).map((line) => ({ text: line, size: 10 })),
      { text: code, size: 9 },
      { text: detail, size: 9 },
      { text: summary, bold: true, size: 10 },
      { text: "", size: 8 },
    ];

    blocks.push(block);
  });

  const totals: PdfLine[] = [
    { text: "", size: 10 },
    { text: `Subtotal: ${money(data.totalAmount)}`, bold: true, size: 12 },
  ];

  if (typeof data.totalCost === "number") {
    totals.push({ text: `Modal: ${money(data.totalCost)}`, size: 10 });
  }

  if (typeof data.profit === "number") {
    totals.push({ text: `Laba/Rugi: ${money(data.profit)}`, bold: true, size: 10 });
  }

  if (data.notes?.length) {
    totals.push({ text: "", size: 10 });
    data.notes.forEach((note) => totals.push({ text: note, size: 10 }));
  }

  if (data.footer) {
    totals.push({ text: "", size: 10 }, { text: data.footer, size: 10 });
  }

  return { header, blocks, totals };
}

function splitIntoPages(data: InvoicePdfData) {
  const { header, blocks, totals } = buildPageBlocks(data);
  const pages: PdfLine[][] = [];
  let current: PdfLine[] = [...header];

  const flushPage = () => {
    pages.push(current);
    current = [...header];
  };

  for (const block of blocks) {
    if (current.length + block.length + totals.length > MAX_LINES_PER_PAGE) {
      flushPage();
    }
    current.push(...block);
  }

  if (current.length + totals.length > MAX_LINES_PER_PAGE) {
    flushPage();
  }

  current.push(...totals);
  pages.push(current);

  return pages;
}

function renderPage(lines: PdfLine[], pageNumber: number, totalPages: number) {
  const commands: string[] = [];
  let y = PAGE_HEIGHT - MARGIN_TOP;

  const pushLine = (text: string, bold = false, size = 10, offsetX = MARGIN_X) => {
    const font = bold ? "/F2" : "/F1";
    commands.push(`BT ${font} ${size} Tf ${offsetX} ${y} Td (${escapePdfText(text)}) Tj ET`);
    y -= size + 4;
  };

  for (const line of lines) {
    if (!line.text && y < MARGIN_BOTTOM + 40) {
      continue;
    }
    pushLine(line.text, Boolean(line.bold), line.size ?? 10);
  }

  commands.push(`BT /F1 9 Tf ${MARGIN_X} ${MARGIN_BOTTOM - 10} Td (Page ${pageNumber} of ${totalPages}) Tj ET`);

  return commands.join("\n");
}

function buildPdfObject(id: number, body: string) {
  return `${id} 0 obj\n${body}\nendobj\n`;
}

export function buildInvoicePdfBuffer(data: InvoicePdfData) {
  const pages = splitIntoPages(data);
  const objects: string[] = [];

  const catalogId = 1;
  const pagesId = 2;
  const fontRegularId = 3;
  const fontBoldId = 4;
  let nextObjectId = 5;

  const pageIds: number[] = [];
  const contentIds: number[] = [];

  for (let i = 0; i < pages.length; i += 1) {
    pageIds.push(nextObjectId);
    contentIds.push(nextObjectId + 1);
    nextObjectId += 2;
  }

  objects.push(
    buildPdfObject(
      catalogId,
      `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
    )
  );

  objects.push(
    buildPdfObject(
      pagesId,
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`
    )
  );

  objects.push(
    buildPdfObject(
      fontRegularId,
      `<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`
    )
  );

  objects.push(
    buildPdfObject(
      fontBoldId,
      `<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>`
    )
  );

  pages.forEach((pageLines, index) => {
    const pageContent = renderPage(pageLines, index + 1, pages.length);
    const contentStream = `<< /Length ${Buffer.byteLength(pageContent, "latin1")} >>\nstream\n${pageContent}\nendstream`;
    objects.push(
      buildPdfObject(
        pageIds[index],
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`
      )
    );
    objects.push(buildPdfObject(contentIds[index], contentStream));
  });

  const header = "%PDF-1.4\n";
  let body = header;
  const offsets: number[] = [0];

  objects.forEach((obj) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += obj;
  });

  const xrefStart = Buffer.byteLength(body, "latin1");
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += `0000000000 65535 f \n`;

  for (let i = 1; i <= objects.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(`${body}${xref}${trailer}`, "latin1");
}
