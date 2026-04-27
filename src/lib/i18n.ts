import type { Language } from "../types";

export const dictionary = {
  en: {
    "home.eyebrow": "Offline Clinical Reference",
    "home.title": "PeriopSkinTest",
    "home.heroTitle": "Validated concentrations, instantly available",
    "home.heroBody":
      "Phase 1 ships a seeded offline dataset from the SFAR/SFA 2025 appendix for fast perioperative skin-test lookup.",
    "search.title": "Drug search",
    "search.placeholder": "Search rocuronium, cefazolin, propofol...",
    "search.results": "seeded drugs",
    "search.aliases": "Aliases",
    "search.emptyTitle": "No seeded result",
    "search.emptyBody":
      "Try a generic name or one of the seeded aliases. Phase 1 only covers the initial offline reference set.",
    "detail.back": "Back to search",
    "detail.seedNotice":
      "Seeded from SFAR/SFA 2025 Annex 4 for the first offline reference slice.",
    "detail.concentration": "Maximum concentration",
    "detail.idr.maxConcentration": "Maximum intradermal concentration",
    "detail.idr.dilutions": "Common dilution steps",
    "detail.patch.vehicle": "Vehicle",
    "detail.notes": "Notes",
    "detail.noTestData": "No validated value is seeded for this test type in the current dataset.",
    "detail.source": "Source",
    "detail.showSource": "Show source",
    "detail.hideSource": "Hide source",
    "tests.prick": "Prick",
    "tests.idr": "IDR",
    "tests.patch": "Patch"
  },
  fr: {
    "home.eyebrow": "Reference clinique hors ligne",
    "home.title": "PeriopSkinTest",
    "home.heroTitle": "Concentrations validees, accessibles tout de suite",
    "home.heroBody":
      "La phase 1 embarque un jeu de donnees hors ligne issu de l'annexe 4 SFAR/SFA 2025 pour une consultation rapide des tests cutanes perioperatoires.",
    "search.title": "Recherche de medicament",
    "search.placeholder": "Rechercher rocuronium, cefazoline, propofol...",
    "search.results": "medicaments graines",
    "search.aliases": "Alias",
    "search.emptyTitle": "Aucun resultat graine",
    "search.emptyBody":
      "Essayez un nom generique ou un alias graine. La phase 1 couvre seulement le premier socle de reference hors ligne.",
    "detail.back": "Retour a la recherche",
    "detail.seedNotice":
      "Jeu de donnees initialise depuis l'annexe 4 SFAR/SFA 2025 pour la premiere tranche de reference hors ligne.",
    "detail.concentration": "Concentration maximale",
    "detail.idr.maxConcentration": "Concentration maximale en IDR",
    "detail.idr.dilutions": "Dilutions courantes",
    "detail.patch.vehicle": "Vehicule",
    "detail.notes": "Notes",
    "detail.noTestData": "Aucune valeur validee n'est encore renseignee pour ce type de test dans le jeu de donnees actuel.",
    "detail.source": "Source",
    "detail.showSource": "Afficher la source",
    "detail.hideSource": "Masquer la source",
    "tests.prick": "Prick",
    "tests.idr": "IDR",
    "tests.patch": "Patch"
  }
} as const;

export function copy(language: Language, key: keyof (typeof dictionary)["en"]) {
  return dictionary[language][key];
}

