Great—let’s turn this into a clear, build-ready PRD that a coding agent (or dev) can execute without ambiguity.

⸻

📄 Product Requirements Document (PRD)

Product name (working): PeriopSkinTest
Version: MVP v1
Target users: Allergologists (perioperative drug allergy)

⸻

🎯 1. Objective

Build a mobile-first application that allows clinicians to instantly access validated skin test concentrations (prick, intradermal, patch) for perioperative drugs, sourced from Société Française d’Allergologie and European Academy of Allergy and Clinical Immunology.

The app must:

* deliver answers in <10 seconds
* be usable during clinical workflow
* function offline
* be informational only (no decision automation)

⸻

👤 2. Target Users

* Primary: Allergologists managing perioperative hypersensitivity
* Secondary (future): Anesthesiologists

⸻

📱 3. Platform

* Mobile-first (iOS + Android)
* Offline-first architecture
* Multilingual (English + French for MVP)

⸻

🧪 4. Scope (MVP)

Included

* Perioperative drugs:
    * NMBA (rocuronium, succinylcholine, cisatracurium, etc.)
    * Key antibiotics (cefazolin, amoxicillin…)
    * Hypnotics (propofol, midazolam)
* Test types:
    * Prick test
    * Intradermal (IDR)
    * Patch test (basic support)

Excluded (MVP)

* Non-perioperative drugs
* Patient data storage
* Diagnostic recommendations
* EHR integration

⸻

⚙️ 5. Core Features

⸻

🔍 5.1 Drug Search

Requirements

* Free text search (e.g., “rocuronium”, “cefazolin”)
* Autocomplete suggestions
* Tolerant to spelling variations

Output

* Direct navigation to drug detail screen

⸻

📄 5.2 Drug Detail Screen (Core Feature)

Layout (single scroll screen max)

Header

* Drug name
* Drug class (e.g., NMBA)

⸻

Test Section (tab or segmented control)

Tabs:

* Prick
* IDR
* Patch

⸻

For each test type display:

Prick

* Concentration (mg/mL or standardized unit)
* Notes (if applicable)
* Source reference

⸻

IDR

* Recommended dilutions (e.g., 1:100 → 1:10)
* Maximum non-irritant concentration
* Notes:
    * irritant threshold
    * false positive risk
* Source reference

⸻

Patch

* Concentration (if available)
* Vehicle (if relevant)
* Source reference

⸻

Notes Section

* Bullet points:
    * irritant concentrations
    * cross-reactivity
    * warnings

⸻

Source Section

* Display:
    * “SFA/SFAR 2025”
    * “EAACI/ENDA”
* Expandable to show:
    * exact reference text (short excerpt)
    * document name

⸻

🧮 5.3 Dilution Calculator

Input

* Stock concentration (user input, e.g., 10 mg/mL)

Output

* Step-by-step dilution instructions:
    * e.g., “To obtain 1:100 → 0.1 mL + 9.9 mL diluent”
* Multiple dilution steps if needed

Rules

* Must work offline
* Must support common dilution ratios (1:10, 1:100, etc.)

⸻

⭐ 5.4 Favorites

* User can bookmark drugs
* Stored locally (offline)
* Accessible from home screen

⸻

📴 5.5 Offline Mode

* Full database embedded in app
* No internet required for core features
* Updates via app update (MVP)

⸻

🧱 6. Data Model

Drug Object

{
  "id": "rocuronium",
  "name": "Rocuronium",
  "class": "NMBA",
  "tests": {
    "prick": {
      "concentration": "X mg/mL",
      "notes": ["optional"],
      "source": "SFA 2025"
    },
    "idr": {
      "dilutions": ["1:100", "1:10"],
      "max_concentration": "X mg/mL",
      "notes": [
        "Irritant above X",
        "Risk of false positive"
      ],
      "source": "EAACI 2013"
    },
    "patch": {
      "concentration": "optional",
      "vehicle": "optional",
      "source": "optional"
    }
  },
  "notes": [
    "Cross-reactivity NMBA"
  ]
}

⸻

🎨 7. UX Requirements

* Time to answer: <10 seconds
* Max 2 taps to reach concentration info
* Minimal scrolling
* Large readable typography (clinical use)
* Dark mode support

⸻

🌍 8. Localization

* Languages:
    * English (default)
    * French
* All content stored with language keys

⸻

⚠️ 9. Compliance & Safety

* App must display disclaimer:
    * “For informational purposes only. Refer to official guidelines.”
* No:
    * diagnosis
    * treatment recommendation
    * patient-specific advice

⸻

🔄 10. Updates (MVP)

* Static dataset (hardcoded or local JSON)
* Updated via app releases

⸻

🧪 11. Initial Dataset (MVP)

Include ~10 drugs:

* Rocuronium
* Succinylcholine
* Cisatracurium
* Atracurium
* Cefazolin
* Amoxicillin
* Propofol
* Midazolam

⸻

🧰 12. Suggested Tech Stack

Frontend

* React Native (cross-platform)

Data

* Local JSON or SQLite

State

* Lightweight state management (Zustand / Redux optional)

⸻

🚀 13. Success Criteria (MVP)

* User can:
    * search a drug
    * view concentrations in <10 seconds
    * calculate dilution
    * use app offline

⸻

🔥 14. Future (Not MVP)

* Automatic guideline updates
* Protocol builder
* Export reports
* Cross-reactivity suggestions
* Web version

⸻

✅ Final Note

This PRD is intentionally:

* narrow
* fast to build
* clinically usable
