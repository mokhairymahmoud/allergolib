export type DilutionPlan = {
  ratio: string;
  numerator: number;
  denominator: number;
  targetConcentration: number;
  stockVolumeMl: number;
  diluentVolumeMl: number;
  stepUpFromRatio?: string;
  stepUpStockVolumeMl?: number;
  stepUpDiluentVolumeMl?: number;
};

function gcd(a: number, b: number) {
  let left = Math.abs(a);
  let right = Math.abs(b);

  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }

  return left || 1;
}

function normalizeRatio(ratio: string) {
  const match = ratio.trim().match(/^(\d+):(\d+)$/);

  if (!match) {
    return null;
  }

  const numerator = Number.parseInt(match[1], 10);
  const denominator = Number.parseInt(match[2], 10);

  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || numerator <= 0 || denominator <= 0) {
    return null;
  }

  const divisor = gcd(numerator, denominator);
  return {
    ratio: `${numerator / divisor}:${denominator / divisor}`,
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
}

export function preferredDilutionRatios(seedRatios: string[]) {
  const normalized = new Map<string, { ratio: string; numerator: number; denominator: number }>();

  for (const ratio of [...seedRatios, "1:10", "1:100"]) {
    const parsed = normalizeRatio(ratio);

    if (parsed) {
      normalized.set(parsed.ratio, parsed);
    }
  }

  return [...normalized.values()]
    .sort((left, right) => left.denominator / left.numerator - right.denominator / right.numerator)
    .map((entry) => entry.ratio);
}

export function buildDilutionPlans(
  ratios: string[],
  stockConcentration: number,
  finalVolumeMl: number
) {
  const normalizedRatios = ratios
    .map(normalizeRatio)
    .filter((ratio): ratio is NonNullable<ReturnType<typeof normalizeRatio>> => Boolean(ratio))
    .sort((left, right) => left.denominator / left.numerator - right.denominator / right.numerator);

  return normalizedRatios.map((ratio, index) => {
    const dilutionFactor = ratio.denominator / ratio.numerator;
    const previous = normalizedRatios[index - 1];
    const previousFactor = previous ? previous.denominator / previous.numerator : undefined;
    const stepFactor =
      previousFactor && dilutionFactor % previousFactor === 0 ? dilutionFactor / previousFactor : undefined;

    return {
      ratio: ratio.ratio,
      numerator: ratio.numerator,
      denominator: ratio.denominator,
      targetConcentration: stockConcentration / dilutionFactor,
      stockVolumeMl: finalVolumeMl / dilutionFactor,
      diluentVolumeMl: finalVolumeMl - finalVolumeMl / dilutionFactor,
      stepUpFromRatio: stepFactor ? previous?.ratio : undefined,
      stepUpStockVolumeMl: stepFactor ? finalVolumeMl / stepFactor : undefined,
      stepUpDiluentVolumeMl: stepFactor ? finalVolumeMl - finalVolumeMl / stepFactor : undefined,
    } satisfies DilutionPlan;
  });
}

export function extractConcentrationUnit(value?: string) {
  if (!value) {
    return "";
  }

  const match = value.match(/^\s*[\d.,]+\s*(.+)$/i);
  return match ? match[1].trim() : "";
}

export type SerialStep = {
  /** Concentration reached after this step. */
  concentration: number;
  /** Volume taken from the stock (first step) or from the previous step. */
  carryVolumeMl: number;
  diluentVolumeMl: number;
};

export type TargetDilutionPlan = {
  /** Overall dilution factor, i.e. stock / target. 1 or less means no dilution is needed. */
  factor: number;
  stockVolumeMl: number;
  diluentVolumeMl: number;
  /**
   * 1:10 steps (plus a final partial step when the factor is not a power of ten),
   * each producing `finalVolumeMl`. Only offered when a direct mix would need
   * less than a tenth of the final volume, where pipetting gets imprecise.
   */
  serialSteps: SerialStep[];
};

const EPSILON = 1e-9;

export function buildTargetDilutionPlan(
  stockConcentration: number,
  targetConcentration: number,
  finalVolumeMl: number
): TargetDilutionPlan {
  const factor = stockConcentration / targetConcentration;

  if (factor <= 1 + EPSILON) {
    return { factor, stockVolumeMl: finalVolumeMl, diluentVolumeMl: 0, serialSteps: [] };
  }

  const serialSteps: SerialStep[] = [];

  if (factor > 10 + EPSILON) {
    const tenfoldSteps = Math.floor(Math.log10(factor) + EPSILON);
    const remainder = factor / 10 ** tenfoldSteps;
    let concentration = stockConcentration;

    for (let index = 0; index < tenfoldSteps; index += 1) {
      concentration /= 10;
      serialSteps.push({
        concentration,
        carryVolumeMl: finalVolumeMl / 10,
        diluentVolumeMl: finalVolumeMl - finalVolumeMl / 10,
      });
    }

    if (remainder > 1 + EPSILON) {
      serialSteps.push({
        concentration: targetConcentration,
        carryVolumeMl: finalVolumeMl / remainder,
        diluentVolumeMl: finalVolumeMl - finalVolumeMl / remainder,
      });
    }
  }

  return {
    factor,
    stockVolumeMl: finalVolumeMl / factor,
    diluentVolumeMl: finalVolumeMl - finalVolumeMl / factor,
    serialSteps,
  };
}

/** Splits a dataset concentration such as "0.01 mg/ml" into its number and unit. */
export function parseConcentration(value?: string) {
  const match = value?.match(/^\s*([\d.,]+)\s*(.+)$/);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? { amount, unit: match[2].trim() } : null;
}
