/**
 * Layer 1 — Trilingual UI Dictionary (`pt-BR`, `en-US`, `es-ES`)
 */
import { UiLocale } from "./models";

export function normalizeUiLocale(raw: string | null | undefined): UiLocale {
  const clean = (raw || "").toLowerCase();
  if (clean.startsWith("en")) return "en-US";
  if (clean.startsWith("es")) return "es-ES";
  return "pt-BR";
}

export function trText(locale: UiLocale, pt: string, en: string, es?: string): string {
  if (locale === "en-US") return en;
  if (locale === "es-ES") return es || en;
  return pt;
}
