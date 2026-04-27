import type { Language } from "../types";

export const dictionary = {
  en: {
    "home.eyebrow": "Offline Clinical Reference",
    "home.title": "PeriopSkinTest",
    "home.heroTitle": "Validated concentrations, instantly available",
    "home.heroBody":
      "This offline bundle is generated from structured curator tabs and seeded from the SFAR/SFA 2025 appendix for fast perioperative skin-test lookup.",
    "home.release": "Active release",
    "home.datasetOrigin": "Dataset source",
    "home.datasetOriginBundled": "Bundled offline release",
    "home.datasetOriginUpdated": "Verified local update",
    "search.title": "Drug search",
    "search.placeholder": "Search rocuronium, cefazolin, propofol...",
    "search.results": "seeded drugs",
    "search.aliases": "Aliases",
    "search.emptyTitle": "No seeded result",
    "search.emptyBody":
      "Try a generic name or one of the seeded aliases. Phase 1 only covers the initial offline reference set.",
    "detail.back": "Back to search",
    "detail.seedNotice":
      "Loaded from the active offline dataset. Verified background updates can replace the original bundle without blocking use.",
    "detail.concentration": "Maximum concentration",
    "detail.idr.maxConcentration": "Maximum intradermal concentration",
    "detail.idr.dilutions": "Common dilution steps",
    "detail.patch.vehicle": "Vehicle",
    "detail.notes": "Notes",
    "detail.noTestData": "No validated value is seeded for this test type in the current dataset.",
    "detail.source": "Sources",
    "detail.preferredSource": "Preferred authority",
    "detail.alternateSource": "Alternate authority",
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
      "Ce bundle hors ligne est genere a partir d'onglets de curation structures et initialise depuis l'annexe 4 SFAR/SFA 2025 pour une consultation rapide des tests cutanes perioperatoires.",
    "home.release": "Version active",
    "home.datasetOrigin": "Source des donnees",
    "home.datasetOriginBundled": "Version hors ligne embarquee",
    "home.datasetOriginUpdated": "Mise a jour locale verifiee",
    "search.title": "Recherche de medicament",
    "search.placeholder": "Rechercher rocuronium, cefazoline, propofol...",
    "search.results": "medicaments graines",
    "search.aliases": "Alias",
    "search.emptyTitle": "Aucun resultat graine",
    "search.emptyBody":
      "Essayez un nom generique ou un alias graine. La phase 1 couvre seulement le premier socle de reference hors ligne.",
    "detail.back": "Retour a la recherche",
    "detail.seedNotice":
      "Charge depuis le jeu de donnees hors ligne actif. Des mises a jour verifiees en arriere-plan peuvent remplacer le bundle d'origine sans bloquer l'usage.",
    "detail.concentration": "Concentration maximale",
    "detail.idr.maxConcentration": "Concentration maximale en IDR",
    "detail.idr.dilutions": "Dilutions courantes",
    "detail.patch.vehicle": "Vehicule",
    "detail.notes": "Notes",
    "detail.noTestData": "Aucune valeur validee n'est encore renseignee pour ce type de test dans le jeu de donnees actuel.",
    "detail.source": "Sources",
    "detail.preferredSource": "Autorite preferee",
    "detail.alternateSource": "Autorite alternative",
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
