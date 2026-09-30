# BICCS code selection review: Brugada, DCM, thoracic aortic aneurysm, cardiac amyloidosis

Prepared 2026-09-30 from the live Code Consensus database (project BICCS, `a7b57b02-fbef-4450-a3b5-857eba721922`). The SNOMED CT hierarchy was checked against the International Edition RF2 snapshot of 2026-03-01, the same release loaded into the app.

## Summary

| Phenotype | Mapped SCTID | Raters | Candidate codes found | Selected | Consensus | ICD-10 in consensus |
|---|---|---|---|---|---|---|
| Brugada syndrome | 418818005 | 1 | 6 (SNOMED only) | 2 | 2 | none; no specific code exists |
| Dilated cardiomyopathy | 399020009 | 1 | 52 | 6 | 2 | I42.0 |
| Aneurysm of thoracic aorta | 433068007 | 1 | 189 | 74 | 1 | none |
| Cardiac amyloidosis | 1382129000 | 2 | 93 | 8 | 1 | none |

The main problems:

1. **ICD-10 cannot represent two of the four conditions.** Brugada syndrome and cardiac amyloidosis have no specific ICD-10 code (WHO, UK or CM). The nearest codes are either residual categories (I49.8) or need a dagger/asterisk pair (E85.x + I43.1). Any linkage to HES or other ICD-10 sources will be non-specific or incomplete.
2. **Two SNOMED mappings are broader or narrower than the BICCS data field.**
   - 399020009 is *Congestive cardiomyopathy* in its FSN. Its 64 descendants include ischaemic, alcoholic, drug-induced, peripartum, infective and infiltrative cardiomyopathy.
   - 1382129000 is *Cardiac organ-limited amyloidosis*. It was introduced in January 2026, has no descendants, and is not a parent of wild-type or hereditary ATTR amyloidosis. The BICCS field it stands for is "TTR amyloidosis".
3. **Selections are non-specific**, especially for thoracic aortic aneurysm, where they include:
   - procedures (16 codes), "history of" codes (3), an abdominal aortic embolism code, and *Aneurysm of descending aorta*, whose children include abdominal aortic aneurysm;
   - the whole ICD-10 I71 block (dissection and abdominal aneurysm included).
4. **Coverage gaps from text search.**
   - The amyloid search term `amyloidosis` missed *Transthyretin related familial amyloid cardiomyopathy* and *Danish type familial amyloid cardiomyopathy*.
   - The DCM phrase search missed 14 of 64 SNOMED descendants, including *Nonischemic congestive cardiomyopathy*.
   - The aneurysm search terms miss all aortic dilatation/ectasia concepts.
5. **The consensus has not really been reached.** Three of the four phenotypes have a single rater, so there is no agreement data. The thoracic aneurysm consensus is one code, while 74 codes are selected.
6. **Tooling limitations affect all four phenotypes** (section 5):
   - SNOMED is stored as a single-parent tree;
   - inactive SNOMED concepts and the UK Edition are absent;
   - shared ICD-10 codes are labelled only as ICD-10-UKBB;
   - OPCS was not searched, even though SNOMED procedure codes were selected.

## 1. Brugada syndrome

**Search terms:** SCTID `418818005`; regex `brugada` on descriptions (ICD-10-UKBB, SNOMED, ICD-10-CM, ICD-10-WHO).

**Found:** 6 SNOMED codes and no ICD codes. **Consensus:** 418818005 *Brugada syndrome* (canonical), 789693005 *Acquired Brugada syndrome*.

Problems:

- **No ICD-10 code.** No ICD-10 description contains "Brugada", so the search returned nothing. In practice Brugada is coded as I49.8 *Other specified cardiac arrhythmias*, a residual category shared with many unrelated rhythm disorders. An ICD-10 definition would have a very low positive predictive value, and the list currently has no ICD-10 entry at all. ICD-11 has a specific entity, which does not help with HES.
- **Acquired Brugada is in the consensus.** 789693005 is not a child of 418818005 in SNOMED; its only parent is *Cardiac channelopathy*. It describes drug- or fever-induced Brugada, which is not an inherited condition. It should either be removed or kept as a deliberate decision, with a note explaining why.
- **ECG pattern codes need a decision.** *Spontaneous Brugada ECG pattern* (1208874001), *Provoked Brugada ECG pattern* (1208851000) and *Brugada ECG pattern* (1204168008) were found but not selected. A spontaneous type 1 pattern is a common reason for ICC referral without a formal diagnosis. The team should decide whether "referral indication" includes the pattern as well as the syndrome.
- 418818005 has no descendants in SNOMED, so the SNOMED side is complete at concept level. Sensitivity therefore depends on clinicians choosing that one concept.

