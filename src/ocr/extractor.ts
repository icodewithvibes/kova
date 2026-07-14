/**
 * Paystub extraction adapter interface.
 *
 * Implementations: MockPaystubExtractor (MVP — synthetic fixtures only),
 * ExternalOCRProvider (placeholder, needs keys + approval), and a future
 * local vision/OCR provider. OCR output is NEVER trusted without the
 * human review screen, and source images are not retained by default.
 */
import type { Money } from "@/domain/money";
import type { IsoDate } from "@/domain/types";

export type ExtractionMethod = "mock_ocr" | "external_ocr" | "local_vision" | "manual";

/** Normalized extraction result for one field — the strict OCR schema. */
export interface ExtractedField<T> {
  readonly value: T;
  readonly source: "paystub" | "user_entered";
  /** 0–1 extraction confidence; omitted for manual entry. */
  readonly confidence?: number;
  /** Raw label seen on the document, e.g. "FED W/H". */
  readonly rawLabel?: string;
  readonly method: ExtractionMethod;
  readonly requiresReview: boolean;
}

export interface ExtractedPaystub {
  readonly fixtureKey: string;
  readonly employer: ExtractedField<string>;
  readonly payDate: ExtractedField<IsoDate>;
  readonly periodStart: ExtractedField<IsoDate>;
  readonly periodEnd: ExtractedField<IsoDate>;
  readonly hours?: ExtractedField<number>;
  readonly hourlyRate?: ExtractedField<Money>;
  readonly tips?: ExtractedField<Money>;
  readonly gross: ExtractedField<Money>;
  readonly federalWithholding: ExtractedField<Money>;
  readonly stateWithholding: ExtractedField<Money>;
  readonly socialSecurity: ExtractedField<Money>;
  readonly medicare: ExtractedField<Money>;
  readonly otherDeductions: ExtractedField<Money>;
  readonly net: ExtractedField<Money>;
}

export interface PaystubExtractor {
  readonly id: string;
  readonly label: string;
  extract(input: { fixtureKey: string }): Promise<ExtractedPaystub>;
}
