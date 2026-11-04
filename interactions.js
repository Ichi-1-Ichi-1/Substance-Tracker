'use strict';
// Interaction rules by substance class. Based on established pharmacology (drug labels, regulatory
// warnings, harm-reduction combination charts). Not exhaustive.

// Extra reference entries (same row format as substances-db.js).
window.SUBSTANCE_DB.push(
  ['Moclobemid', 'med', 2, '1–2 Std.', ['Aurorix'], 'reversibler MAO-Hemmer'],
  ['Tranylcypromin', 'med', 2.5, '~2,5 Std. (Wirkung ~2 Wochen)', ['Jatrosom', 'Parnate'], 'irreversibler MAO-Hemmer'],
  ['Phenelzin', 'med', 11.6, '~12 Std. (Wirkung ~2 Wochen)', ['Nardil'], 'irreversibler MAO-Hemmer'],
  ['Selegilin', 'med', 10, '~10 Std. (Wirkung länger)', ['Movergan', 'Emsam'], 'MAO-B-Hemmer'],
  ['Linezolid', 'med', 5, '~5 Std.', ['Zyvoxid'], 'Antibiotikum mit MAO-Hemmung'],
  ['Ayahuasca', 'rec', 2.5, '1–3 Std. (Harmin/Harmalin)', ['Harmalin', 'Harmin', 'Steppenraute', 'Syrische Raute'], 'enthält MAO-Hemmer'],
  ['Johanniskraut', 'supp', 9, '~9 Std. (Hyperforin)', ["St. John's Wort", 'Laif', 'Hypericum'], 'senkt Spiegel vieler Medikamente'],
  ['Phenobarbital', 'med', 100, '53–118 Std.', ['Luminal'], 'Barbiturat'],
  ['Clomethiazol', 'med', 4, '~4 Std.', ['Distraneurin'], ''],
  ['Pethidin', 'med', 3.5, '3–4 Std.', ['Dolantin', 'Meperidin'], ''],
  ['Nitazene', 'rec', null, 'unklar (sehr potent)', ['Isotonitazen', 'Protonitazen', 'Metonitazen', 'Nitazen'], 'synthetische Opioide, oft in gefälschten Pillen'],
  ['Clomipramin', 'med', 32, '~32 Std.', ['Anafranil'], ''],
  ['Doxepin', 'med', 17, '~17 Std.', ['Aponal'], ''],
  ['Nortriptylin', 'med', 30, '~30 Std.', ['Nortrilen'], ''],
  ['Opipramol', 'med', 11, '~11 Std.', ['Insidon'], ''],
  ['Levomepromazin', 'med', 20, '15–30 Std.', ['Neurocil'], ''],
  ['Pipamperon', 'med', 17, '~17 Std.', ['Dipiperon'], ''],
  ['Chlorprothixen', 'med', 10, '8–12 Std.', ['Truxal'], ''],
  ['Esketamin', 'med', 9, '7–12 Std.', ['Spravato'], ''],
  ['Ritonavir', 'med', 4, '3–5 Std.', ['Norvir', 'Paxlovid'], 'starker CYP3A4-Hemmer'],
  ['Itraconazol', 'med', 30, '24–42 Std.', ['Sempera'], ''],
  ['Fluconazol', 'med', 30, '~30 Std.', ['Diflucan'], ''],
  ['Insulin (kurzwirksam)', 'med', 1, '~1 Std. (s.c. Wirkung 3–5 Std.)', ['Insulin', 'Humalog', 'Novorapid', 'Actrapid', 'Lispro', 'Aspart'], ''],
  ['Insulin glargin', 'med', 12, 'Wirkung ~24 Std.', ['Lantus', 'Toujeo', 'Glargin'], ''],
  ['3-MMC', 'rec', null, 'kurz (unsicher)', ['3MMC', 'Metaphedron'], ''],
  ['4-FA', 'rec', 8, '~8 Std. (unsicher)', ['4-FMP', '4-Fluoramphetamin'], ''],
  ['2C-B', 'rec', null, 'unklar (Wirkung 4–6 Std.)', ['2CB', 'Nexus'], ''],
  ['2-FDCK', 'rec', null, 'unklar', ['Fluorexetamin', '2F-DCK'], ''],
  ['3-MeO-PCP', 'rec', null, 'unklar (lang)', ['3MeO-PCP'], ''],
  ['Methoxetamin', 'rec', null, 'unklar', ['MXE'], ''],
  ['Bromazolam', 'rec', null, 'unklar', [], 'Designer-Benzo'],
  ['Flubromazolam', 'rec', null, 'unklar (lang)', [], 'Designer-Benzo, sehr potent'],
  ['Clonazolam', 'rec', null, 'unklar', [], 'Designer-Benzo, sehr potent'],
  ['Spice', 'rec', null, 'unklar', ['Synthetische Cannabinoide'], 'unberechenbar stark'],
  ['Buspiron', 'med', 2.5, '2–3 Std.', ['Bespar'], ''],
  ['Pseudoephedrin', 'med', 6, '5–8 Std.', ['Aspirin Complex', 'Wick DayMed'], ''],
);

