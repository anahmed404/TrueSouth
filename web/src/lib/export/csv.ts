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
 * - Formula injection (OWASP "CSV Injection"): a spreadsheet runs a cell that begins with
 *   `=`, `+`, `-` or `@` (also after leading spaces), or with a tab or a carriage return, as
 *   a formula. Every *string* cell that begins so is prefixed with a single quote `'`, so it
 *   opens as text; it is still quoted when it holds a comma, a quote or a line break.
 *   Numbers are written from `number` values and are never prefixed, so `-19.76` stays a
 *   number. Comment lines get the same guard after each comma, because a spreadsheet
 *   splits them into cells too.
 */

export type CsvValue = string | number | boolean | null;

const BOM = "﻿";

/** A string a spreadsheet would run as a formula (see the file's comment). */
const FORMULA_START = /^(?:[\t\r]|\s*[=+\-@])/;

/** Text that opens as text: a leading `'` when it would otherwise run as a formula. */
export function neutraliseFormula(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text;
}

function field(value: CsvValue): string {
  if (value === null) return "";
  const text = typeof value === "number" ? numberText(value) : neutraliseFormula(String(value));
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A comment line: one line, and no cell after a comma starts a formula. */
function commentLine(line: string): string {
  const parts = line.replace(/[\r\n]+/g, " ").split(",");
  return `# ${parts.map((part, index) => (index === 0 ? part : neutraliseFormula(part))).join(",")}`;
}

function numberText(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(value);
}

export function toCsv(comments: readonly string[], header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [
    ...comments.map(commentLine),
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
