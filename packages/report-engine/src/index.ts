import type { ValidationSession } from "../../shared-types/src/index.ts";

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderJson(session: ValidationSession): string {
  return JSON.stringify(session, null, 2);
}

export function renderHtml(session: ValidationSession): string {
  return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><p>${escapeHtml(session.disclaimer_ar)}</p><p>status=${escapeHtml(session.overall_status)}</p></html>`;
}

export function renderPdf(_session: ValidationSession): Uint8Array {
  return new TextEncoder().encode("%PDF-1.4\n% Khatm placeholder — not ZATCA approved\n");
}

export type ReportView = "simple" | "technical";

export function projectFindings(session: ValidationSession, view: ReportView = "simple") {
  return (session.findings ?? []).map((f) => view === "simple"
    ? { status: f.status, title_ar: f.title_ar, title_en: f.title_en }
    : { id: f.id, layer: f.layer, status: f.status, title_ar: f.title_ar, title_en: f.title_en });
}