// Classes per reference entry (keyed by its canonical name).
window.SUBSTANCE_CLASSES = {
  // Opioide
  'Tramadol': ['opioid', 'tramadol', 'seizure'], 'Tilidin': ['opioid'], 'Tapentadol': ['opioid', 'serotonergic'],
  'Codein': ['opioid'], 'Morphin': ['opioid'], 'Oxycodon': ['opioid'], 'Hydromorphon': ['opioid'],
  'Fentanyl': ['opioid', 'serotonergic'], 'Methadon': ['opioid', 'serotonergic', 'qt'], 'Buprenorphin': ['opioid', 'buprenorphine'],
  'Heroin': ['opioid'], 'Speedball': ['opioid', 'cocaine', 'stimulant'], 'Opioide (allgemein)': ['opioid'], 'Kratom': ['opioid'],
  'Pethidin': ['opioid', 'serotonergic'], 'Nitazene': ['opioid'],
  // Dämpfende Mittel
  'Alkohol': ['alcohol'], 'GHB / GBL': ['ghb'],
  'Alprazolam': ['benzo'], 'Diazepam': ['benzo'], 'Lorazepam': ['benzo'], 'Clonazepam': ['benzo'], 'Oxazepam': ['benzo'],
  'Bromazepam': ['benzo'], 'Lormetazepam': ['benzo'], 'Temazepam': ['benzo'], 'Midazolam': ['benzo'], 'Etizolam': ['benzo'],
  'Bromazolam': ['benzo'], 'Flubromazolam': ['benzo'], 'Clonazolam': ['benzo'],
  'Zolpidem': ['zdrug'], 'Zopiclon': ['zdrug'], 'Phenobarbital': ['barb'], 'Clomethiazol': ['barb'],
  'Pregabalin': ['gabapentinoid'], 'Gabapentin': ['gabapentinoid'], 'Phenibut': ['gabab'], 'Baclofen': ['gabab'],
  'Diphenhydramin': ['sedating'], 'Doxylamin': ['sedating'], 'Promethazin': ['sedating', 'qt'], 'Hydroxyzin': ['sedating', 'qt'],
  'Dimenhydrinat': ['sedating'], 'Quetiapin': ['sedating', 'qt'], 'Olanzapin': ['sedating'], 'Mirtazapin': ['sedating', 'serotonergic'],
  'Trazodon': ['sedating', 'serotonergic'], 'Tizanidin': ['sedating', 'tizanidine'], 'Fliegenpilz': ['sedating'],
  'Levomepromazin': ['sedating', 'qt'], 'Pipamperon': ['sedating'], 'Chlorprothixen': ['sedating', 'qt'], 'Clonidin': ['sedating'],
  'Haloperidol': ['qt'],
  // Dissoziativa
  'Ketamin': ['dissociative'], 'Esketamin': ['dissociative'], '2-FDCK': ['dissociative'], '3-MeO-PCP': ['dissociative'],
  'Methoxetamin': ['dissociative'], 'Dextromethorphan': ['dxm'],
  // Antidepressiva / serotonerg
  'Sertralin': ['ssri'], 'Escitalopram': ['ssri', 'qt'], 'Citalopram': ['ssri', 'qt'], 'Fluoxetin': ['ssri', 'cyp2d6inh'],
  'Paroxetin': ['ssri', 'cyp2d6inh'], 'Vortioxetin': ['ssri'], 'Venlafaxin': ['snri'], 'Duloxetin': ['snri'],
  'Amitriptylin': ['tca', 'sedating'], 'Clomipramin': ['tca'], 'Doxepin': ['tca', 'sedating'], 'Nortriptylin': ['tca'],
  'Opipramol': ['tca', 'sedating'], 'Bupropion': ['cyp2d6inh', 'seizure'], 'Buspiron': ['serotonergic'],
  'Moclobemid': ['maoi'], 'Tranylcypromin': ['maoi'], 'Phenelzin': ['maoi'], 'Selegilin': ['maoi'], 'Linezolid': ['maoi'],
  'Ayahuasca': ['maoi', 'psychedelic'], 'Sumatriptan': ['serotonergic'], '5-HTP': ['serotonergic'],
  'Lithium': ['lithium'],
  // Stimulanzien
  'Kokain': ['cocaine', 'stimulant'], 'Amphetamin': ['stimulant'], 'Methamphetamin': ['stimulant'], 'Dexamfetamin': ['stimulant'],
  'Lisdexamfetamin': ['stimulant'], 'Methylphenidat': ['stimulant'], 'Mephedron': ['stimulant', 'serotonergic'],
  '3-MMC': ['stimulant', 'serotonergic'], '4-FA': ['stimulant', 'serotonergic'], 'MDMA': ['mdma', 'stimulant', 'serotonergic'],
  'MDA': ['mdma', 'stimulant', 'serotonergic'], 'Ephedrin': ['stimulant'], 'Pseudoephedrin': ['stimulant'],
  'Koffein': ['stimulant-mild'], 'Yohimbin': ['stimulant-mild'], 'Synephrin': ['stimulant-mild'],
  'Modafinil': ['stimulant-mild'], 'Armodafinil': ['stimulant-mild'],
  'Clenbuterol': ['beta2'], 'Liothyronin': ['thyroid'], 'Levothyroxin': ['thyroid', 'chelate'],
  // Psychedelika / Cannabis
  'LSD': ['psychedelic'], 'Psilocybin': ['psychedelic'], 'DMT': ['psychedelic'], 'Mescalin': ['psychedelic'], '2C-B': ['psychedelic'],
  'Cannabis (THC)': ['cannabis'], 'Spice': ['cannabis'],
  // Herz / Kreislauf / Blutgerinnung
  'Tadalafil': ['pde5'], 'Sildenafil': ['pde5'], 'Vardenafil': ['pde5'], 'Poppers': ['nitrite'], 'Doxazosin': ['alphablocker'],
  'Ibuprofen': ['nsaid'], 'Diclofenac': ['nsaid'], 'Naproxen': ['nsaid'], 'Celecoxib': ['nsaid'], 'Etoricoxib': ['nsaid'],
  'Acetylsalicylsäure': ['nsaid', 'antiplatelet'], 'Clopidogrel': ['antiplatelet'], 'Apixaban': ['anticoag'], 'Rivaroxaban': ['anticoag'],
  'Ramipril': ['acearb'], 'Lisinopril': ['acearb'], 'Candesartan': ['acearb'], 'Telmisartan': ['acearb'], 'Valsartan': ['acearb'],
  'Spironolacton': ['diuretick'], 'Hydrochlorothiazid': ['diuretic'], 'Furosemid': ['diuretic'], 'Propranolol': ['betablockerns'],
  'Simvastatin': ['statin3a4'], 'Atorvastatin': ['statin3a4'],
  // Leber / Stoffwechsel
  'Oxandrolon': ['hepatotox'], 'Methandienon': ['hepatotox'], 'Oxymetholon': ['hepatotox'], 'Stanozolol': ['hepatotox'],
  'Chlordehydromethyltestosteron': ['hepatotox'], 'Fluoxymesteron': ['hepatotox'], 'Methyltestosteron': ['hepatotox'],
  'Methasteron': ['hepatotox'], 'Paracetamol': ['paracetamol'], 'Isotretinoin': ['isotretinoin'], 'Doxycyclin': ['tetracycline', 'chelate'],
  'Metronidazol': ['metronidazole'], 'Metformin': ['metformin'],
  'Insulin (kurzwirksam)': ['insulin'], 'Insulin glargin': ['insulin'],
  'Retatrutide': ['glp1'], 'Semaglutid': ['glp1'], 'Tirzepatid': ['glp1'], 'Liraglutid': ['glp1'], 'Dulaglutid': ['glp1'], 'Exenatid': ['glp1'],
  'Tamoxifen': ['tamoxifen'], 'Anastrozol': ['ai'], 'Letrozol': ['ai'], 'Exemestan': ['ai'],
  'Naltrexon': ['naltrexone'], 'Valproinsäure': ['valproate'], 'Lamotrigin': ['lamotrigine'],
  // Enzymhemmer / QT
  'Clarithromycin': ['cyp3a4inh', 'qt'], 'Ritonavir': ['cyp3a4inh', 'ritonavir'], 'Itraconazol': ['cyp3a4inh'], 'Fluconazol': ['cyp3a4inh', 'qt'],
  'Azithromycin': ['qt'], 'Ciprofloxacin': ['qt', 'cyp1a2inh', 'chelate'], 'Ondansetron': ['qt'], 'Domperidon': ['qt'],
  // Supplements
  'L-Tryptophan': ['serotonergic'], 'SAMe': ['serotonergic'], 'Kanna': ['serotonergic'],
  'Magnesium': ['cation'], 'Zink': ['cation'], 'Eisen': ['cation'], 'Calcium': ['cation'],
  'Kalium': ['potassium'], 'Lithiumorotat': ['lithium'],
  'Vitamin K1': ['vitk'], 'Vitamin K2 (MK-7)': ['vitk'], 'Vitamin K2 (MK-4)': ['vitk'], 'Vitamin A': ['vitamina'],
  'Ginkgo biloba': ['antiplatelet-mild'], 'Omega-3': ['antiplatelet-mild'], 'Curcumin': ['antiplatelet-mild'], 'Vitamin E': ['antiplatelet-mild'],
  'Berberin': ['berberine'], 'Kava': ['sedating', 'hepatotox'], 'Ashwagandha': ['ashwagandha'], 'Coenzym Q10': ['coq10'],
  'Paraxanthin': ['stimulant-mild'], 'Theacrin': ['stimulant-mild'], 'Grapefruitsaft': ['cyp3a4inh'], 'Rapamycin': ['sirolimus'],
  'Johanniskraut': ['serotonergic', 'inducer'],
  'Phenprocoumon': ['vka', 'anticoag'], 'Warfarin': ['vka', 'anticoag'],
};

