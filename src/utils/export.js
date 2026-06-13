import { formatCellValue } from "./formatting";

function escapeCsvValue(value) {
  const normalized = String(value ?? "").replace(/"/g, '""');
  return `"${normalized}"`;
}

function sanitizeFileName(value) {
  return String(value || "export")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function downloadCsv({ title, columns, records, mapRecord, fileSuffix = "export" }) {
  const headerRow = columns.map((column) => escapeCsvValue(column.label)).join(",");
  const dataRows = records.map((record, index) => {
    const mappedRecord = mapRecord ? mapRecord(record, index) : record;
    return columns.map((column) => escapeCsvValue(formatCellValue(mappedRecord[column.key]))).join(",");
  });

  const csvContent = ["\uFEFF" + headerRow, ...dataRows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const fileName = `${sanitizeFileName(title)}-${sanitizeFileName(fileSuffix)}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
