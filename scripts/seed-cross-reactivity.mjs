import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const generatedDir = join(rootDir, "src", "data", "generated");
const datasetPath = join(generatedDir, "dataset.json");
const manifestPath = join(generatedDir, "manifest.json");

const dataset = JSON.parse(readFileSync(datasetPath, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const drugIds = new Set(dataset.drugs.map((d) => d.id));

// ─── NMBA Cross-Reactivity ──────────────────────────────────────────────────

const nmbaGroup = (fromId) => {
  const nmbaDrugs = [
    "rocuronium", "vecuronium", "pancuronium",
    "cisatracurium", "atracurium", "mivacurium",
    "succinylcholine",
  ];

  const aminosteroids = new Set(["rocuronium", "vecuronium", "pancuronium"]);
  const benzylisoquinolines = new Set(["cisatracurium", "atracurium", "mivacurium"]);
  const isAmino = aminosteroids.has(fromId);
  const isBenzyl = benzylisoquinolines.has(fromId);
  const isSucc = fromId === "succinylcholine";

  const entries = nmbaDrugs
    .filter((id) => id !== fromId)
    .map((toId) => {
      const toAmino = aminosteroids.has(toId);
      const toBenzyl = benzylisoquinolines.has(toId);
      const toSucc = toId === "succinylcholine";

      let tier, structuralRelation, rationaleEn, rationaleFr;

      if (isAmino && toAmino) {
        tier = "higher-concern";
        structuralRelation = "structurally-related";
        rationaleEn = "Same aminosteroid class with shared steroidal backbone and quaternary ammonium epitopes. Up to 85% cross-reactivity on skin testing between aminosteroid NMBAs.";
        rationaleFr = "Meme classe aminosteroide avec squelette steroidal et epitopes ammonium quaternaire partages. Jusqu'a 85% de reactivite croisee aux tests cutanes entre curares aminosteroides.";
      } else if (isBenzyl && toBenzyl) {
        if (
          (fromId === "atracurium" && toId === "cisatracurium") ||
          (fromId === "cisatracurium" && toId === "atracurium")
        ) {
          tier = "higher-concern";
          structuralRelation = "structurally-related";
          rationaleEn = "Cisatracurium is the R-cis isomer of atracurium; near-identical molecular structure with shared quaternary ammonium groups.";
          rationaleFr = "Le cisatracurium est l'isomere R-cis de l'atracurium; structure moleculaire quasi identique avec groupes ammonium quaternaire partages.";
        } else {
          tier = "higher-concern";
          structuralRelation = "structurally-related";
          rationaleEn = "Same benzylisoquinoline class sharing quaternary ammonium epitopes targeted by IgE in NMBA hypersensitivity.";
          rationaleFr = "Meme classe benzylisoquinoline partageant les epitopes ammonium quaternaire cibles par les IgE dans l'hypersensibilite aux curares.";
        }
      } else if (isAmino && toBenzyl) {
        tier = "lower-expected";
        structuralRelation = "structurally-distinct";
        if (toId === "cisatracurium") {
          rationaleEn = "Different class (benzylisoquinoline vs aminosteroid). Cisatracurium shows the lowest cross-reactivity rate (14%) and is the most frequently tolerated alternative.";
          rationaleFr = "Classe differente (benzylisoquinoline vs aminosteroide). Le cisatracurium presente le taux de reactivite croisee le plus bas (14%) et est l'alternative la plus frequemment toleree.";
        } else {
          rationaleEn = "Different structural class (benzylisoquinoline vs aminosteroid). Shared quaternary ammonium epitope but lower cross-reactivity expected due to distinct backbone.";
          rationaleFr = "Classe structurelle differente (benzylisoquinoline vs aminosteroide). Epitope ammonium quaternaire partage mais reactivite croisee plus faible attendue en raison du squelette distinct.";
        }
      } else if (isBenzyl && toAmino) {
        tier = "lower-expected";
        structuralRelation = "structurally-distinct";
        rationaleEn = "Different structural class (aminosteroid vs benzylisoquinoline). Shared quaternary ammonium epitope but lower cross-reactivity expected due to distinct backbone.";
        rationaleFr = "Classe structurelle differente (aminosteroide vs benzylisoquinoline). Epitope ammonium quaternaire partage mais reactivite croisee plus faible attendue en raison du squelette distinct.";
      } else if (isAmino && toSucc) {
        tier = "lower-expected";
        structuralRelation = "structurally-distinct";
        rationaleEn = "Depolarizing agent with bis-quaternary ammonium structure. Only 12.5% cross-reactivity with aminosteroid NMBAs on skin testing.";
        rationaleFr = "Agent depolarisant avec structure bis-ammonium quaternaire. Seulement 12,5% de reactivite croisee avec les curares aminosteroides aux tests cutanes.";
      } else if (isBenzyl && toSucc) {
        tier = "lower-expected";
        structuralRelation = "structurally-distinct";
        rationaleEn = "Depolarizing agent structurally distinct from benzylisoquinolines. Shared quaternary ammonium epitope but different backbone.";
        rationaleFr = "Agent depolarisant structurellement distinct des benzylisoquinolines. Epitope ammonium quaternaire partage mais squelette different.";
      } else if (isSucc && toAmino) {
        tier = "higher-concern";
        structuralRelation = "structurally-distinct";
        rationaleEn = "Bis-quaternary ammonium structure in succinylcholine often triggers broad IgE recognition of other quaternary ammonium-bearing NMBAs.";
        rationaleFr = "La structure bis-ammonium quaternaire de la succinylcholine declenche souvent une reconnaissance IgE large des autres curares porteurs d'ammonium quaternaire.";
      } else if (isSucc && toBenzyl) {
        if (toId === "cisatracurium") {
          tier = "lower-expected";
          structuralRelation = "structurally-distinct";
          rationaleEn = "Lowest structural similarity to depolarizing agents among benzylisoquinolines. Cisatracurium is the most frequently tolerated alternative.";
          rationaleFr = "Plus faible similarite structurelle avec les agents depolarisants parmi les benzylisoquinolines. Le cisatracurium est l'alternative la plus frequemment toleree.";
        } else {
          tier = "lower-expected";
          structuralRelation = "structurally-distinct";
          rationaleEn = "Benzylisoquinoline class with different backbone from depolarizing agents. Shared quaternary ammonium epitope but lower cross-reactivity expected.";
          rationaleFr = "Classe benzylisoquinoline avec squelette different des agents depolarisants. Epitope ammonium quaternaire partage mais reactivite croisee plus faible attendue.";
        }
      }

      return {
        drugId: toId,
        tier,
        structuralRelation,
        rationale: { en: rationaleEn, fr: rationaleFr },
        sourceIds: ["sfar-sfa-2025-annex-4"],
      };
    });

  const panel = nmbaDrugs.filter((id) => id !== fromId);

  return {
    groupName: {
      en: "Neuromuscular Blocking Agents",
      fr: "Curares",
    },
    entries,
    suggestedPanel: panel,
    panelRationale: {
      en: "When an NMBA is the suspected culprit, consider evaluating all available NMBAs to identify agents with lower expected cross-reactivity for future procedures.",
      fr: "Lorsqu'un curare est le culprit suspecte, envisager d'evaluer tous les curares disponibles pour identifier les agents avec une reactivite croisee attendue plus faible pour les procedures futures.",
    },
  };
};

// ─── Beta-Lactam Cross-Reactivity ────────────────────────────────────────────

const penicillins = new Set(["amoxicillin", "amoxicillin-clavulanate", "piperacillin", "piperacillin-tazobactam", "cloxacillin"]);
const cephalosporins = new Set(["cefazolin", "cefuroxime", "cefotaxime", "ceftriaxone", "cefepime", "ceftazidime"]);
const carbapenems = new Set(["ertapenem", "imipenem", "meropenem"]);

function betaLactamGroups(fromId) {
  const groups = [];

  if (penicillins.has(fromId)) {
    const isAmox = fromId === "amoxicillin" || fromId === "amoxicillin-clavulanate";

    // Penicillin → Cephalosporin group
    const cephEntries = [];
    for (const cephId of cephalosporins) {
      let tier, rationaleEn, rationaleFr;
      if (isAmox && cephId === "cefazolin") {
        tier = "lower-expected";
        rationaleEn = "Different R1 side chain from aminopenicillins. Cefazolin has a unique tetrazole side chain; cross-reactivity is not driven by shared R1 structures.";
        rationaleFr = "Chaine laterale R1 differente des aminopenicillines. La cefazoline a une chaine laterale tetrazole unique; la reactivite croisee n'est pas liee a des structures R1 partagees.";
      } else if (cephId === "ceftazidime") {
        tier = "lower-expected";
        rationaleEn = "Different R1 side chain from penicillins. Cross-reactivity rate below 2% with dissimilar side chains.";
        rationaleFr = "Chaine laterale R1 differente des penicillines. Taux de reactivite croisee inferieur a 2% avec des chaines laterales dissimilaires.";
      } else if (cephId === "cefotaxime" || cephId === "ceftriaxone") {
        tier = "lower-expected";
        rationaleEn = "Third-generation cephalosporin with aminothiazolyl-methoxyimino R1 side chain dissimilar to penicillin side chains. Negligible cross-reactivity in published meta-analyses.";
        rationaleFr = "Cephalosporine de troisieme generation avec chaine laterale R1 aminothiazolyl-methoxyimino differente des chaines laterales des penicillines. Reactivite croisee negligeable dans les meta-analyses publiees.";
      } else if (cephId === "cefepime") {
        tier = "lower-expected";
        rationaleEn = "Fourth-generation cephalosporin with distinct R1 side chain from penicillins. Cross-reactivity expected to be minimal.";
        rationaleFr = "Cephalosporine de quatrieme generation avec chaine laterale R1 distincte des penicillines. Reactivite croisee attendue minimale.";
      } else if (cephId === "cefuroxime") {
        tier = "lower-expected";
        rationaleEn = "Second-generation cephalosporin with different R1 side chain from penicillins. Negligible cross-reactivity in published data.";
        rationaleFr = "Cephalosporine de deuxieme generation avec chaine laterale R1 differente des penicillines. Reactivite croisee negligeable dans les donnees publiees.";
      } else {
        tier = "lower-expected";
        rationaleEn = "Different R1 side chain from penicillins. Cross-reactivity driven by side chain similarity, not the beta-lactam ring itself.";
        rationaleFr = "Chaine laterale R1 differente des penicillines. La reactivite croisee est determinee par la similarite des chaines laterales, pas par le cycle beta-lactame lui-meme.";
      }
      cephEntries.push({
        drugId: cephId,
        tier,
        structuralRelation: "structurally-distinct",
        rationale: { en: rationaleEn, fr: rationaleFr },
        sourceIds: [],
      });
    }

    if (cephEntries.length) {
      groups.push({
        groupName: { en: "Cephalosporins", fr: "Cephalosporines" },
        entries: cephEntries,
        suggestedPanel: [...cephalosporins],
      });
    }

    // Penicillin → Carbapenem group
    groups.push({
      groupName: { en: "Carbapenems", fr: "Carbapenemes" },
      entries: [...carbapenems].map((cId) => ({
        drugId: cId,
        tier: "lower-expected",
        structuralRelation: "structurally-distinct",
        rationale: {
          en: "Carbapenem ring differs from penicillin ring. Cross-reactivity rate below 1% in published meta-analyses of penicillin-allergic patients.",
          fr: "Le cycle carbapenem differe du cycle penicilline. Taux de reactivite croisee inferieur a 1% dans les meta-analyses publiees chez les patients allergiques aux penicillines.",
        },
        sourceIds: [],
      })),
      suggestedPanel: [...carbapenems],
    });

    // Penicillin → Aztreonam
    groups.push({
      groupName: { en: "Monobactams", fr: "Monobactames" },
      entries: [
        {
          drugId: "aztreonam",
          tier: "lower-expected",
          structuralRelation: "structurally-distinct",
          rationale: {
            en: "Monobactam with monocyclic ring structure entirely different from bicyclic penicillins. Cross-reactivity below 1% in penicillin-allergic patients.",
            fr: "Monobactame avec structure monocyclique entierement differente des penicillines bicycliques. Reactivite croisee inferieure a 1% chez les patients allergiques aux penicillines.",
          },
          sourceIds: [],
        },
      ],
      suggestedPanel: ["aztreonam"],
    });

    // Penicillin → other penicillins
    const otherPenicillins = [...penicillins].filter((id) => id !== fromId);
    if (otherPenicillins.length) {
      groups.push({
        groupName: { en: "Penicillins", fr: "Penicillines" },
        entries: otherPenicillins.map((pId) => ({
          drugId: pId,
          tier: "higher-concern",
          structuralRelation: "structurally-related",
          rationale: {
            en: "Same penicillin class sharing the 6-aminopenicillanic acid core. High cross-reactivity expected within the penicillin group.",
            fr: "Meme classe penicilline partageant le noyau acide 6-aminopenicillanique. Reactivite croisee elevee attendue au sein du groupe penicilline.",
          },
          sourceIds: [],
        })),
        suggestedPanel: otherPenicillins,
      });
    }
  }

  if (cephalosporins.has(fromId)) {
    // Cephalosporin → Penicillins
    groups.push({
      groupName: { en: "Penicillins", fr: "Penicillines" },
      entries: [...penicillins].map((pId) => ({
        drugId: pId,
        tier: "lower-expected",
        structuralRelation: "structurally-distinct",
        rationale: {
          en: "Cross-reactivity between cephalosporins and penicillins is driven by R1 side chain similarity, not the beta-lactam ring. Published rate: approximately 2-5% with dissimilar side chains.",
          fr: "La reactivite croisee entre cephalosporines et penicillines est determinee par la similarite des chaines laterales R1, pas par le cycle beta-lactame. Taux publie: environ 2-5% avec des chaines laterales dissimilaires.",
        },
        sourceIds: [],
      })),
      suggestedPanel: [...penicillins],
    });

    // Cephalosporin → other cephalosporins
    const otherCephs = [...cephalosporins].filter((id) => id !== fromId);
    const cephEntries = otherCephs.map((cId) => {
      let tier, rationaleEn, rationaleFr;

      // Cefotaxime ↔ ceftriaxone: identical R1
      if (
        (fromId === "cefotaxime" && cId === "ceftriaxone") ||
        (fromId === "ceftriaxone" && cId === "cefotaxime")
      ) {
        tier = "higher-concern";
        rationaleEn = "Identical aminothiazolyl-methoxyimino R1 side chain. Higher concern for cross-reactivity due to shared epitope structure.";
        rationaleFr = "Chaine laterale R1 aminothiazolyl-methoxyimino identique. Preoccupation plus elevee de reactivite croisee en raison de l'epitope partage.";
      } else {
        tier = "uncertain";
        rationaleEn = "Different R1 side chains within the cephalosporin class. Cross-reactivity pattern depends on specific side chain similarity; limited data for this pair.";
        rationaleFr = "Chaines laterales R1 differentes au sein de la classe des cephalosporines. Le profil de reactivite croisee depend de la similarite specifique des chaines laterales; donnees limitees pour cette paire.";
      }
      return {
        drugId: cId,
        tier,
        structuralRelation: "structurally-related",
        rationale: { en: rationaleEn, fr: rationaleFr },
        sourceIds: [],
      };
    });

    if (cephEntries.length) {
      groups.push({
        groupName: { en: "Cephalosporins", fr: "Cephalosporines" },
        entries: cephEntries,
        suggestedPanel: otherCephs,
      });
    }

    // Special: ceftazidime ↔ aztreonam
    if (fromId === "ceftazidime") {
      groups.push({
        groupName: { en: "Monobactams", fr: "Monobactames" },
        entries: [
          {
            drugId: "aztreonam",
            tier: "higher-concern",
            structuralRelation: "structurally-related",
            rationale: {
              en: "Identical acyl side chain confirmed by monoclonal antibody studies. Documented clinical cross-reactivity between ceftazidime and aztreonam.",
              fr: "Chaine laterale acyle identique confirmee par des etudes d'anticorps monoclonaux. Reactivite croisee clinique documentee entre ceftazidime et aztreonam.",
            },
            sourceIds: [],
          },
        ],
        suggestedPanel: ["aztreonam"],
      });
    }

    // Cephalosporin → Carbapenems
    groups.push({
      groupName: { en: "Carbapenems", fr: "Carbapenemes" },
      entries: [...carbapenems].map((cId) => ({
        drugId: cId,
        tier: "lower-expected",
        structuralRelation: "structurally-distinct",
        rationale: {
          en: "Carbapenem ring structure differs from cephalosporin ring. Cross-reactivity rate is very low in cephalosporin-allergic patients.",
          fr: "La structure du cycle carbapenem differe du cycle cephalosporine. Le taux de reactivite croisee est tres faible chez les patients allergiques aux cephalosporines.",
        },
        sourceIds: [],
      })),
      suggestedPanel: [...carbapenems],
    });
  }

  if (carbapenems.has(fromId)) {
    // Carbapenem → other carbapenems
    const otherCarbs = [...carbapenems].filter((id) => id !== fromId);
    if (otherCarbs.length) {
      groups.push({
        groupName: { en: "Carbapenems", fr: "Carbapenemes" },
        entries: otherCarbs.map((cId) => ({
          drugId: cId,
          tier: "uncertain",
          structuralRelation: "structurally-related",
          rationale: {
            en: "Same carbapenem class sharing the bicyclic ring structure. Limited published data on intra-class cross-reactivity between specific carbapenems.",
            fr: "Meme classe carbapenem partageant la structure bicyclique. Donnees publiees limitees sur la reactivite croisee intra-classe entre carbapenemes specifiques.",
          },
          sourceIds: [],
        })),
        suggestedPanel: otherCarbs,
      });
    }

    // Carbapenem → Penicillins
    groups.push({
      groupName: { en: "Penicillins", fr: "Penicillines" },
      entries: [...penicillins].map((pId) => ({
        drugId: pId,
        tier: "lower-expected",
        structuralRelation: "structurally-distinct",
        rationale: {
          en: "Different ring structure from penicillins. Cross-reactivity rate below 1% in published studies of penicillin-allergic patients receiving carbapenems.",
          fr: "Structure cyclique differente des penicillines. Taux de reactivite croisee inferieur a 1% dans les etudes publiees de patients allergiques aux penicillines recevant des carbapenemes.",
        },
        sourceIds: [],
      })),
      suggestedPanel: [...penicillins],
    });
  }

  if (fromId === "aztreonam") {
    groups.push({
      groupName: { en: "Cephalosporins", fr: "Cephalosporines" },
      entries: [
        {
          drugId: "ceftazidime",
          tier: "higher-concern",
          structuralRelation: "structurally-related",
          rationale: {
            en: "Identical acyl side chain confirmed by monoclonal antibody studies. Documented clinical cross-reactivity between aztreonam and ceftazidime.",
            fr: "Chaine laterale acyle identique confirmee par des etudes d'anticorps monoclonaux. Reactivite croisee clinique documentee entre aztreonam et ceftazidime.",
          },
          sourceIds: [],
        },
      ],
      suggestedPanel: ["ceftazidime"],
    });

    groups.push({
      groupName: { en: "Penicillins", fr: "Penicillines" },
      entries: [...penicillins].map((pId) => ({
        drugId: pId,
        tier: "lower-expected",
        structuralRelation: "structurally-distinct",
        rationale: {
          en: "Monobactam with monocyclic structure entirely different from bicyclic penicillins. Cross-reactivity below 1% in penicillin-allergic patients.",
          fr: "Monobactame avec structure monocyclique entierement differente des penicillines bicycliques. Reactivite croisee inferieure a 1% chez les patients allergiques aux penicillines.",
        },
        sourceIds: [],
      })),
      suggestedPanel: [...penicillins],
    });
  }

  return groups;
}

// ─── Local Anesthetic Cross-Reactivity ───────────────────────────────────────

const amideLAs = new Set(["lidocaine", "bupivacaine", "ropivacaine", "mepivacaine", "articaine", "prilocaine", "levobupivacaine"]);
const esterLAs = new Set(["chloroprocaine"]);

function localAnestheticGroups(fromId) {
  const groups = [];

  if (amideLAs.has(fromId)) {
    const otherAmides = [...amideLAs].filter((id) => id !== fromId);

    const entries = otherAmides.map((toId) => {
      let tier, rationaleEn, rationaleFr;

      // Bupivacaine ↔ Levobupivacaine (enantiomers)
      if (
        (fromId === "bupivacaine" && toId === "levobupivacaine") ||
        (fromId === "levobupivacaine" && toId === "bupivacaine")
      ) {
        tier = "higher-concern";
        rationaleEn = "Levobupivacaine is the S-enantiomer of bupivacaine; essentially identical molecular structure. Cross-reactivity is expected.";
        rationaleFr = "La levobupivacaine est l'enantiomere S de la bupivacaine; structure moleculaire essentiellement identique. La reactivite croisee est attendue.";
      }
      // Bupivacaine ↔ Ropivacaine (both pipecoloxylidides)
      else if (
        (fromId === "bupivacaine" && toId === "ropivacaine") ||
        (fromId === "ropivacaine" && toId === "bupivacaine") ||
        (fromId === "levobupivacaine" && toId === "ropivacaine") ||
        (fromId === "ropivacaine" && toId === "levobupivacaine")
      ) {
        tier = "higher-concern";
        rationaleEn = "Both pipecoloxylidide local anesthetics with very similar molecular structure. Higher concern for cross-reactivity within this subgroup.";
        rationaleFr = "Les deux sont des anesthesiques locaux pipecoloxylidides avec une structure moleculaire tres similaire. Preoccupation plus elevee de reactivite croisee au sein de ce sous-groupe.";
      }
      // Lidocaine ↔ Mepivacaine (xylidine ring)
      else if (
        (fromId === "lidocaine" && toId === "mepivacaine") ||
        (fromId === "mepivacaine" && toId === "lidocaine")
      ) {
        tier = "higher-concern";
        rationaleEn = "Both share a xylidine ring structure. Confirmed cross-reactivity in published case reports.";
        rationaleFr = "Les deux partagent une structure de cycle xylidine. Reactivite croisee confirmee dans des cas rapportes publies.";
      }
      // Lidocaine ↔ Prilocaine (xylidine/toluidine)
      else if (
        (fromId === "lidocaine" && toId === "prilocaine") ||
        (fromId === "prilocaine" && toId === "lidocaine")
      ) {
        tier = "higher-concern";
        rationaleEn = "Close structural homology (xylidine/toluidine ring). Published cross-reactivity between these agents.";
        rationaleFr = "Homologie structurelle etroite (cycle xylidine/toluidine). Reactivite croisee publiee entre ces agents.";
      }
      // Mepivacaine ↔ Prilocaine
      else if (
        (fromId === "mepivacaine" && toId === "prilocaine") ||
        (fromId === "prilocaine" && toId === "mepivacaine")
      ) {
        tier = "uncertain";
        rationaleEn = "Both amide-type local anesthetics with similar aromatic ring structures. Cross-reactivity is selective within the amide class; limited data for this specific pair.";
        rationaleFr = "Les deux sont des anesthesiques locaux de type amide avec des structures de cycles aromatiques similaires. La reactivite croisee est selective au sein de la classe amide; donnees limitees pour cette paire specifique.";
      }
      // Anything ↔ Articaine (often tolerated)
      else if (toId === "articaine" || fromId === "articaine") {
        tier = "lower-expected";
        rationaleEn = "Articaine has a unique thiophene ring differing from the xylidine structure of other amides. Often tolerated in patients allergic to other amide local anesthetics.";
        rationaleFr = "L'articaine possede un cycle thiophene unique different de la structure xylidine des autres amides. Souvent toleree chez les patients allergiques a d'autres anesthesiques locaux de type amide.";
      }
      // General amide ↔ amide
      else {
        tier = "uncertain";
        rationaleEn = "Both amide-type local anesthetics. Cross-reactivity within the amide class is selective and not universal; some patients tolerate structurally different amides.";
        rationaleFr = "Les deux sont des anesthesiques locaux de type amide. La reactivite croisee au sein de la classe amide est selective et non universelle; certains patients tolerent des amides structurellement differents.";
      }

      return {
        drugId: toId,
        tier,
        structuralRelation: "structurally-related",
        rationale: { en: rationaleEn, fr: rationaleFr },
        sourceIds: [],
      };
    });

    // Add ester class
    for (const esterId of esterLAs) {
      entries.push({
        drugId: esterId,
        tier: "lower-expected",
        structuralRelation: "structurally-distinct",
        rationale: {
          en: "Ester-type local anesthetic with entirely different metabolic pathway (plasma cholinesterase) from amide agents (hepatic metabolism). No expected cross-reactivity between amide and ester classes.",
          fr: "Anesthesique local de type ester avec une voie metabolique entierement differente (cholinesterase plasmatique) des agents amides (metabolisme hepatique). Aucune reactivite croisee attendue entre les classes amide et ester.",
        },
        sourceIds: [],
      });
    }

    groups.push({
      groupName: { en: "Local Anesthetics", fr: "Anesthesiques locaux" },
      entries,
      suggestedPanel: [...amideLAs, ...esterLAs].filter((id) => id !== fromId),
    });
  }

  if (esterLAs.has(fromId)) {
    const entries = [...amideLAs].map((amideId) => ({
      drugId: amideId,
      tier: "lower-expected",
      structuralRelation: "structurally-distinct",
      rationale: {
        en: "Amide-type local anesthetic with different metabolic pathway (hepatic) from ester agents (plasma cholinesterase). No expected cross-reactivity between ester and amide classes.",
        fr: "Anesthesique local de type amide avec une voie metabolique differente (hepatique) des agents esters (cholinesterase plasmatique). Aucune reactivite croisee attendue entre les classes ester et amide.",
      },
      sourceIds: [],
    }));

    groups.push({
      groupName: { en: "Local Anesthetics", fr: "Anesthesiques locaux" },
      entries,
      suggestedPanel: [...amideLAs],
    });
  }

  return groups;
}

// ─── Opioid Cross-Reactivity ─────────────────────────────────────────────────

const phenylpiperidines = new Set(["fentanyl", "alfentanil", "remifentanil", "sufentanil"]);
const phenanthrenes = new Set(["morphine", "oxycodone"]);
const otherOpioids = new Set(["tramadol", "nefopam"]);

function opioidGroups(fromId) {
  const groups = [];
  const isPP = phenylpiperidines.has(fromId);
  const isPhen = phenanthrenes.has(fromId);
  const isOther = otherOpioids.has(fromId);

  if (isPP) {
    // Same class
    const otherPPs = [...phenylpiperidines].filter((id) => id !== fromId);
    groups.push({
      groupName: { en: "Phenylpiperidine Opioids", fr: "Opioides phenylpiperidines" },
      entries: otherPPs.map((toId) => ({
        drugId: toId,
        tier: "higher-concern",
        structuralRelation: "structurally-related",
        rationale: {
          en: "Same phenylpiperidine class sharing the core piperidine ring and phenethyl group. True IgE-mediated allergy is exceedingly rare but structural similarity warrants evaluation.",
          fr: "Meme classe phenylpiperidine partageant le cycle piperidine central et le groupe phenethyle. L'allergie reelle mediee par les IgE est extremement rare mais la similarite structurelle justifie une evaluation.",
        },
        sourceIds: [],
      })),
      suggestedPanel: otherPPs,
    });

    // Cross-class: phenanthrenes
    groups.push({
      groupName: { en: "Phenanthrene Opioids", fr: "Opioides phenanthrenes" },
      entries: [...phenanthrenes].map((toId) => ({
        drugId: toId,
        tier: "lower-expected",
        structuralRelation: "structurally-distinct",
        rationale: {
          en: "Different structural class (phenanthrene vs phenylpiperidine). 0% cross-reactivity between opioid classes in published studies. Phenanthrenes activate MRGPRX2 (pseudo-allergy) while phenylpiperidines do not.",
          fr: "Classe structurelle differente (phenanthrene vs phenylpiperidine). 0% de reactivite croisee entre classes d'opioides dans les etudes publiees. Les phenanthrenes activent MRGPRX2 (pseudo-allergie) tandis que les phenylpiperidines ne le font pas.",
        },
        sourceIds: [],
      })),
      suggestedPanel: [...phenanthrenes],
    });
  }

  if (isPhen) {
    // Same class
    const otherPhens = [...phenanthrenes].filter((id) => id !== fromId);
    if (otherPhens.length) {
      groups.push({
        groupName: { en: "Phenanthrene Opioids", fr: "Opioides phenanthrenes" },
        entries: otherPhens.map((toId) => ({
          drugId: toId,
          tier: "higher-concern",
          structuralRelation: "structurally-related",
          rationale: {
            en: "Same phenanthrene class sharing the core ring structure. Both are MRGPRX2 activators causing direct histamine release (pseudo-allergic mechanism). Caution if prior reaction to a phenanthrene opioid.",
            fr: "Meme classe phenanthrene partageant la structure cyclique centrale. Les deux activent MRGPRX2 causant une liberation directe d'histamine (mecanisme pseudo-allergique). Prudence si reaction anterieure a un opioide phenanthrene.",
          },
          sourceIds: [],
        })),
        suggestedPanel: otherPhens,
      });
    }

    // Cross-class: phenylpiperidines
    groups.push({
      groupName: { en: "Phenylpiperidine Opioids", fr: "Opioides phenylpiperidines" },
      entries: [...phenylpiperidines].map((toId) => ({
        drugId: toId,
        tier: "lower-expected",
        structuralRelation: "structurally-distinct",
        rationale: {
          en: "Different structural class. Phenylpiperidines do not activate MRGPRX2 and do not cause histamine release. 0% cross-reactivity between opioid classes in published re-exposure studies.",
          fr: "Classe structurelle differente. Les phenylpiperidines n'activent pas MRGPRX2 et ne provoquent pas de liberation d'histamine. 0% de reactivite croisee entre classes d'opioides dans les etudes de re-exposition publiees.",
        },
        sourceIds: [],
      })),
      suggestedPanel: [...phenylpiperidines],
    });
  }

  if (isOther) {
    // Tramadol/nefopam → everything else is lower-expected
    const allOthers = [...phenylpiperidines, ...phenanthrenes].filter((id) => id !== fromId);
    groups.push({
      groupName: { en: "Opioids & Analgesics", fr: "Opioides & Antalgiques" },
      entries: allOthers.map((toId) => ({
        drugId: toId,
        tier: "lower-expected",
        structuralRelation: "structurally-distinct",
        rationale: {
          en: `Completely different chemical class from ${fromId === "tramadol" ? "cyclohexanol derivatives" : "benzoxazocine derivatives"}. No structural basis for cross-reactivity.`,
          fr: `Classe chimique completement differente des ${fromId === "tramadol" ? "derives du cyclohexanol" : "derives de la benzoxazocine"}. Aucune base structurelle pour une reactivite croisee.`,
        },
        sourceIds: [],
      })),
      suggestedPanel: allOthers,
    });
  }

  return groups;
}

// ─── Dye Cross-Reactivity ────────────────────────────────────────────────────

function dyeGroups(fromId) {
  if (fromId === "bleu-patente-v") {
    return [
      {
        groupName: { en: "Surgical Dyes", fr: "Colorants chirurgicaux" },
        entries: [
          {
            drugId: "bleu-de-methylene",
            tier: "higher-concern",
            structuralRelation: "structurally-related",
            rationale: {
              en: "Both are aromatic dyes with shared ring epitopes. Confirmed cross-reactivity on skin testing in multiple published case reports.",
              fr: "Les deux sont des colorants aromatiques avec des epitopes cycliques partages. Reactivite croisee confirmee aux tests cutanes dans de multiples cas rapportes publies.",
            },
            sourceIds: [],
          },
        ],
        suggestedPanel: ["bleu-de-methylene"],
      },
    ];
  }

  if (fromId === "bleu-de-methylene") {
    return [
      {
        groupName: { en: "Surgical Dyes", fr: "Colorants chirurgicaux" },
        entries: [
          {
            drugId: "bleu-patente-v",
            tier: "higher-concern",
            structuralRelation: "structurally-related",
            rationale: {
              en: "Both are aromatic dyes with shared ring epitopes. Cross-sensitization documented in multiple case reports with positive skin tests.",
              fr: "Les deux sont des colorants aromatiques avec des epitopes cycliques partages. Sensibilisation croisee documentee dans de multiples cas rapportes avec tests cutanes positifs.",
            },
            sourceIds: [],
          },
        ],
        suggestedPanel: ["bleu-patente-v"],
      },
    ];
  }

  return [];
}

// ─── Apply All Cross-Reactivity ──────────────────────────────────────────────

const nmbaDrugs = ["rocuronium", "vecuronium", "pancuronium", "cisatracurium", "atracurium", "mivacurium", "succinylcholine"];
const blDrugs = [...penicillins, ...cephalosporins, ...carbapenems, "aztreonam"];
const laDrugs = [...amideLAs, ...esterLAs];
const opioidDrugs = [...phenylpiperidines, ...phenanthrenes, ...otherOpioids];
const dyeDrugs = ["bleu-patente-v", "bleu-de-methylene"];

for (const drug of dataset.drugs) {
  const groups = [];

  if (nmbaDrugs.includes(drug.id)) {
    groups.push(nmbaGroup(drug.id));
  }
  if (blDrugs.includes(drug.id)) {
    groups.push(...betaLactamGroups(drug.id));
  }
  if (laDrugs.includes(drug.id)) {
    groups.push(...localAnestheticGroups(drug.id));
  }
  if (opioidDrugs.includes(drug.id)) {
    groups.push(...opioidGroups(drug.id));
  }
  if (dyeDrugs.includes(drug.id)) {
    groups.push(...dyeGroups(drug.id));
  }

  if (groups.length > 0) {
    // Filter out entries referencing drugs not in dataset
    for (const group of groups) {
      group.entries = group.entries.filter((e) => drugIds.has(e.drugId));
      group.suggestedPanel = group.suggestedPanel.filter((id) => drugIds.has(id));
    }
    drug.crossReactivity = groups.filter((g) => g.entries.length > 0);
  } else {
    delete drug.crossReactivity;
  }
}

// ─── Write Output ────────────────────────────────────────────────────────────

const datasetJson = `${JSON.stringify(dataset, null, 2)}\n`;
const checksum = createHash("sha256").update(datasetJson).digest("hex");

writeFileSync(datasetPath, datasetJson);

manifest.checksum = checksum;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const drugsWithCR = dataset.drugs.filter((d) => d.crossReactivity?.length > 0);
const totalEntries = drugsWithCR.reduce(
  (sum, d) => sum + d.crossReactivity.reduce((s, g) => s + g.entries.length, 0),
  0
);

console.log(`Cross-reactivity data seeded for ${drugsWithCR.length} drugs (${totalEntries} total entries).`);
console.log(`Updated checksum: ${checksum}`);