## 2. Dilated cardiomyopathy

**Search terms:** SCTID `399020009`; phrase `dilated cardiomyopathy` on descriptions (ICD-10-UKBB, SNOMED, ICD-10-WHO, ICD-10-CM).

**Found:** 51 SNOMED codes and 1 ICD-10 code. **Selected:** I42.0, 399020009, 195021004 *Primary dilated cardiomyopathy*, 52029003 *Primary familial DCM*, 53043001 *Primary idiopathic DCM*, 766883006 *Familial DCM with conduction defect due to LMNA mutation*. **Consensus:** I42.0 and 399020009, both canonical.

Problems:

- **The mapped concept is broad.** The FSN of 399020009 is *Congestive cardiomyopathy (disorder)*. It has 64 descendants in the 2026-03 International release, and most describe acquired or secondary disease rather than an inherited condition, for example:
  - *Ischemic congestive cardiomyopathy* and *Ischemic dilated cardiomyopathy due to coronary artery disease*;
  - DCM caused by ethanol, drugs, anthracycline or ionizing radiation;
  - *Dilated peripartum cardiomyopathy*;
  - DCM due to viral, bacterial, fungal, protozoan or parasitic myocarditis, sarcoidosis, SLE, rheumatoid arthritis, malignancy or nutritional deficiency.

  If a downstream user expands the canonical code to its descendants, which is the usual way SNOMED code lists are applied, the phenotype stops being specific to ICC referrals. If they use the code alone, it misses the primary and familial subtypes. The consensus should list the specific concepts wanted and say explicitly that descendants must not be expanded.
- **ICD-10 I42.0 cannot separate familial or idiopathic DCM from other causes.** I42.0 covers *Dilated cardiomyopathy* and congestive cardiomyopathy NOS. Several secondary forms have their own codes (I42.6 alcoholic, I42.7 drug-induced, I43.x in other diseases, O90.3 peripartum, I25.5 ischaemic), but coding practice is inconsistent. No ICD-10 code identifies familial or genetic DCM.
- **The search missed descendants without the phrase.** 14 of the 64 descendants were not found because their descriptions do not contain "dilated cardiomyopathy". They include 111000119104 *Nonischemic congestive cardiomyopathy*, 699668009 *Secondary nonischemic congestive cardiomyopathy*, 233871002 *Congestive obstructive cardiomyopathy* and several syndromic cardiomyopathies (Vici syndrome, microcephalus cardiomyopathy syndrome and others).
- **Relevant concepts were found but not selected:**
  - 471890009 *Dilated cardiomyopathy with genetic marker*, which is highly relevant to an ICC cohort;
  - 702424003 *Dilated cardiomyopathy 3B*, a dystrophin-related form that may belong under "Cardiomyopathy due to neuromuscular disorder" instead;
  - these need an explicit include or exclude.
- **Adjacent phenotype not mapped.** The BICCS mapping workbook has no SNOMED concept for "Non dilated LV cardiomyopathy". Patients with that label will be recorded either under DCM codes or not at all.

## 3. Aneurysm of thoracic aorta

**Search terms:** SCTID `433068007`; regex `aneurysm.*aort.*` and `aort.*aneurysm` on descriptions (ICD-10-UKBB, SNOMED, ICD-10-CM, ICD-10-WHO).

**Found:** 155 SNOMED, 24 ICD-10-CM and 10 ICD-10-UKBB codes. **Selected:** 54 SNOMED, 15 ICD-10-CM and 5 ICD-10-UKBB. **Consensus:** 433068007 only; nothing marked canonical.

Problems:

- **Many selected SNOMED codes are procedures or history codes rather than diagnoses.** Of the 54 selected SNOMED codes, 25 are not descendants of 433068007:
  - 16 are procedures: aneurysmectomy, open and endovascular repair, and emergency replacement of an aneurysmal segment;
  - 3 are "History of ..." codes;
  - 1208822004 *Arterial obstruction due to thrombotic embolism from aneurysm of **abdominal** aorta* is a clear error;
  - 426948001 *Aneurysm of descending aorta* is a parent of *Abdominal aortic aneurysm*, so expanding it pulls in AAA;
  - thoracoabdominal aneurysm codes (233984007, 195265003), which are defensible but should be a documented decision.

  Procedure codes are a proxy (a repaired aneurysm) and belong in a separate, labelled procedure list. Otherwise they should be matched with OPCS-4, which was not searched.