// How long an entry counts as active for interaction checks, where 5 half-lives would be misleading.
window.INTERACTION_WINDOW_H = {
  'Tranylcypromin': 336, 'Phenelzin': 336, 'Selegilin': 336, 'Clopidogrel': 168, 'Acetylsalicylsäure': 168, 'Alkohol': 12,
  'Grapefruitsaft': 72, 'Magnesium': 4, 'Zink': 4, 'Eisen': 4, 'Calcium': 4,
};

// [severity 3 = gefährlich, 2 = riskant, 1 = beachten, class A, class(es) B, text]
const DEP_TEXT = 'Beide dämpfen Atmung und Bewusstsein – diese Kombination ist eine der häufigsten Ursachen tödlicher Überdosen.';
window.INTERACTION_RULES = [
  // Atemdepression
  [3, 'opioid', 'opioid', 'Mehrere Opioide addieren sich – Atemdepression.'],
  [3, 'opioid', ['benzo', 'alcohol', 'ghb', 'zdrug', 'barb', 'gabab'], DEP_TEXT],
  [3, 'opioid', 'gabapentinoid', 'Pregabalin/Gabapentin verstärken die Atemdämpfung von Opioiden stark (Behördenwarnung).'],
  [3, 'opioid', 'dxm', 'Atemdepression; mit Tramadol zusätzlich Serotonin-Syndrom.'],
  [2, 'opioid', 'dissociative', 'Stärkere Dämpfung und Atemdepression, Erbrechen im Liegen.'],
  [2, 'opioid', 'sedating', 'Zusätzliche Dämpfung – Atemdepression möglich.'],
  [3, 'ghb', ['alcohol', 'benzo', 'zdrug', 'barb', 'gabab', 'gabapentinoid', 'dissociative'], 'GHB mit anderen Dämpfern: schnelle Bewusstlosigkeit, Atemstillstand, Ersticken an Erbrochenem.'],
  [3, 'benzo', ['alcohol', 'barb'], 'Starke Dämpfung, Atemdepression, Gedächtnislücken.'],
  [3, 'zdrug', ['alcohol', 'barb'], 'Starke Dämpfung, Atemdepression.'],
  [3, 'barb', 'alcohol', 'Starke Dämpfung, Atemdepression.'],
  [3, 'alcohol', ['dissociative', 'gabab', 'dxm'], 'Bewusstlosigkeit und Erbrechen – Erstickungsgefahr.'],
  [2, 'alcohol', ['gabapentinoid', 'sedating'], 'Deutlich stärkere Dämpfung, Atemdepression bei hohen Dosen.'],
  [2, 'benzo', ['benzo', 'zdrug', 'gabapentinoid', 'gabab', 'sedating', 'dissociative'], 'Dämpfung addiert sich – Atemdepression, Stürze, Blackouts.'],
  [2, 'zdrug', ['gabapentinoid', 'sedating', 'gabab'], 'Dämpfung addiert sich.'],
  [2, 'gabapentinoid', ['gabab', 'sedating', 'dissociative'], 'Dämpfung addiert sich.'],
  [1, 'sedating', 'sedating', 'Müdigkeit und Benommenheit addieren sich.'],

  // Serotonin-Syndrom / MAO-Hemmer
  [3, 'maoi', ['ssri', 'snri', 'tca', 'serotonergic', 'tramadol', 'mdma', 'stimulant', 'cocaine', 'dxm'], 'MAO-Hemmer: Serotonin-Syndrom oder Blutdruckkrise – potenziell tödlich.'],
  [2, 'maoi', 'opioid', 'Einige Opioide lösen mit MAO-Hemmern ein Serotonin-Syndrom aus.'],
  [2, 'maoi', 'psychedelic', 'MAO-Hemmer verstärken Psychedelika stark und unberechenbar.'],
  [3, 'tramadol', ['ssri', 'snri', 'tca', 'mdma', 'dxm'], 'Serotonin-Syndrom und Krampfanfälle.'],
  [3, 'mdma', 'dxm', 'Serotonin-Syndrom, Überhitzung.'],
  [3, 'dxm', ['ssri', 'snri', 'tca'], 'Serotonin-Syndrom.'],
  [2, 'mdma', ['ssri', 'snri', 'tca'], 'Antidepressiva schwächen MDMA ab – Nachlegen erhöht das Risiko (Serotonin, Überhitzung). Fluoxetin/Paroxetin erhöhen den MDMA-Spiegel.'],
  [2, ['ssri', 'snri', 'tca'], ['serotonergic', 'ssri', 'snri', 'tca'], 'Serotonin-Syndrom möglich (Unruhe, Zittern, Fieber, Herzrasen).'],
  [2, 'cocaine', ['ssri', 'snri', 'tca'], 'Serotonin- und Herz-Kreislauf-Belastung.'],
  [1, 'stimulant', ['ssri', 'snri'], 'Mehr Serotonin- und Kreislaufbelastung; Wirkung kann sich verändern.'],
  [2, 'lithium', ['ssri', 'snri', 'tca', 'serotonergic'], 'Serotonin-Syndrom möglich.'],
  [3, 'lithium', 'psychedelic', 'Lithium + LSD/Psilocybin: Berichte über Krampfanfälle.'],
  [2, 'lithium', ['nsaid', 'acearb', 'diuretic', 'diuretick'], 'Lithium-Spiegel steigt – Vergiftungsgefahr.'],
  [2, 'tramadol', 'psychedelic', 'Senkt die Krampfschwelle.'],

  // Stimulanzien / Herz
  [3, 'cocaine', 'opioid', 'Speedball: Das Kokain verdeckt das Opioid – lässt es nach, kann die Atemdepression voll durchschlagen.'],
  [2, 'stimulant', 'opioid', 'Stimulans verdeckt die Opioidwirkung – Gefahr der Überdosierung, wenn es nachlässt.'],
  [2, 'stimulant', ['ghb', 'benzo', 'alcohol'], 'Stimulans verdeckt die Dämpfung – man nimmt leicht zu viel; Bewusstlosigkeit, wenn es nachlässt.'],
  [2, 'cocaine', 'alcohol', 'Es entsteht Cocaethylen – belastet das Herz stärker als Kokain allein.'],
  [2, 'mdma', 'alcohol', 'Austrocknung, Überhitzung, stärkere Belastung.'],
  [2, 'stimulant', ['stimulant', 'cocaine', 'mdma'], 'Herz-Kreislauf-Belastung addiert sich (Puls, Blutdruck, Überhitzung).'],
  [2, 'beta2', ['stimulant', 'stimulant-mild', 'thyroid', 'cocaine'], 'Herzrasen, Rhythmusstörungen.'],
  [1, 'stimulant-mild', ['stimulant', 'cocaine'], 'Puls und Blutdruck steigen weiter.'],
  [2, 'cocaine', 'betablockerns', 'Nicht-selektive Betablocker + Kokain: Blutdruckanstieg möglich.'],
  [2, 'seizure', ['stimulant', 'cocaine', 'alcohol', 'tramadol', 'dxm'], 'Senkt die Krampfschwelle – Krampfanfälle möglich.'],
  [3, 'ritonavir', ['mdma', 'stimulant'], 'Ritonavir erhöht MDMA/Amphetamin-Spiegel massiv – Todesfälle dokumentiert.'],
  [2, 'dxm', 'stimulant', 'Blutdruck, Puls und Serotonin steigen.'],
  [1, 'cannabis', ['stimulant', 'cocaine', 'mdma'], 'Herzfrequenz steigt, Angst/Paranoia möglich.'],
  [1, 'cannabis', 'psychedelic', 'Kann den Trip stark verstärken.'],
  [1, 'cannabis', 'alcohol', 'Schwindel und Übelkeit, Kreislaufprobleme.'],

  // Medikamente
  [3, 'pde5', 'nitrite', 'Lebensgefährlicher Blutdruckabfall.'],
  [2, 'pde5', 'alphablocker', 'Starker Blutdruckabfall möglich.'],
  [2, 'pde5', 'cyp3a4inh', 'Potenzmittel-Spiegel steigt stark – Blutdruckabfall.'],
  [2, 'cyp3a4inh', 'statin3a4', 'Statin-Spiegel steigt – Muskelschäden (Simvastatin: kontraindiziert).'],
  [2, 'cyp3a4inh', 'benzo', 'Benzo-Spiegel steigt – stärkere Dämpfung.'],
  [2, 'cyp3a4inh', 'opioid', 'Opioid-Spiegel steigt (v. a. Fentanyl, Oxycodon, Methadon) – Atemdepression.'],
  [2, 'qt', 'qt', 'Beide verlängern das QT-Intervall – Herzrhythmusstörungen möglich.'],
  [2, 'nsaid', 'nsaid', 'Magenblutungs- und Nierenrisiko.'],
  [2, ['nsaid', 'ssri', 'snri'], ['anticoag', 'antiplatelet'], 'Erhöhtes Blutungsrisiko.'],
  [1, ['ssri', 'snri'], 'nsaid', 'Erhöhtes Blutungsrisiko (Magen).'],
  [1, 'nsaid', ['acearb', 'diuretic'], 'Belastet die Nieren; Blutdrucksenker wirken schwächer.'],
  [2, 'diuretick', 'acearb', 'Zu viel Kalium im Blut (Herzrhythmus).'],
  [3, 'cyp1a2inh', 'tizanidine', 'Kontraindiziert: starker Blutdruckabfall und Sedierung.'],
  [2, 'metronidazole', 'alcohol', 'Übelkeit, Herzrasen, Blutdruckabfall (Antabus-Effekt).'],
  [2, 'alcohol', 'metformin', 'Laktatazidose-Risiko bei viel Alkohol.'],
  [2, 'alcohol', ['hepatotox', 'isotretinoin'], 'Zusätzliche Leberbelastung.'],
  [2, 'hepatotox', ['hepatotox', 'isotretinoin'], 'Leberbelastung addiert sich.'],
  [1, 'hepatotox', 'paracetamol', 'Zusätzliche Leberbelastung.'],
  [1, 'alcohol', 'paracetamol', 'Leberschaden-Risiko bei regelmäßigem Alkohol.'],
  [3, 'isotretinoin', 'tetracycline', 'Kontraindiziert: Hirndrucksteigerung.'],
  [2, 'tamoxifen', 'cyp2d6inh', 'Schwächt die Wirkung von Tamoxifen deutlich.'],
  [1, 'tamoxifen', 'ai', 'Tamoxifen senkt den Spiegel von Anastrozol/Letrozol.'],
  [2, 'naltrexone', 'opioid', 'Blockiert Opioide und kann Entzug auslösen; nach dem Absetzen hohe Überdosis-Gefahr.'],
  [2, 'buprenorphine', 'opioid', 'Kann Entzug auslösen; mit Dämpfern Atemdepression.'],
  [2, 'insulin', ['glp1', 'alcohol'], 'Unterzuckerung möglich (bei Alkohol verzögert).'],
  [2, 'valproate', 'lamotrigine', 'Lamotrigin-Spiegel verdoppelt sich – schwere Hautreaktionen möglich.'],

  // Supplements
  [1, 'cation', 'chelate', 'Mineralien binden das Medikament im Darm – Wirkung sinkt. Mit einigen Stunden Abstand einnehmen.'],
  [2, 'potassium', ['diuretick', 'acearb'], 'Zu viel Kalium im Blut (Herzrhythmus).'],
  [2, 'vitk', 'vka', 'Vitamin K schwächt Marcumar/Warfarin ab – der INR-Wert schwankt.'],
  [1, 'coq10', 'vka', 'Kann die Wirkung von Marcumar/Warfarin abschwächen.'],
  [2, 'inducer', ['vka', 'anticoag', 'sirolimus', 'statin3a4', 'tamoxifen'], 'Johanniskraut senkt den Spiegel vieler Medikamente – die Wirkung kann ausbleiben.'],
  [1, 'antiplatelet-mild', ['anticoag', 'antiplatelet'], 'Kann das Blutungsrisiko leicht erhöhen.'],
  [2, 'vitamina', 'isotretinoin', 'Zu viel Vitamin A – Kopfschmerzen, Leberbelastung möglich.'],
  [1, 'berberine', ['metformin', 'insulin', 'glp1'], 'Blutzucker kann stärker sinken.'],
  [1, 'ashwagandha', ['thyroid', 'benzo', 'sedating'], 'Kann Schilddrüsenwerte erhöhen bzw. Müdigkeit verstärken.'],
  [2, 'cyp3a4inh', 'sirolimus', 'Rapamycin-Spiegel steigt stark.'],
];

