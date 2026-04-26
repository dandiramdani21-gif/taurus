/* eslint-disable */

"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Download, Upload, Loader2 } from "lucide-react";

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
      {/* Export Button */}
      <button
        type="button"
        onClick={onExport}
        className="group relative flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-sm font-medium text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-md transition-all duration-200 ease-out active:scale-95"
      >
        <Download className="w-4 h-4 text-slate-500 group-hover:text-slate-700 transition-colors" />
        {exportLabel}
      </button>

      {/* Import Button */}
      <button
        type="button"
        onClick={openPicker}
        disabled={loading}
        className="group relative flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-sm font-medium text-white shadow-md shadow-indigo-200 hover:from-indigo-700 hover:to-indigo-600 hover:shadow-lg hover:shadow-indigo-300 transition-all duration-200 ease-out disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-md active:scale-95"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Memproses...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            {importLabel}
          </>
        )}
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