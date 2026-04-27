import type { Dataset, LocalizedString } from "../types";

function text(en: string, fr: string): LocalizedString {
  return { en, fr };
}

const annexSourceId = "sfar-sfa-2025-annex-4";

export const seedDataset: Dataset = {
  sources: {
    [annexSourceId]: {
      id: annexSourceId,
      label: "SFAR/SFA 2025",
      documentName: text(
        "Diagnostic et prise en charge des reactions d'hypersensibilite immediate perioperatoires - Annex 4",
        "Diagnostic et prise en charge des reactions d'hypersensibilite immediate perioperatoires - Annexe 4"
      ),
      excerpt: text(
        "Annex 4 lists validated maximum concentrations for prick and intradermal skin tests.",
        "L'annexe 4 liste les concentrations maximales validees pour les prick tests et les intradermo-reactions."
      ),
    },
  },
  drugs: [
    {
      id: "rocuronium",
      name: text("Rocuronium", "Rocuronium"),
      className: text("NMBA", "Curare"),
      aliases: ["rocuronium", "esmeron"],
      tests: {
        prick: {
          concentration: "10 mg/ml",
          dilutions: [],
          notes: [
            text(
              "Validated maximum prick concentration from SFAR/SFA 2025 Annex 4.",
              "Concentration maximale de prick validee dans l'annexe 4 SFAR/SFA 2025."
            ),
          ],
          sourceId: annexSourceId,
        },
        idr: {
          concentration: "0.05 mg/ml",
          maxConcentration: "0.05 mg/ml",
          dilutions: ["1:100", "1:10"],
          notes: [
            text(
              "Use the validated intradermal maximum concentration from Annex 4.",
              "Utiliser la concentration maximale validee en IDR issue de l'annexe 4."
            ),
          ],
          sourceId: annexSourceId,
        },
        patch: {
          dilutions: [],
          notes: [
            text(
              "No patch concentration is seeded from Annex 4 for rocuronium in Phase 1.",
              "Aucune concentration de patch test n'est renseignee depuis l'annexe 4 pour le rocuronium en phase 1."
            ),
          ],
          sourceId: annexSourceId,
        },
      },
    },
    {
      id: "succinylcholine",
      name: text("Succinylcholine", "Succinylcholine"),
      className: text("NMBA", "Curare"),
      aliases: ["succinylcholine", "suxamethonium", "celocurine"],
      tests: {
        prick: {
          concentration: "10 mg/ml",
          dilutions: [],
          notes: [
            text(
              "Validated maximum prick concentration from SFAR/SFA 2025 Annex 4.",
              "Concentration maximale de prick validee dans l'annexe 4 SFAR/SFA 2025."
            ),
          ],
          sourceId: annexSourceId,
        },
        idr: {
          concentration: "0.1 mg/ml",
          maxConcentration: "0.1 mg/ml",
          dilutions: ["1:100", "1:10"],
          notes: [
            text(
              "Use the validated intradermal maximum concentration from Annex 4.",
              "Utiliser la concentration maximale validee en IDR issue de l'annexe 4."
            ),
          ],
          sourceId: annexSourceId,
        },
        patch: {
          dilutions: [],
          notes: [
            text(
              "No patch concentration is seeded from Annex 4 for succinylcholine in Phase 1.",
              "Aucune concentration de patch test n'est renseignee depuis l'annexe 4 pour la succinylcholine en phase 1."
            ),
          ],
          sourceId: annexSourceId,
        },
      },
    },
    {
      id: "cisatracurium",
      name: text("Cisatracurium", "Cis-atracurium"),
      className: text("NMBA", "Curare"),
      aliases: ["cisatracurium", "cis-atracurium", "nimbex"],
      tests: {
        prick: {
          concentration: "2 mg/ml",
          dilutions: [],
          notes: [
            text(
              "Validated maximum prick concentration from SFAR/SFA 2025 Annex 4.",
              "Concentration maximale de prick validee dans l'annexe 4 SFAR/SFA 2025."
            ),
          ],
          sourceId: annexSourceId,
        },
        idr: {
          concentration: "0.02 mg/ml",
          maxConcentration: "0.02 mg/ml",
          dilutions: ["1:100", "1:10"],
          notes: [
            text(
              "Use the validated intradermal maximum concentration from Annex 4.",
              "Utiliser la concentration maximale validee en IDR issue de l'annexe 4."
            ),
          ],
          sourceId: annexSourceId,
        },
        patch: {
          dilutions: [],
          notes: [
            text(
              "No patch concentration is seeded from Annex 4 for cisatracurium in Phase 1.",
              "Aucune concentration de patch test n'est renseignee depuis l'annexe 4 pour le cisatracurium en phase 1."
            ),
          ],
          sourceId: annexSourceId,
        },
      },
    },
    {
      id: "atracurium",
      name: text("Atracurium", "Atracurium"),
      className: text("NMBA", "Curare"),
      aliases: ["atracurium", "tracrium"],
      tests: {
        prick: {
          concentration: "1 mg/ml",
          dilutions: [],
          notes: [
            text(
              "Validated maximum prick concentration from SFAR/SFA 2025 Annex 4.",
              "Concentration maximale de prick validee dans l'annexe 4 SFAR/SFA 2025."
            ),
          ],
          sourceId: annexSourceId,
        },
        idr: {
          concentration: "0.01 mg/ml",
          maxConcentration: "0.01 mg/ml",
          dilutions: ["1:100", "1:10"],
          notes: [
            text(
              "Use the validated intradermal maximum concentration from Annex 4.",
              "Utiliser la concentration maximale validee en IDR issue de l'annexe 4."
            ),
          ],
          sourceId: annexSourceId,
        },
        patch: {
          dilutions: [],
          notes: [
            text(
              "No patch concentration is seeded from Annex 4 for atracurium in Phase 1.",
              "Aucune concentration de patch test n'est renseignee depuis l'annexe 4 pour l'atracurium en phase 1."
            ),
          ],
          sourceId: annexSourceId,
        },
      },
    },
    {
      id: "cefazolin",
      name: text("Cefazolin", "Cefazoline"),
      className: text("Antibiotic", "Beta-lactamine"),
      aliases: ["cefazolin", "cefazoline", "ancef"],
      tests: {
        prick: {
          concentration: "20 mg/ml",
          dilutions: [],
          notes: [
            text(
              "Validated maximum prick concentration from SFAR/SFA 2025 Annex 4.",
              "Concentration maximale de prick validee dans l'annexe 4 SFAR/SFA 2025."
            ),
          ],
          sourceId: annexSourceId,
        },
        idr: {
          concentration: "20 mg/ml",
          maxConcentration: "20 mg/ml",
          dilutions: ["1:10"],
          notes: [
            text(
              "The same validated maximum concentration is listed for prick and intradermal testing in Annex 4.",
              "La meme concentration maximale validee est listee pour le prick test et l'IDR dans l'annexe 4."
            ),
          ],
          sourceId: annexSourceId,
        },
        patch: {
          dilutions: [],
          notes: [
            text(
              "No patch concentration is seeded from Annex 4 for cefazolin in Phase 1.",
              "Aucune concentration de patch test n'est renseignee depuis l'annexe 4 pour la cefazoline en phase 1."
            ),
          ],
          sourceId: annexSourceId,
        },
      },
    },
    {
      id: "amoxicillin",
      name: text("Amoxicillin", "Amoxicilline"),
      className: text("Antibiotic", "Beta-lactamine"),
      aliases: ["amoxicillin", "amoxicilline", "amox"],
      tests: {
        prick: {
          concentration: "20 mg/ml",
          dilutions: [],
          notes: [
            text(
              "Validated maximum prick concentration from SFAR/SFA 2025 Annex 4.",
              "Concentration maximale de prick validee dans l'annexe 4 SFAR/SFA 2025."
            ),
          ],
          sourceId: annexSourceId,
        },
        idr: {
          concentration: "20 mg/ml",
          maxConcentration: "20 mg/ml",
          dilutions: ["1:10"],
          notes: [
            text(
              "The same validated maximum concentration is listed for prick and intradermal testing in Annex 4.",
              "La meme concentration maximale validee est listee pour le prick test et l'IDR dans l'annexe 4."
            ),
          ],
          sourceId: annexSourceId,
        },
        patch: {
          dilutions: [],
          notes: [
            text(
              "No patch concentration is seeded from Annex 4 for amoxicillin in Phase 1.",
              "Aucune concentration de patch test n'est renseignee depuis l'annexe 4 pour l'amoxicilline en phase 1."
            ),
          ],
          sourceId: annexSourceId,
        },
      },
    },
    {
      id: "propofol",
      name: text("Propofol", "Propofol"),
      className: text("Hypnotic", "Hypnotique"),
      aliases: ["propofol", "diprivan"],
      tests: {
        prick: {
          concentration: "10 mg/ml",
          dilutions: [],
          notes: [
            text(
              "Validated maximum prick concentration from SFAR/SFA 2025 Annex 4.",
              "Concentration maximale de prick validee dans l'annexe 4 SFAR/SFA 2025."
            ),
          ],
          sourceId: annexSourceId,
        },
        idr: {
          concentration: "1 mg/ml",
          maxConcentration: "1 mg/ml",
          dilutions: ["1:10"],
          notes: [
            text(
              "Use the validated intradermal maximum concentration from Annex 4.",
              "Utiliser la concentration maximale validee en IDR issue de l'annexe 4."
            ),
          ],
          sourceId: annexSourceId,
        },
        patch: {
          dilutions: [],
          notes: [
            text(
              "No patch concentration is seeded from Annex 4 for propofol in Phase 1.",
              "Aucune concentration de patch test n'est renseignee depuis l'annexe 4 pour le propofol en phase 1."
            ),
          ],
          sourceId: annexSourceId,
        },
      },
    },
    {
      id: "midazolam",
      name: text("Midazolam", "Midazolam"),
      className: text("Hypnotic", "Hypnotique"),
      aliases: ["midazolam", "hypnovel", "versed"],
      tests: {
        prick: {
          concentration: "1 mg/ml",
          dilutions: [],
          notes: [
            text(
              "Validated maximum prick concentration from SFAR/SFA 2025 Annex 4.",
              "Concentration maximale de prick validee dans l'annexe 4 SFAR/SFA 2025."
            ),
          ],
          sourceId: annexSourceId,
        },
        idr: {
          concentration: "0.01 mg/ml",
          maxConcentration: "0.01 mg/ml",
          dilutions: ["1:100"],
          notes: [
            text(
              "Marked as possibly irritant at the maximum concentration in Annex 4.",
              "Signale comme possiblement irritant a la concentration maximale dans l'annexe 4."
            ),
          ],
          sourceId: annexSourceId,
        },
        patch: {
          dilutions: [],
          notes: [
            text(
              "No patch concentration is seeded from Annex 4 for midazolam in Phase 1.",
              "Aucune concentration de patch test n'est renseignee depuis l'annexe 4 pour le midazolam en phase 1."
            ),
          ],
          sourceId: annexSourceId,
        },
      },
    },
  ],
};
