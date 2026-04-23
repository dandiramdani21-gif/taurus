"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";

type SpreadsheetActionsProps = {
  onExport: () => void;
  onImportRows: (rows: Record<string, any>[]) => Promise<void> | void;
  exportLabel?: string;
  importLabel?: string;
};

export default function SpreadsheetActions({
  onExport,
  onImportRows,
  exportLabel = "Export",
  importLabel = "Import",
}: SpreadsheetActionsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      await onImportRows(rows);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onExport}
        className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
      >
        {exportLabel}
      </button>
      <button
        type="button"
        onClick={openPicker}
        className="px-4 py-2 rounded-xl border border-purple-200 bg-purple-50 text-sm font-medium text-purple-700 hover:bg-purple-100 transition disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "Memproses..." : importLabel}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