- **Non-specific ICD-10.** `I71*` *Aortic aneurysm and dissection* was selected in ICD-10-UKBB. It covers I71.0 dissection, I71.3/I71.4 abdominal aneurysm and I71.8/I71.9 unspecified site. Only I71.1, I71.2 and, if intended, I71.5 and I71.6 should be kept. ICD-10 (WHO/UK) also cannot separate the aortic root, ascending aorta and arch; only ICD-10-CM has site-level codes (I71.11–I71.23).
- **Dilatation and ectasia are not captured.** Many ICC aortopathy referrals describe a dilated aortic root rather than an "aneurysm". None of the following were found by the search terms:
  - SNOMED *Aortic root dilatation* (251036003), *Ascending aorta dilatation* (253645007), *Acquired dilatation of ascending aorta and aortic root* (871665004), *Ectasia of thoracic aorta* (142111000119108), *Congenital dilatation of aortic root* (7991000119102);
  - ICD-10-CM I77.810 *Thoracic aortic ectasia*;
  - UK ICD-10 I77.8 (not searched).
- **Sinus of Valsalva aneurysms need a decision.** 16 of the 28 selected descendants are sinus of Valsalva aneurysm variants, mostly congenital or with rupture into a cardiac chamber. These are true SNOMED descendants but are clinically distinct from heritable thoracic aortic disease. The one descendant missed by the search was 54160000 *Congenital aneurysm of sinus of Valsalva*.
- **Overlap with other BICCS phenotypes.** *X-linked severe syndromic TAAD* (1373745005) and *Aortic aneurysm due to Loeys-Dietz syndrome* (838364007) overlap with the separate "Familial thoracic aortic aneurysm and aortic dissection" phenotype. The team should decide which phenotype owns syndromic aortopathy codes.
- **Consensus not done.** With 74 selected codes and a one-code consensus, the exported list currently contains only 433068007.

## 4. Cardiac amyloidosis

**Search terms:** SCTID `1382129000`; regex `amyloidosis` on descriptions (ICD-10-UKBB, SNOMED, ICD-10-CM, ICD-10-WHO).

**Found:** 80 SNOMED, 10 ICD-10-UKBB and 3 ICD-10-CM codes. **Selected:**
- 1382129000;
- *Hereditary ATTR amyloidosis* (1354544003), *Wild type ATTR amyloidosis* (237877004);
- *Familial non-neuropathic amyloidosis of heart* (1187147003), *Localized hereditary amyloidosis of heart* (1187149000);
- *DCM due to amyloidosis* (58629009), *Restrictive cardiomyopathy secondary to amyloidosis* (79754008);
- ICD-10-CM E85.82.

**Consensus:** 1382129000 only (canonical).

Problems:

- **The mapped concept does not match the BICCS field.** The field is "TTR amyloidosis". 1382129000 is *Cardiac organ-limited amyloidosis* (FSN), with parents *Amyloidosis* and *Structural disorder of heart*. It has no descendants and does not subsume either form of ATTR:
  - wild-type ATTR (237877004) sits under *Age-related* and *Systemic amyloidosis*;
  - hereditary ATTR (1354544003) sits under *Hereditary* and *Systemic amyloidosis*.

  ATTR cardiac amyloidosis is systemic, so an "organ-limited" concept is arguably the wrong target. It also does not separate ATTR from AL or AA. The consensus therefore contains a single code that will miss most TTR cases.
- **The mapped concept is very new.** 1382129000 first appeared in the 2026-01-01 International release. The concept it probably replaces, 16573007 *Senile cardiac amyloidosis*, was inactivated on the same date with POSSIBLY_EQUIVALENT_TO associations to 1382129000 and 1354544003. Earlier, 442012008 *Amyloidogenic transthyretin amyloidosis* was inactivated in 2020 and REPLACED_BY 237877004. Records made before these dates will carry the inactive codes, and the app cannot offer them because only active concepts are loaded.
- **The text search missed the most specific concepts.** The term `amyloidosis` does not match descriptions that say "amyloid cardiomyopathy". Two concepts were never found: 715655000 *Transthyretin related familial amyloid cardiomyopathy* and 27097002 *Danish type familial amyloid cardiomyopathy*, the latter a TTR variant. 715655000 is the most precise concept available for hereditary ATTR cardiomyopathy.
- **No ICD-10 code for cardiac amyloidosis, and none selected.** ICD-10 (WHO/UK) records amyloidosis by type:
  - E85.0–E85.2 heredofamilial;
  - E85.4 organ-limited;
  - E85.8 other, used in the UK for wild-type ATTR;
  - E85.9 unspecified.

  Cardiac involvement is shown only by the asterisk code I43.1 *Cardiomyopathy in metabolic diseases*. A cardiac amyloid phenotype in HES therefore needs a code pair, which a flat code list cannot express. None of the 10 ICD-10-UKBB codes found were selected, so the list currently has no UK ICD-10 coverage.
