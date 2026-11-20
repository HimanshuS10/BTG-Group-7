/**
 * Shared RFC-4180 compliant CSV parser and validation helpers for SKYGUARD AI.
 * Supports:
 * - UTF-8 BOM stripping (\uFEFF)
 * - CRLF (\r\n), LF (\n), and CR (\r) line endings
 * - Quoted fields containing commas, spaces, and newlines
 * - Escaped double-quotes ("") inside quoted fields
 * - Preserved empty fields
 * - Signed numeric parsing (including negatives like -1250 or ($1,250.50))
 */

export interface CsvQuoteIssue {
  colIdx: number;
  message: string;
}

export interface ParsedCsvRow {
  rowNum: number;
  fields: string[];
  quoteErrors?: string[];
}

export interface ParsedCsvDocument {
  headers: string[];
  rows: ParsedCsvRow[];
  headerQuoteErrors?: string[];
}

export interface ParsedCsvRecordsDetailed {
  records: string[][];
  issuesByRecordIndex: Map<number, CsvQuoteIssue[]>;
}

export function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseCsvRecordsDetailed(rawText: string): ParsedCsvRecordsDetailed {
  const text = stripUtf8Bom(rawText);
  const records: string[][] = [];
  const issuesByRecordIndex = new Map<number, CsvQuoteIssue[]>();

  let currentRow: string[] = [];
  let currentRowIssues: CsvQuoteIssue[] = [];
  let currentField = '';
  let inQuotes = false;
  let fieldStartedWithQuote = false;
  let justClosedQuote = false;
  let trailingQuotedIssueRecorded = false;
  let unquotedMidQuoteRecorded = false;
  let quoteStartColIdx = 0;

  const pushRecord = () => {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell !== '') || currentRowIssues.length > 0) {
      const idx = records.length;
      records.push(currentRow);
      if (currentRowIssues.length > 0) {
        issuesByRecordIndex.set(idx, currentRowIssues);
      }
    }
    currentRow = [];
    currentRowIssues = [];
    currentField = '';
    fieldStartedWithQuote = false;
    justClosedQuote = false;
    trailingQuotedIssueRecorded = false;
    unquotedMidQuoteRecorded = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
          justClosedQuote = true;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === ',') {
      currentRow.push(currentField.trim());
      currentField = '';
      fieldStartedWithQuote = false;
      justClosedQuote = false;
      trailingQuotedIssueRecorded = false;
      unquotedMidQuoteRecorded = false;
    } else if (ch === '\r') {
      if (i + 1 < text.length && text[i + 1] === '\n') {
        i++;
      }
      pushRecord();
    } else if (ch === '\n') {
      pushRecord();
    } else if (ch === '"') {
      if (justClosedQuote) {
        if (!trailingQuotedIssueRecorded) {
          currentRowIssues.push({
            colIdx: currentRow.length,
            message: 'Malformed quotation marks — unescaped quote or unexpected text after closing quote.',
          });
          trailingQuotedIssueRecorded = true;
        }
        currentField += ch;
      } else if (currentField.trim().length === 0 && !fieldStartedWithQuote) {
        currentField = '';
        inQuotes = true;
        fieldStartedWithQuote = true;
        quoteStartColIdx = currentRow.length;
      } else {
        if (!unquotedMidQuoteRecorded) {
          currentRowIssues.push({
            colIdx: currentRow.length,
            message: 'Malformed quotation marks — stray quotation mark inside unquoted value.',
          });
          unquotedMidQuoteRecorded = true;
        }
        currentField += ch;
      }
    } else if (justClosedQuote) {
      if (ch !== ' ' && ch !== '\t' && !trailingQuotedIssueRecorded) {
        currentRowIssues.push({
          colIdx: currentRow.length,
          message: 'Malformed quotation marks — unexpected characters after closing quote before delimiter.',
        });
        trailingQuotedIssueRecorded = true;
      }
      currentField += ch;
    } else {
      currentField += ch;
    }
  }

  if (inQuotes) {
    currentRowIssues.push({
      colIdx: quoteStartColIdx,
      message: 'Malformed quotation marks — unclosed quotation mark before end of file.',
    });
  }

  if (currentField.length > 0 || currentRow.length > 0 || currentRowIssues.length > 0) {
    pushRecord();
  }

  return { records, issuesByRecordIndex };
}

export function parseCsvRecords(rawText: string): string[][] {
  return parseCsvRecordsDetailed(rawText).records;
}

export function parseCsvWithHeaders(rawText: string): ParsedCsvDocument {
  const { records, issuesByRecordIndex } = parseCsvRecordsDetailed(rawText);
  if (records.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = records[0].map((h) => h.trim());
  const headerIssues = issuesByRecordIndex.get(0)?.map((issue) => {
    const colName = headers[issue.colIdx] || `Column ${issue.colIdx + 1}`;
    return `Header Row, Column "${colName}": ${issue.message}`;
  });

  const rows: ParsedCsvRow[] = records.slice(1).map((fields, idx) => {
    const rowNum = idx + 1;
    const rawIssues = issuesByRecordIndex.get(idx + 1);
    const quoteErrors = rawIssues?.map((issue) => {
      const colName = headers[issue.colIdx] || `Column ${issue.colIdx + 1}`;
      return `Row ${rowNum}, Column "${colName}": ${issue.message}`;
    });
    return {
      rowNum,
      fields,
      quoteErrors,
    };
  });

  return {
    headers,
    rows,
    headerQuoteErrors: headerIssues && headerIssues.length > 0 ? headerIssues : undefined,
  };
}

export interface CsvNumberResult {
  valid: boolean;
  value: number;
  error?: string;
}

/**
 * Parses currency or signed numeric values from CSV strings.
 * Handles negative signs (-300, -1,250.50), accounting parentheses ((300000)),
 * CAD / $ prefixes, and thousand separators.
 */
export function parseCsvNumber(raw: string): CsvNumberResult {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return { valid: false, value: NaN, error: 'Value is empty' };
  }

  let working = trimmed;
  let isNegative = false;

  if (working.startsWith('(') && working.endsWith(')')) {
    isNegative = true;
    working = working.slice(1, -1).trim();
  }

  working = working.replace(/^CAD\s*/i, '').replace(/\$/g, '').replace(/,/g, '').replace(/\s+/g, '');

  if (working.startsWith('-')) {
    isNegative = !isNegative;
    working = working.slice(1);
  } else if (working.startsWith('+')) {
    working = working.slice(1);
  }

  if (!/^\d+(\.\d+)?$/.test(working)) {
    return { valid: false, value: NaN, error: `"${trimmed}" is not a valid number` };
  }

  const num = Number(working);
  if (!Number.isFinite(num)) {
    return { valid: false, value: NaN, error: `"${trimmed}" is out of numeric range` };
  }

  return {
    valid: true,
    value: isNegative ? -num : num,
  };
}
