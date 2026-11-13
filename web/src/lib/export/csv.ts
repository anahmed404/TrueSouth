/**
 * Plain CSV, written and read in the browser (docs/features/share-export.md, "Export data").
 *
 * - Comment lines start with "# " and come first: what the file is, the profile, the
 *   landing date, when it was made, the source and the caveat.
 * - Fields are quoted when they hold a comma, a quote or a line break.
 * - Numbers use a plain hyphen-minus, so a spreadsheet reads them as numbers. The screen
 *   uses a true minus sign; the file is for machines.
 * - Lines end in CRLF (RFC 4180), and the file starts with a byte-order mark so a
 *   spreadsheet reads it as UTF-8 (the degree sign, the en dash).
 */

export type CsvValue = string | number | boolean | null;

const BOM = "﻿";

function field(value: CsvValue): string {
  if (value === null) return "";
  const text = typeof value === "number" ? numberText(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function numberText(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(value);
}

export function toCsv(comments: readonly string[], header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [
    ...comments.map((line) => `# ${line.replace(/[\r\n]+/g, " ")}`),
    header.map(field).join(","),
    ...rows.map((row) => row.map(field).join(",")),
  ];
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

export type ParsedCsv = { comments: string[]; header: string[]; rows: string[][] };

/** Reads what `toCsv` writes (and any RFC 4180 CSV with leading "# " comment lines). */
export function parseCsv(text: string): ParsedCsv {
  const body = text.startsWith(BOM) ? text.slice(1) : text;
  const records: string[][] = [];
  const comments: string[] = [];
  let i = 0;
  let atLineStart = true;
  while (i < body.length) {
    if (atLineStart && records.length === 0 && body.startsWith("#", i)) {
      const end = body.indexOf("\n", i);
      const line = body.slice(i, end === -1 ? body.length : end).replace(/\r$/, "");
      comments.push(line.replace(/^# ?/, ""));
      i = end === -1 ? body.length : end + 1;
      continue;
    }
    const record: string[] = [];
    let value = "";
    let quoted = false;
    for (;;) {
      const ch = body[i];
      if (quoted) {
        if (ch === '"' && body[i + 1] === '"') {
          value += '"';
          i += 2;
        } else if (ch === '"') {
          quoted = false;
          i += 1;
        } else if (ch === undefined) {
          break;
        } else {
          value += ch;
          i += 1;
        }
        continue;
      }
      if (ch === '"' && value === "") {
        quoted = true;
        i += 1;
      } else if (ch === ",") {
        record.push(value);
        value = "";
        i += 1;
      } else if (ch === "\r" || ch === "\n" || ch === undefined) {
        record.push(value);
        if (ch === "\r" && body[i + 1] === "\n") i += 2;
        else i += 1;
        break;
      } else {
        value += ch;
        i += 1;
      }
    }
    records.push(record);
    atLineStart = true;
  }
  const [header = [], ...rows] = records;
  return { comments, header, rows };
}