- **Borderline codes need an explicit decision:** *DCM due to amyloidosis* and *Restrictive cardiomyopathy secondary to amyloidosis* (type not specified, so they include AL and AA), and *Cardiac secondary systemic amyloidosis* (1187540008, AA type; found and correctly not selected).
- **Overlap with other BICCS phenotypes.** "Hereditary ATTR amyloidosis" is also a separate BICCS phenotype, mapped to 1354544003. The two lists need clear boundaries. A reasonable split is: "Cardiac amyloidosis" = any ATTR cardiac amyloidosis (wild-type and hereditary); "Hereditary ATTR" = the hereditary subset.

## 5. Problems that affect all four phenotypes

1. **SNOMED is stored as a single-parent tree.**
   - `seed_db.py` keeps one primary parent per concept, but SNOMED is polyhierarchical. In the app's tree, *Brugada syndrome* and *Cardiac amyloidosis* have no children, *Aneurysm of thoracic aorta* has 2 (29 in SNOMED) and *Dilated cardiomyopathy* has 16 (64 in SNOMED).
   - Browsing the tree therefore under-represents each concept's subtree, and there is no "include descendants" (ECL `<<`) expansion.
   - Capture relies entirely on text search, which is why the DCM, amyloid and aortic lists miss concepts whose names don't match the search term.
2. **Inactive SNOMED concepts are not available.** Only active concepts from the 2026-03 International release are loaded. Historic records (NDRS, GP extracts) contain codes that have since been inactivated (see section 4). Without inactive concepts and their historical associations, lists built in the app will miss older records.
3. **UK Edition not loaded.** The SNOMED content is the International Edition. NHS and NDRS data use the UK Edition (Clinical and Drug extensions), so UK-only concepts cannot be found or selected. It is not known how many relevant UK-only concepts exist for these four conditions; this should be checked against the UK release.
4. **ICD-10 system labels are misleading.** ICD-10-UKBB, WHO and CM are merged into one tree, and a code shared by all three is stored once under ICD-10-UKBB. As a result:
   - ICD-10-WHO holds only 401 codes (mostly chapter/block headings);
   - I42.0 appears only as "ICD-10-UKBB I420", never as ICD-10-WHO or ICD-10-CM;
   - an export filtered by system looks as if the WHO and CM lists are missing core codes;
   - the new "one canonical code per coding system" rule cannot choose I42.0 as the ICD-10-CM canonical code.
5. **OPCS-4 not searched.** SNOMED procedure codes were selected for aortic aneurysm, but the OPCS-4 equivalents (L18, L19, L27.3, L28.3 thoracic subcodes) were not searched. This matters if the list is ever applied to HES procedures.
6. **Single rater.** Brugada, DCM and thoracic aneurysm have one rater each, and cardiac amyloidosis has two. Agreement statistics are not meaningful, and the "consensus" is one person's choice.

## 6. Recommendations

1. **Re-check the SCTID mappings against the BICCS field definitions:**
   - Cardiac amyloidosis: the field is "TTR amyloidosis". Map to 237877004 + 1354544003 / 715655000, or a set of ATTR cardiac concepts, not only 1382129000.
   - DCM: keep 399020009 as the label, but define the list as explicit primary/familial/genetic concepts and forbid descendant expansion.
2. **Record in each phenotype description whether descendants are included**, and make the export say so as well.
3. **Add search terms for missed wording:**
   - amyloid: `amyloid.*cardiomyopathy`, `transthyretin`, `ATTR`;
   - aorta: `dilat.*aort|aort.*dilat|ectasia`;
   - DCM: `nonischemic congestive`.