// ---------- Gewöhnung & Abhängigkeit ----------
// Extra classes used only for dependence checks.
(function () {
  const C = window.SUBSTANCE_CLASSES;
  const add = (names, cls) => names.forEach(n => { (C[n] ||= []).push(cls); });
  add(['Nikotin'], 'nicotine');
  add(['Koffein', 'Paraxanthin'], 'caffeine');
  add(['Testosteron Enanthat', 'Testosteron Cypionat', 'Testosteron Propionat', 'Testosteron Undecanoat', 'Sustanon 250',
    'Testosteron Suspension', 'Nandrolon Decanoat', 'Nandrolon Phenylpropionat', 'Trenbolon Acetat', 'Trenbolon Enanthat',
    'Trenbolon Hexahydrobenzylcarbonat', 'Boldenon Undecylenat', 'Drostanolon Propionat', 'Drostanolon Enanthat',
    'Methenolon Enanthat', 'Methenolon Acetat', 'Oxandrolon', 'Methandienon', 'Oxymetholon', 'Stanozolol',
    'Chlordehydromethyltestosteron', 'Fluoxymesteron', 'Mesterolon', 'Methyltestosteron', 'Methasteron'], 'aas');
})();

// Usage patterns that commonly lead to tolerance or dependence. First matching rule per substance wins.
// window: days looked back; min: days with use in that window (or weeks with use when `weeks` is set).
// level: 3 = hoch, 2 = deutlich, 1 = Hinweis.
window.DEPENDENCE_RULES = [
  { cls: 'ghb', window: 14, min: 4, level: 3, potential: 'sehr hoch (körperlich)',
    text: 'Bei häufigem GHB/GBL-Konsum entsteht schnell eine starke körperliche Abhängigkeit. Der Entzug kann lebensgefährlich sein (Krampfanfälle, Delir) – nur ärztlich begleitet absetzen.' },
  { cls: 'opioid', window: 14, min: 5, level: 3, potential: 'sehr hoch (körperlich & psychisch)',
    text: 'Körperliche Abhängigkeit kann sich schon nach 1–2 Wochen regelmäßiger Einnahme entwickeln. Entzug: Unruhe, Schwitzen, Schmerzen, Durchfall, Schlaflosigkeit. Die Toleranz sinkt in Pausen schnell – danach ist die gewohnte Menge gefährlich.' },
  { cls: 'benzo', window: 28, min: 10, level: 3, potential: 'hoch (körperlich & psychisch)',
    text: 'Bei Einnahme über mehr als 2–4 Wochen droht Abhängigkeit. Nicht abrupt absetzen – der Entzug kann Krampfanfälle auslösen. Ärztlich ausschleichen.' },
  { cls: 'zdrug', window: 28, min: 10, level: 3, potential: 'hoch (körperlich & psychisch)',
    text: 'Schlafmittel wie Zolpidem/Zopiclon machen bei regelmäßiger Einnahme über mehr als 2–4 Wochen abhängig. Absetzen führt oft zu schlechterem Schlaf als vorher (Rebound) – ärztlich ausschleichen.' },
  { cls: 'barb', window: 28, min: 7, level: 3, potential: 'sehr hoch (körperlich)',
    text: 'Starke Gewöhnung bei regelmäßiger Einnahme; der Entzug kann lebensgefährlich sein. Nur ärztlich begleitet absetzen.' },
  { cls: 'gabab', window: 14, min: 4, level: 3, potential: 'hoch (körperlich)',
    text: 'Phenibut/Baclofen: Toleranz entwickelt sich sehr schnell, der Entzug kann schwer sein (Angst, Schlaflosigkeit, Krampfanfälle).' },
  { cls: 'gabapentinoid', window: 28, min: 10, level: 2, potential: 'mittel bis hoch',
    text: 'Pregabalin/Gabapentin: Gewöhnung und Entzug (Unruhe, Schlafstörungen, Schwitzen, selten Krampfanfälle) bei regelmäßigem Gebrauch. Nicht abrupt absetzen.' },
  { cls: 'cocaine', window: 14, min: 4, level: 3, potential: 'hoch (psychisch)',
    text: 'Häufiger Kokainkonsum führt schnell zu psychischer Abhängigkeit (Craving). Das Hoch täuscht: Danach folgen Crash, Erschöpfung, gedrückte Stimmung und Schlafprobleme.' },
  { cls: 'mdma', window: 30, min: 2, level: 2, potential: 'mittel (psychisch), Wirkverlust',
    text: 'MDMA öfter als etwa alle 4–6 Wochen: Der Serotoninspeicher erholt sich nicht. Typisch sind Tiefs 2–4 Tage danach, die Wirkung lässt nach.' },
  { cls: 'stimulant', window: 14, min: 4, level: 2, potential: 'hoch (psychisch)',
    text: 'Stimulanzien regelmäßig: schnelle Toleranz und psychische Abhängigkeit. Auf Konsumtage folgen Crash, Erschöpfung und gedrückte Stimmung – das Hoch täuscht.' },
  { cls: 'dissociative', window: 30, min: 8, level: 2, potential: 'mittel (psychisch)',
    text: 'Ketamin & Co. regelmäßig: psychische Abhängigkeit möglich, schnelle Toleranz. Blase und Nieren können dauerhaft Schaden nehmen (Ketamin-Blase).' },
  { cls: 'dxm', window: 30, min: 6, level: 2, potential: 'mittel (psychisch)',
    text: 'Häufiger DXM-Gebrauch: Toleranz, psychische Abhängigkeit, Gedächtnis- und Stimmungsprobleme.' },
  { cls: 'alcohol', window: 30, min: 15, level: 2, potential: 'hoch (körperlich & psychisch)',
    text: 'Alkohol an mehr als der Hälfte der Tage: hohes Risiko für Gewöhnung und Abhängigkeit. Schlaf, Leber und Stimmung an den Folgetagen leiden. Bei starker Gewöhnung nicht abrupt aufhören (Entzugskrampf) – ärztlich begleiten.' },
  { cls: 'cannabis', window: 30, min: 20, level: 2, potential: 'mittel (psychisch)',
    text: 'Fast täglicher Cannabiskonsum: Etwa jede zehnte Person wird abhängig, bei täglichem Konsum deutlich mehr. Entzug: Schlafprobleme, Reizbarkeit, Unruhe, wenig Appetit – meist 1–2 Wochen.' },
  { cls: 'nicotine', window: 14, min: 10, level: 1, potential: 'sehr hoch',
    text: 'Täglicher Nikotinkonsum macht schnell abhängig. Ohne Nikotin: Reizbarkeit, Unruhe, Konzentrationsprobleme.' },
  { cls: 'caffeine', window: 14, min: 12, level: 1, potential: 'gering (Gewöhnung)',
    text: 'Tägliches Koffein führt zu Gewöhnung: Ohne Koffein kommen Kopfschmerzen, Müdigkeit und Gereiztheit für 2–9 Tage.' },
  { cls: 'aas', window: 84, min: 8, weeks: true, level: 1, potential: 'Hormonachse, psychisch möglich',
    text: 'Testosteron/Anabolika über 8+ Wochen: Die körpereigene Testosteronproduktion wird unterdrückt. Nach dem Absetzen sind Stimmungstiefs, Antriebs- und Libidoverlust häufig – ärztlich begleiten (Blutwerte).' },
];
