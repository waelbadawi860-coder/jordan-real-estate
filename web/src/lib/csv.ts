/**
 * Builds a CSV file that opens correctly in Excel (UTF-8 with BOM, so Arabic
 * displays properly). Cells that start with = + - @ are prefixed with an
 * apostrophe so a malicious listing title can't run as a spreadsheet formula.
 */
export function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (value: string | number | boolean | null | undefined) => {
    if (value === null || value === undefined) return "";
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header, ...rows].map((r) => r.map(cell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