4. **Remove from the thoracic aneurysm list** the procedure, history and abdominal codes and the `I71*` parent. If procedure codes are wanted, put them in a separate procedure list with OPCS-4.
5. **Make explicit decisions on the borderline groups:** Acquired Brugada, Brugada ECG patterns, sinus of Valsalva aneurysms, thoracoabdominal aneurysm, and cardiomyopathy "due to amyloidosis".
6. **Document the ICD-10 limits:** Brugada has only I49.8, which is non-specific and should probably be excluded. Cardiac amyloidosis needs the E85.x + I43.1 pair. Report these as known limits of any HES-based definition, not as gaps in the list.
7. **Get a second rater** for Brugada, DCM and thoracic aneurysm before finalising.
8. **App changes worth considering:**
   - load the full SNOMED is-a graph and offer descendant expansion;
   - load inactive concepts with their historical associations;
   - load the UK Edition;
   - label shared ICD-10 codes by every system that contains them.

## Appendix A. Selected and consensus codes

C = consensus, K = canonical.

### Brugada syndrome
| System | Code | Description | Flags |
|---|---|---|---|
| SNOMED-CT | 418818005 | Brugada syndrome | C K |
| SNOMED-CT | 789693005 | Acquired Brugada syndrome | C |

### Dilated cardiomyopathy
| System | Code | Description | Flags |
|---|---|---|---|
| ICD-10-UKBB | I420 | Dilated cardiomyopathy | C K |
| SNOMED-CT | 399020009 | Dilated cardiomyopathy | C K |
| SNOMED-CT | 195021004 | Primary dilated cardiomyopathy | |
| SNOMED-CT | 52029003 | Primary familial dilated cardiomyopathy | |
| SNOMED-CT | 53043001 | Primary idiopathic dilated cardiomyopathy | |
| SNOMED-CT | 766883006 | Familial DCM with conduction defect due to LMNA mutation | |

### Cardiac amyloidosis
| System | Code | Description | Flags |
|---|---|---|---|
| SNOMED-CT | 1382129000 | Cardiac amyloidosis (FSN: Cardiac organ-limited amyloidosis) | C K |
| SNOMED-CT | 1354544003 | Hereditary ATTR amyloidosis | |
| SNOMED-CT | 237877004 | Wild type ATTR amyloidosis | |
| SNOMED-CT | 1187147003 | Cardiac familial non-neuropathic amyloidosis | |
| SNOMED-CT | 1187149000 | Localised hereditary cardiac amyloidosis | |
| SNOMED-CT | 58629009 | Dilated cardiomyopathy due to amyloidosis | |
| SNOMED-CT | 79754008 | Restrictive cardiomyopathy secondary to amyloidosis | |
| ICD-10-CM | E8582 | Wild-type transthyretin-related (ATTR) amyloidosis | |

### Aneurysm of thoracic aorta (74 selected; grouped)
| Group | Codes |
|---|---|
| Consensus | SNOMED 433068007 *Aneurysm of thoracic aorta* (C) |
| ICD-10-UKBB | I71\* (whole block), I711\*, I712\*, I715\*, I716\* |
| ICD-10-CM | I71.10–I71.13, I71.20–I71.23, I71.50–I71.52, I71.60–I71.62, Q25.43 |
| SNOMED diagnoses, descendants of 433068007 | 28 codes: aortic arch/root/ascending/descending thoracic aneurysm, ruptured and unruptured forms, 16 sinus of Valsalva variants, congenital aneurysm of ascending aorta, perforation due to aneurysm, X-linked syndromic TAAD |
| SNOMED diagnoses outside 433068007 | 426948001 Aneurysm of descending aorta; 233984007 / 195265003 thoracoabdominal aneurysm; 838364007 Loeys-Dietz aortic aneurysm; 1208818009 embolism from thoracic aneurysm; **1208822004 embolism from abdominal aneurysm** |
| SNOMED procedures | 19262003, 45874007, 50419005, 51993007, 61166008, 75533008, 82367000, 83538007, 9860001, 175298001, 175299009, 315362007, 429679003, 608873006, 699115002, 1259910000 |
| SNOMED history | 139301000119100, 59721000119100, 672261000119100 |

## Appendix B. Method

- **Database queries (read-only):** `phenotypes`, `phenotype_search_terms`, `user_code_selections` joined to `codes` and `code_systems`, for the four phenotype IDs.
- **SNOMED hierarchy:** descendants were computed from active IS-A relationships (116680003) in `sct2_Relationship_Snapshot_INT_20260301.txt`. FSNs, concept status and historical associations came from the matching description, concept and association refset snapshots.
- **UKB counts:** not included, because `code_counts` is currently empty in the live DB.
