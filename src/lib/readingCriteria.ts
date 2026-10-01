/**
 * Skin test reading criteria used to SUGGEST an interpretation. The clinician always
 * confirms the final interpretation; these values must be reviewed by the clinical owner.
 *
 * Based on EAACI skin-test reading conventions:
 * - Prick: positive when the wheal is >= 3 mm larger than the negative control.
 * - IDR: positive when the wheal grows by >= 3 mm over the initial injection bleb.
 * - Validity: positive control wheal >= 3 mm and negative control wheal < 3 mm.
 */
export const READING_THRESHOLD_MM = 3;
export const PRICK_READING_MINUTES = 15;
export const IDR_READING_MINUTES = 20;

export type Interpretation = "positive" | "negative" | "equivocal";
export type ControlsValidity = "valid" | "invalid" | "incomplete";

export function controlsValidity(positiveMm?: number, negativeMm?: number): ControlsValidity {
  if (positiveMm === undefined || negativeMm === undefined) return "incomplete";
  return positiveMm >= READING_THRESHOLD_MM && negativeMm < READING_THRESHOLD_MM ? "valid" : "invalid";
}

export function suggestPrick(whealMm?: number, negativeControlMm?: number): Interpretation | undefined {
  if (whealMm === undefined) return undefined;
  return whealMm - (negativeControlMm ?? 0) >= READING_THRESHOLD_MM ? "positive" : "negative";
}

export function suggestIdr(initialBlebMm?: number, whealMm?: number): Interpretation | undefined {
  if (initialBlebMm === undefined || whealMm === undefined) return undefined;
  return whealMm - initialBlebMm >= READING_THRESHOLD_MM ? "positive" : "negative";
}
