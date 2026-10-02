// ================================================================================================
// BLOCK 20 · Internationalization (DE/EN) and About dialog wiring
// ------------------------------------------------------------------------------------------------
// Depends : All blocks (re-renders on language switch).
// Provides: STATIC_I18N (exact German text → English), normKey(), i18nApply(), translateStaticDom(), applyLanguage(),
//           renderAboutChangelog(), About open/close handlers, version stamps
// Note    : When a static German text changes, its dictionary key must change with it or it stays untranslated.
// ================================================================================================
// ---------------- DE/EN translation ----------------
// STATIC_I18N: exact (whitespace-normalized) German texts -> English. Covers static HTML AND
// variable-free dynamic texts (table headers, chips, tooltips). Sentences with variables go through
// tr(de, en) directly in the code. Tier keys/sheet names/export values stay unchanged.
const STATIC_I18N = {
  "Community-Projekt · Disaster Recovery Konzept & Planung": "Community project · Disaster Recovery concept & planning",
  "Sprache umschalten / Switch language": "Switch language / Sprache umschalten",
  "Kein offizielles Veeam-Produkt — Arbeitsmittel in Entwicklung und Erprobung. Ergebnisse ohne Gewähr, vor Verwendung gemeinsam validieren.": "Not an official Veeam product — working aid under development and evaluation. Results without warranty; validate jointly before use.",
  "Kein offizielles Veeam-Produkt — Ergebnisse ohne Gewähr.": "Not an official Veeam product — results without warranty.",
  "Kein offizielles Veeam-Produkt · ohne Gewähr": "Not an official Veeam product · no warranty",
  "Problem melden / Feedback als GitHub-Issue (öffnet den Browser, nichts wird automatisch gesendet)": "Report an issue / feedback as a GitHub issue (opens the browser, nothing is sent automatically)",
  "✕ Schließen": "✕ Close",
  "Zweck": "Purpose",
  "Hilfestellung zur Klassifizierung von Workloads in DR-Schutzklassen (Tier 0–4) mit Ziel-RPO/RTO, zur Erfassung der Abhängigkeiten, die einen Service bilden, und als Grundlage für Veeam-Recovery-Orchestrator-Runbooks.": "Guidance for classifying workloads into DR protection classes (Tier 0–4) with target RPO/RTO, for capturing the dependencies that form a service, and as a foundation for Veeam Recovery Orchestrator runbooks.",
  "Datenschutz & Laufzeit": "Privacy & Runtime",
  "Hinweis zum Autosave: Der Arbeitsstand liegt unverschlüsselt im lokalen Speicher dieses Browserprofils (localStorage) und bleibt dort auch nach dem Schließen erhalten, bis er über „Neu starten\" gelöscht oder von einem neuen Stand überschrieben wird. Auf gemeinsam genutzten oder Kunden-Rechnern daher vor dem Verlassen den Fortschritt als JSON speichern und „Neu starten\" ausführen. Fortschrittsdateien (JSON) und Excel-Importe werden beim Laden auf gültige Feldtypen geprüft — Dateien aus unbekannter Quelle trotzdem nur mit Bedacht laden.": "Note on autosave: the working state is kept unencrypted in this browser profile's local storage (localStorage) and persists after closing until it is cleared via \"Start over\" or replaced by a newer state. On shared or customer machines, save your progress as JSON and run \"Start over\" before leaving. Progress files (JSON) and Excel imports are type-checked on load — still, load files from unknown sources with care.",
  "✉ Fehler melden": "✉ Report error",
  "Ausblenden": "Dismiss",
  "Struktur-Zeilen überspringen (wiederholte Kopfzeilen, Cluster-/Host-Zwischensummen, Abschnittsköpfe wie „vCenter Server:“ — typisch für Veeam-ONE-Reports) und Cluster/Host als Standort an die folgenden Zeilen vererben": "Skip structural rows (repeated header rows, cluster/host subtotals, section headers such as \"vCenter Server:\" — typical for Veeam ONE reports) and inherit cluster/host as location for the rows below",
  "Replicas ausschließen (Namen mit Veeam-Suffix „_replica“ — DR-Kopien, keine zu klassifizierenden Workloads)": "Exclude replicas (names with the Veeam suffix \"_replica\" — DR copies, not workloads to classify)",
  "🗑 Ausgewählte löschen": "🗑 Delete selected",
  "Löscht alle ausgewählten Zeilen nach Bestätigung — Abhängigkeitsverweise anderer Workloads werden bereinigt, die letzte Löschung ist rückgängig machbar": "Deletes all selected rows after confirmation — dependency references of other workloads are cleaned up, the last deletion can be undone",
  "Zeile löschen": "Delete row",
  "Layout: automatisch": "Layout: automatic",
  "Layout: animiert": "Layout: animated",
  "Layout: statisch": "Layout: static",
  "Automatisch: bis 600 Knoten animiert, darüber einmal statisch berechnet. Erzwungene Animation kann bei großen Netzen träge werden.": "Automatic: animated up to 600 nodes, computed once statically above. Forcing animation can get sluggish on large graphs.",
  "Spalten": "Columns",
  "Nicht benötigte Spalten ausblenden — eine Geräte-Einstellung wie Dark Mode, nicht Teil der Fortschrittsdatei. #, Name und Schutzklasse bleiben immer sichtbar.": "Hide the columns you do not need — a device setting like dark mode, not part of the progress file. #, name and protection class always stay visible.",
  "✨ Neu in dieser Version": "✨ What's new in this version",
  "Neu in dieser Version & Verlauf": "What's new & history",
  "Die Bibliotheksversionen werden vor jedem Release gegen veröffentlichte Sicherheitshinweise (CVEs) geprüft.": "Library versions are checked against published security advisories (CVEs) before each release.",
  "Das Tool läuft vollständig lokal im Browser: kein Server, keine Telemetrie, kein Datenabruf aus dem Internet, keine KI zur Laufzeit. Kunden- und Bewertungsdaten verlassen den Rechner nie — gespeichert wird ausschließlich lokal im Browser (Autosave) bzw. in Dateien, die aktiv selbst gespeichert werden.": "The tool runs entirely locally in the browser: no server, no telemetry, no data retrieval from the internet, no AI at runtime. Customer and assessment data never leave the machine — everything is stored locally in the browser (autosave) or in files you actively save yourself.",
  "🪄 Übernehmen + automatisch vorklassifizieren": "🪄 Add + auto-prequalify",
  "Übernimmt die Workloads und öffnet danach den Assistenten, der per Mustererkennung Bewertungs-Vorschläge macht — nichts wird ohne Bestätigung gesetzt": "Adds the workloads, then opens the assistant that proposes assessments via pattern recognition — nothing is set without confirmation",
  "🪄 Automatisch vorklassifizieren": "🪄 Auto-prequalify",
  "Regelbasierte Bewertungs-Vorschläge per Mustererkennung — nichts wird ohne Bestätigung gesetzt": "Rule-based assessment proposals via pattern recognition — nothing is set without confirmation",
  "🪄 Optionen: Vorqualifizierungs-Katalog (Erkennungsmuster & Vorschlagswerte anpassen)": "🪄 Options: prequalification catalog (adjust detection patterns & proposal values)",
  "Regelkatalog des Assistenten \"Automatisch vorklassifizieren\": Erkennungsmuster (kommagetrennte Schlüsselwörter, Treffer an Wortgrenzen im Workload-Namen; OS/Standort/Notiz dienen als Zweitsignal für die Konfidenz) und die Vorschlagswerte je Kategorie. Die Werte sind destillierte Felderfahrung — kein Standard, keine Telemetrie — und sollten je Kunde geprüft werden. RK ist wie überall im Tool eine reine Aufwands-Dokumentation und fließt nie in die Schutzklassen-Berechnung ein. Vorschläge werden grundsätzlich nur in leere Bewertungsfelder übernommen und bleiben bis zur Kundenvalidierung als \"auto\" markiert.": "Rule catalog for the \"auto-prequalify\" assistant: detection patterns (comma-separated keywords, matched at word boundaries in the workload name; OS/location/note serve as secondary confidence signals) and the proposal values per category. The values are distilled field experience — not a standard, no telemetry — and should be reviewed per customer. RC is, as everywhere in the tool, effort documentation only and never enters the protection-class calculation. Proposals are only ever written into empty assessment fields and stay marked \"auto\" until customer validation.",
  "↺ Auf Standardkatalog zurücksetzen": "↺ Reset to default catalog",
  "＋ Eigene Kategorie hinzufügen": "＋ Add custom category",
  "Nicht-Prod-Muster (senken BI −2, Reg −1):": "Non-prod patterns (lower BI −2, Reg −1):",
  "Prod-Muster (heben nur die Konfidenz):": "Prod patterns (only raise confidence):",
  "✕ Abbrechen": "✕ Cancel",
  "Optionen": "Options",
  "Feedback / Problem melden (GitHub)": "Feedback / report issue (GitHub)",
  "About & Disclaimer": "About & disclaimer",
  "Neu starten (alles zurücksetzen)": "Start over (reset everything)",
  "⚑ Feedback": "⚑ Feedback",
  "Bevor es losgeht": "Before you begin",
  "Dieses Werkzeug ist ein Community-Projekt eines Veeam Technical Account Managers, in aktiver Entwicklung — kein offizielles Veeam-Produkt, nicht von Veeam R&D erstellt, nicht durch den Veeam Support abgedeckt. Ergebnisse sind eine strukturierte Diskussionsgrundlage und werden gemeinsam mit dem Kunden validiert — ohne Gewähr.": "This tool is a community project by a Veeam Technical Account Manager, under active development — not an official Veeam product, not created by Veeam R&D, not covered by Veeam Support. Results are a structured basis for discussion and are validated together with the customer — without warranty.",
  "Alles läuft zu 100 % lokal in diesem Browser: kein Server, keine Telemetrie, keine KI zur Laufzeit. Ihre Daten verlassen den Rechner nicht.": "Everything runs 100% locally in this browser: no server, no telemetry, no AI at runtime. Your data never leaves this machine.",
  "Wenn etwas klemmt oder eine Idee aufblitzt:": "If something is off or an idea sparks:",
  "— jedes Feedback macht das Werkzeug besser. Details und vollständiger Disclaimer: ⓘ About (⚙-Menü oder Statusleiste).": "— every piece of feedback makes the tool better. Details and full disclaimer: ⓘ About (⚙ menu or status bar).",
  "✓ Verstanden — los geht's": "✓ Got it — let's go",
  "Entscheidung merken — bis zur nächsten Version nicht mehr anzeigen": "Remember my decision — don't show again until the next version",
  "„Bevor es losgeht“ anzeigen": "Show “Before you begin”",
  "Wichtig — bitte lesen": "Important — please read",
  "Dieser Assistent erzeugt Bewertungs-VORSCHLÄGE auf Basis generischer Namens- und Inventarmuster (destillierte Felderfahrung, keine Telemetrie). Er hat keine Kenntnis Ihrer Geschäftsprozesse und ersetzt keine Business-Impact-Analyse — Rahmenwerke wie ISO 22317, BSI 200-4, DORA und NIS2 legen die Verantwortung für die Kritikalitätsbewertung ausdrücklich beim Unternehmen selbst. Alle Vorschläge müssen gemeinsam mit dem Kunden validiert werden.": "This assistant generates assessment PROPOSALS based on generic name and inventory patterns (distilled field experience, no telemetry). It has no knowledge of your business processes and does not replace a business impact analysis — frameworks such as ISO 22317, BSI 200-4, DORA and NIS2 explicitly place responsibility for criticality assessment with the organization itself. All proposals must be validated together with the customer.",
  "Weder Veeam noch der Owner dieses Werkzeugs übernehmen Verantwortung oder Haftung für Fehleinschätzungen aus diesen Vorschlägen. Übernommene Vorschläge bleiben bis zur Validierung sichtbar als \"auto\" markiert — in der Tabelle, im Export und im Report.": "Neither Veeam nor the owner of this tool accepts responsibility or liability for misjudgments arising from these proposals. Applied proposals stay visibly marked as \"auto\" until validated — in the table, the export and the report.",
  "Es wird nichts automatisch gesetzt: Vorschläge werden nur nach Ihrer Bestätigung und nur in leere Bewertungsfelder übernommen. Der Regelkatalog ist unter \"Optionen: Vorqualifizierungs-Katalog\" einsehbar und anpassbar.": "Nothing is set automatically: proposals are only applied after your confirmation and only into empty assessment fields. The rule catalog can be reviewed and adjusted under \"Options: prequalification catalog\".",
  "Ich habe verstanden: Das sind unverbindliche Vorschläge, die Validierung mit dem Kunden ist zwingend.": "I understand: these are non-binding proposals; validation with the customer is mandatory.",
  "Erkennung starten →": "Start detection →",
  "Erkennung": "Detection",
  "Gruppen prüfen →": "Review groups →",
  "Gruppen prüfen & übernehmen": "Review & apply groups",
  "Pro Gruppe: Vorschlagswerte prüfen, bei Bedarf anpassen, dann übernehmen oder überspringen. Gruppen mit niedriger Konfidenz stehen bewusst auf \"Überspringen\". Werte werden nur in leere Bewertungsfelder geschrieben; bereits bewertete Workloads sind ausgenommen.": "Per group: review the proposed values, adjust if needed, then apply or skip. Low-confidence groups deliberately default to \"skip\". Values are only written into empty assessment fields; already-rated workloads are excluded.",
  "Weiter zu Foundational & Out of Scope →": "Continue to foundational & out of scope →",
  "Foundational- & Out-of-Scope-Prüflisten": "Foundational & out-of-scope review lists",
  "Die folgenreichsten Vorschläge — bitte einzeln prüfen. Foundational = Tier 0 (AD/DNS/PKI & Co., immer erster Runbook-Block). Out of Scope = bewusst ohne Backup (bleibt sichtbar, Abhängigkeitsrisiken werden weiter geprüft).": "The most consequential proposals — please review individually. Foundational = tier 0 (AD/DNS/PKI etc., always the first runbook block). Out of scope = deliberately without backup (stays visible, dependency risks keep being checked).",
  "Weiter zur Zusammenfassung →": "Continue to summary →",
  "Zusammenfassung": "Summary",
  "Übernommene Vorschläge tragen jetzt das blaue \"auto\"-Badge in der Schutzklassen-Spalte — es verschwindet erst mit dem Haken \"Vom Kunden validiert\". Die Quote unbestätigter Auto-Vorschläge wird in der Werkzeugleiste angezeigt.": "Applied proposals now carry the blue \"auto\" badge in the protection-class column — it only disappears once \"validated by customer\" is ticked. The share of unconfirmed auto proposals is shown in the toolbar.",
  "✓ Fertig — zurück zur Tabelle": "✓ Done — back to the table",
  "Auto-Vorschlag — bis zur Kundenvalidierung markiert": "Auto proposal — marked until customer validation",
  "📚 VRO-Praxiswissen & Quellen (FAQ)": "📚 VRO field knowledge & sources (FAQ)",
  "Kurze Antworten auf die häufigsten Fragen beim Übergang von diesem Vorschlag zu echten VRO-Plänen — mit den offiziellen Quellen zum Nachlesen. Die Links werden vom Tool nie selbst aufgerufen (Offline-Versprechen), sie öffnen im Browser.": "Short answers to the most common questions on the way from this proposal to real VRO plans — with the official sources for further reading. The tool never fetches these links itself (offline promise); they open in the browser.",
  "❓ Warum bekommt die Foundation einen eigenen Recovery Plan?": "❓ Why does the foundation get its own recovery plan?",
  "AD/DNS/PKI & Co. hängen mit fast allem zusammen — in Service-Runbooks gemischt würden sie jede Gruppe zu einem Riesenplan verschmelzen. Als eigener, vorgelagerter Orchestration Plan starten sie im DR-Fall zuerst; alle Service-Pläne setzen darauf auf.": "AD/DNS/PKI etc. are connected to almost everything — mixed into service runbooks they would merge every group into one giant plan. As a dedicated, upstream orchestration plan they start first in a DR event; all service plans build on top.",
  "❓ Wie teste ich einen Service-Plan im DataLab, wenn er von AD/DNS abhängt?": "❓ How do I test a service plan in the DataLab when it depends on AD/DNS?",
  "Die Foundation-Systeme als LAB GROUP im DataLab konfigurieren — Lab Groups bilden Abhängigkeiten ab, die nicht Teil des getesteten Plans sind, aber im Lab laufen müssen (mit Verarbeitungs-Reihenfolge und Halt-bei-Fehler). Domain Controller brauchen in der Lab Group den Step „Prepare VM as Domain Controller\". Den Foundation-Plan selbst testet man über einen eigenen Test-Schedule. SureBackup-Application-Groups aus VBR sind für VRO-DataLab-Tests nicht erforderlich.": "Configure the foundation systems as a LAB GROUP in the DataLab — lab groups model dependencies that are not part of the tested plan but must run in the lab (with processing order and halt-on-error). Domain controllers in the lab group need the \"Prepare VM as Domain Controller\" step. The foundation plan itself is tested via its own test schedule. SureBackup application groups from VBR are not required for VRO DataLab tests.",
  "❓ Woher bekommt VRO seine Gruppen — und wie robust sind Tags?": "❓ Where does VRO get its groups — and how robust are tags?",
  "Inventory Groups entstehen automatisch aus vier Quellen: Backup-Jobs, Protection Groups (Agents), Datastores und VMware-Tags („Category – Tag\"). Achtung: Tag-Gruppen fallen komplett aus, wenn das Tag im vCenter gelöscht wird — für robuste Orchestrierung eher Jobs/Datastores nutzen oder eigene Kategorien über die Veeam-ONE-Business-View pflegen (Anlage/Bearbeitung nur im Veeam ONE Client, nicht in der VRO-UI).": "Inventory groups are created automatically from four sources: backup jobs, protection groups (agents), datastores and VMware tags (\"Category – Tag\"). Caution: tag-based groups fail completely if the tag is deleted in vCenter — for robust orchestration prefer jobs/datastores, or maintain custom categories via the Veeam ONE business view (created/edited in the Veeam ONE client only, not in the VRO UI).",
  "❓ Welche Versionen passen zusammen?": "❓ Which versions go together?",
  "VRO 13.1 unterstützt offiziell VBR 12.3 oder neuer; manche neuen Funktionen benötigen Remote-VBR 13.0.1+. Nach einem Upgrade müssen Virtual Labs einmal über den Edit-Wizard in der VBR-Konsole aktualisiert werden. NAT zwischen Remote-VBR und Orchestrator wird nicht unterstützt.": "VRO 13.1 officially supports VBR 12.3 or later; some new features require remote VBR 13.0.1+. After an upgrade, virtual labs must be refreshed once via the edit wizard in the VBR console. NAT between remote VBR and the orchestrator is not supported.",
  "Quellen zum Nachlesen": "Sources for further reading",
  "Grenzen & Performance": "Limits & performance",
  "Getestet mit synthetischen Inventaren bis 5.000 Workloads (Import, Bewertung, Register, Excel-/JSON-Export). Die Tabellen sind paginiert und bleiben auch darüber hinaus flüssig — rechnerisch trägt dieser Build etwa 10.000 Workloads. Das Abhängigkeitsnetz wird bei sehr großen Umgebungen begrenzt dargestellt. Empfehlung ab dieser Größenordnung: die Erhebung in Wellen aufteilen (z. B. je Standort oder Cluster).": "Tested with synthetic inventories of up to 5,000 workloads (import, assessment, register, Excel/JSON export). Tables are paginated and stay responsive beyond that — computationally this build handles roughly 10,000 workloads. The dependency graph is rendered in a reduced form for very large environments. Recommendation at that scale: split the survey into waves (e.g. per site or cluster).",
  "↺ Neu starten": "↺ Start over",
  "Alles zurücksetzen — verwirft den aktuellen Stand (inkl. Auto-Speicherung) und startet einen neuen Import": "Reset everything — discards the current state (incl. auto-save) and starts a new import",
  "Transparenz": "Transparency",
  "Entwickelt mit Unterstützung von Anthropic Claude; gepflegt und verantwortet durch den Owner. Das Tool selbst enthält keine KI-Funktionalität.": "Developed with the assistance of Anthropic Claude; maintained and owned by the owner. The tool itself contains no AI functionality.",
  "Eingebettete Open-Source-Bibliotheken": "Embedded open-source libraries",
  "Dieses Werkzeug ist ein Community-Projekt, erstellt von einem Veeam Technical Account Manager und im Sinne von Open Source geteilt (MIT-Lizenz); es befindet sich in Entwicklung und Erprobung. Es ist kein offizielles Veeam-Produkt, nicht von Veeam R&D erstellt, nicht durch Veeam QA geprüft, nicht Teil des Veeam-Produktportfolios und wird nicht durch den Veeam Support abgedeckt. Ergebnisse dienen als strukturierte Diskussionsgrundlage und sind vor Verwendung gemeinsam zu validieren — ohne Gewähr.": "This tool is a community project, created by a Veeam Technical Account Manager and shared in the spirit of open source (MIT license); it is under development and evaluation. It is not an official Veeam product, not created by Veeam R&D, not validated by Veeam QA, not part of the Veeam product portfolio and not covered by Veeam Support. Results serve as a structured basis for discussion and must be validated jointly before use — without warranty.",
  "② Klassifizierung ansehen": "② View classification",
  "① Neue Erhebung (RVTools/vCenter-Import)": "① New assessment (RVTools/vCenter import)",
  "③ Runbook-Planung (VRO)": "③ Runbook planning (VRO)",
  "Workload-Klassifizierung hochladen": "Upload workload classification",
  "Die ausgefüllte DR_Workload_Klassifizierungstool.xlsx hochladen — oder eine Fortschrittsdatei (.json) aus einer früheren Erhebung; die Daten stehen dann direkt hier und in Tab ① zum Weiterbearbeiten bereit. Die Verarbeitung erfolgt ausschließlich lokal im Browser — es werden keine Daten irgendwohin übertragen.": "Upload the completed DR_Workload_Klassifizierungstool.xlsx — or a progress file (.json) from a previous assessment; the data is then available here and in tab ① for further editing. Processing happens entirely locally in the browser — no data is transferred anywhere.",
  "📄 Datei hierher ziehen oder klicken zum Auswählen (.xlsx oder Fortschrittsdatei .json)": "📄 Drag a file here or click to select (.xlsx or progress file .json)",
  "Verarbeitung erfolgt vollständig im Browser (JavaScript, SheetJS). Kein Server-Upload, keine Übertragung von Kundendaten.": "Processing happens entirely in the browser (JavaScript, SheetJS). No server upload, no transfer of customer data.",
  "🖨 Als PDF drucken": "🖨 Print as PDF",
  "Erzeugt über den Browser-Druckdialog ein PDF der kompletten Auswertung (ohne Bedienelemente).": "Creates a PDF of the full analysis via the browser print dialog (without controls).",
  "Hinweis: \"Tier\" bezieht sich hier auf Workload-Schutzklassen und hat nichts mit der Uptime-Institute-Tier-Klassifizierung (Tier I–IV) für physische Rechenzentrums-Infrastruktur zu tun.": "Note: \"Tier\" here refers to workload protection classes and is unrelated to the Uptime Institute tier classification (Tier I–IV) for physical data center infrastructure.",
  "Verteilung nach Schutzklasse": "Distribution by protection class",
  "Abhängigkeitsnetz": "Dependency network",
  "Pfeile zeigen \"hängt ab von\". Orange Kanten = Abhängigkeit ist schwächer klassifiziert als das abhängige System (RTO-Risiko). Knoten ziehbar, Mausrad zum Zoomen. Foundational-Systeme (Tier 0: AD/DNS/DC …) sind standardmäßig ausgeblendet, da sie mit fast allem verbunden sind und die App-zu-App-Sicht überdecken — über den Tier-0-Chip unten zuschaltbar.": "Arrows mean \"depends on\". Orange edges = the dependency is classified weaker than the dependent system (RTO risk). Nodes are draggable; use the mouse wheel to zoom. Foundational systems (Tier 0: AD/DNS/DC …) are hidden by default because they connect to almost everything and obscure the app-to-app view — enable them via the Tier 0 chip below.",
  "🔍 Workload suchen …": "🔍 Search workload …",
  "Isolierte Knoten ausblenden": "Hide isolated nodes",
  "Nur Auffälligkeiten anzeigen": "Show issues only",
  "🔎 Ansicht anpassen": "🔎 Fit view",
  "↺ Filter zurücksetzen": "↺ Reset filters",
  "Befunde": "Findings",
  "Bewusst akzeptierte Befunde bleiben sichtbar (abgeblendet, mit Häkchen) statt zu verschwinden — so geht nichts unter, das im Workshop schon besprochen wurde.": "Consciously accepted findings stay visible (dimmed, with a check mark) instead of disappearing — nothing already discussed in the workshop gets lost.",
  "↺ Alle Bestätigungen zurücksetzen": "↺ Reset all acknowledgements",
  "Weiteres Vorgehen": "Next steps",
  "Workload-Register (Rohdaten)": "Workload register (raw data)",
  "1. Rohliste importieren": "1. Import raw list",
  "Getestet mit RVTools-Exporten (\"vInfo\"-Blatt) und Veeam ONE (Report \"VMs Configuration\" — für vSphere UND Hyper-V, als Excel exportiert; Deckblatt und Titelblock werden automatisch erkannt. Der Veeam-ONE-Report \"Inventory\" ist ein Property-Listen-Format und als Quelle ungeeignet). Weitere Quellen über die generische Spaltenzuordnung: CMDB-/ServiceNow-Listen und CSV. Mehrere Quellen nacheinander importieren ist möglich — neue Workloads werden ergänzt, bei Namensgleichheit fragt ein Duplikat-Dialog nach. Alternativ Daten direkt einfügen. Spalten werden automatisch erkannt; die Zuordnung kann im nächsten Schritt geprüft und korrigiert werden.": "Tested with RVTools exports (\"vInfo\" sheet) and Veeam ONE (report \"VMs Configuration\" — for vSphere AND Hyper-V, exported as Excel; cover sheet and title block are detected automatically. The Veeam ONE \"Inventory\" report is a property-list format and unsuitable as a source). Further sources via the generic column mapping: CMDB/ServiceNow lists and CSV. Importing several sources one after another is supported — new workloads are appended, and a duplicate dialog asks on name collisions. Alternatively, paste data directly. Columns are detected automatically; the mapping can be reviewed and corrected in the next step.",
  "Automatisch vorgeschlagen, bitte prüfen. \"Workload-Name\" ist Pflicht, alle anderen Felder optional. Die Größen-Einheit wird am Spaltennamen erkannt (MiB/MB und TB/TiB werden nach GiB umgerechnet, GB/GiB bleiben unverändert).": "Suggested automatically — please review. \"Workload name\" is mandatory, all other fields optional. The size unit is detected from the column name (MiB/MB and TB/TiB are converted to GiB, GB/GiB stay unchanged).",
  "Kopfzeile ist Zeile": "Header row is row",
  "Duplikate überspringen — nur wirklich neue Workloads übernehmen (empfohlen)": "Skip duplicates — only add genuinely new workloads (recommended)",
  "Leere Felder der vorhandenen Workloads aus der neuen Quelle ergänzen (Bewertungen bleiben unberührt)": "Fill empty fields of the existing workloads from the new source (assessments stay untouched)",
  "Trotzdem zusätzlich anlegen — Achtung: doppelte Namen brechen die Abhängigkeits-Auflösung": "Add anyway — caution: duplicate names break dependency resolution",
  "Weiter →": "Continue →",
  "Abbrechen": "Cancel",
  "📄 Datei hochladen": "📄 Upload file",
  "📋 Text/CSV einfügen": "📋 Paste text/CSV",
  "✏ Ohne Import starten (manuell erfassen)": "✏ Start without import (enter manually)",
  "📂 Fortschritt (JSON) laden": "📂 Load progress (JSON)",
  "📄 Rohdaten-Export hierher ziehen oder klicken (.xlsx, .csv)": "📄 Drag raw export here or click (.xlsx, .csv)",
  "Arbeitsblatt": "Worksheet",
  "Erste Zeile = Spaltenüberschriften. Tab- oder komma-getrennt, z. B. aus Excel kopiert.": "First row = column headers. Tab- or comma-separated, e.g. copied from Excel.",
  "Einlesen →": "Parse →",
  "2. Spalten zuordnen": "2. Map columns",
  "Workloads übernehmen →": "Add workloads →",
  "Templates, SRM-Platzhalter & vSphere-System-VMs (vCLS, Supervisor Control Plane) ausschließen (empfohlen — das sind keine echten, zu schützenden Workloads)": "Exclude templates, SRM placeholders & vSphere system VMs (vCLS, Supervisor Control Plane) (recommended — these are not real workloads to protect)",
  "Als Foundational übernehmen": "Mark as foundational",
  "Verwerfen": "Dismiss",
  "3. Klassifizieren & Abhängigkeiten festlegen": "3. Classify & define dependencies",
  "Für jeden Workload die drei Bewertungskriterien (1–5) setzen — Schutzklasse und Ziel-RPO/RTO werden live berechnet. Recovery-Komplexität (RK) ist eine separate Aufwandseinschätzung und beeinflusst die Schutzklasse nicht. Abhängigkeiten als Workload-Namen eintragen, kommagetrennt (Autovervollständigung mit Tab/Pfeiltasten).": "Set the three assessment criteria (1–5) for each workload — protection class and target RPO/RTO are calculated live. Recovery complexity (RK) is a separate effort estimate and does not influence the protection class. Enter dependencies as workload names, comma-separated (autocomplete via Tab/arrow keys).",
  "💾 Fortschritt speichern": "💾 Save progress",
  "📂 Fortschritt laden": "📂 Load progress",
  "＋ Workload manuell hinzufügen": "＋ Add workload manually",
  "⬇ Als Excel exportieren": "⬇ Export as Excel",
  "🕸 Im Abhängigkeitsnetz ansehen": "🕸 View in dependency network",
  "🔍 Name/Owner/OS suchen …": "🔍 Search name/owner/OS …",
  "Nur unvalidiert": "Unvalidated only",
  "Filter": "Filters",
  "Mehrfachauswahl —": "Bulk edit —",
  "Zeile(n) ausgewählt": "row(s) selected",
  "Zeilen pro Seite": "Rows per page",
  "Alle": "All",
  "Zeilen über die Checkbox links auswählen (Kopfzeile = alle sichtbaren), dann die gewünschten Änderungen auf alle ausgewählten anwenden. \"–\" bzw. \"– nicht ändern –\" lässt das jeweilige Feld unangetastet.": "Select rows using the checkbox on the left (header = all visible), then apply the desired changes to all selected rows. \"–\" or \"– don't change –\" leaves the respective field untouched.",
  "Für": "Apply to", "ausgewählte anwenden:": "selected:",
  "– nicht ändern –": "– don't change –",
  "hinzufügen": "add", "ersetzen": "replace", "entfernen": "remove",
  "Namen oder IDs, kommagetrennt — IDs werden beim Verlassen des Felds zu Namen aufgelöst": "Names or IDs, comma-separated — IDs are resolved to names when leaving the field",
  "→ Pfeil = hängt ab von": "→ arrow = depends on",
  "Hover: durchgezogen = hängt ab von · gestrichelt = wird benötigt von": "Hover: solid = depends on · dashed = required by",
  "Maus über einen Knoten: durchgezogen = dieser Workload hängt ab von · gestrichelt = wird benötigt von · Rest blendet aus": "Mouse over a node: solid = this workload depends on · dashed = required by · the rest fades",
  "Ja setzen": "Set yes", "Nein setzen": "Set no",
  "✕ leeren": "✕ clear",
  "Anwenden": "Apply",
  "Foundational": "Foundational", "Out of Scope": "Out of scope", "Override": "Override",
  "4. Validierung gegen die Originaldatei": "4. Validation against the original file",
  "Unabhängiger Gegencheck vor der Abgabe: eine Quelldatei (RVTools-Export, Veeam-ONE-Report, CMDB-Liste) erneut hochladen. Sie wird wie beim Import gelesen (gleiche Blatt-/Kopfzeilen-Erkennung, gleiche Filter) und nur mit den Workloads verglichen, die aus dieser Datei stammen — weitere Quellen werden als Abdeckung ausgewiesen, nicht als Abweichung. Gemeldet werden fehlende oder zusätzliche Workloads sowie abweichende Größen-, OS- und Cluster-Angaben; bewusst gelöschte Workloads und vom Import ausgeschlossene Zeilen erscheinen als Hinweis. Fehlende lassen sich per Klick nachimportieren. Zusätzlich läuft ein interner Konsistenz-Check (doppelte/leere Namen, nicht auflösbare Abhängigkeiten).": "Independent cross-check before delivery: upload a source file (RVTools export, Veeam ONE report, CMDB list) again. It is read exactly like on import (same sheet/header detection, same filters) and compared only with the workloads that came from this file — other sources are shown as coverage, not as deviations. Reported are missing or extra workloads as well as deviating size, OS and cluster values; deliberately deleted workloads and rows skipped by the import filters appear as notes. Missing workloads can be imported with one click. An internal consistency check (duplicate/empty names, unresolvable dependencies) runs as well.",
  "📄 Originaldatei hierher ziehen oder klicken (.xlsx, .csv)": "📄 Drag original file here or click (.xlsx, .csv)",
  "⚙ Optionen: Klassifizierungsregeln (Namen, Ziel-RPO/RTO & Schwellenwerte anpassen)": "⚙ Options: classification rules (adjust names, target RPO/RTO & thresholds)",
  "Diese Werte gelten für die automatische Berechnung unten und lassen sich frei an kundenspezifische Vorgaben anpassen. Unabhängig davon kann bei jedem einzelnen Workload die Schutzklasse manuell überschrieben werden (Spalte \"Override\" in der Tabelle unten). Der \"Anzeigename\" ist rein kosmetisch für diese Sitzung/diesen Export — der interne Schlüssel (und damit Rang/Reihenfolge sowie das, was beim erneuten Hochladen in Tab ② erkannt wird) bleibt unverändert.": "These values drive the automatic calculation below and can be adapted freely to customer-specific requirements. Independently, the protection class of each individual workload can be overridden manually (\"Override\" column in the table below). The \"display name\" is purely cosmetic for this session/export — the internal key (and thus rank/order and what is recognized when re-uploading in tab ②) remains unchanged.",
  "↺ Auf Standardwerte zurücksetzen": "↺ Reset to defaults",
  "❓ Woher kommt dieses Berechnungsmodell?": "❓ Where does this scoring model come from?",
  "Die gewichtete Multi-Kriterien-Bewertung (Business Impact 45 % / Regulatorik 35 % / Datensensitivität 20 %) folgt etablierter BIA-Praxis. Rahmenwerke wie ISO 22301/22317, BSI-Standard 200-4, NIST SP 800-34 oder die BCI Good Practice Guidelines fordern Auswirkungskriterien und Kritikalitätsklassen mit RTO/RPO-Zielen, geben aber bewusst keine Formel, Gewichte oder Schwellenwerte vor — auch DORA und NIS2 nicht. Die Vorgaben hier sind daher eine Kalibrierung als Startpunkt: Bei einheitlicher Bewertung x/x/x ergibt der Score exakt x, die Schwellen liegen an den natürlichen Mittelpunkten (2,5 und 3,5); nur die Platinum-Grenze ist auf 4,3 abgesenkt, damit starke Profile mit überwiegend Fünfen (z. B. 5/4/4 = 4,45) Platinum erreichen, eine glatte 4/4/4 aber Gold bleibt. Recovery-Komplexität fließt bewusst nicht in den Score ein (Aufwand ist nicht Kritikalität). Wichtig: Dieses Modell ist eine Hilfestellung für den Workshop, kein vorgegebener Standard — die verbindliche Eichung von Gewichten, Schwellen und Zielen gehört dem Kunden und sollte dokumentiert werden.": "The weighted multi-criteria scoring (business impact 45% / regulatory 35% / data sensitivity 20%) follows established BIA practice. Frameworks such as ISO 22301/22317, BSI Standard 200-4, NIST SP 800-34 and the BCI Good Practice Guidelines require impact criteria and criticality classes with RTO/RPO targets, but deliberately prescribe no formula, weights or thresholds — nor do DORA and NIS2. The values here are therefore a calibration meant as a starting point: with a uniform rating of x/x/x the score equals exactly x, and the thresholds sit at the natural midpoints (2.5 and 3.5); only the Platinum boundary is lowered to 4.3 so that strong profiles dominated by fives (e.g. 5/4/4 = 4.45) reach Platinum while a flat 4/4/4 remains Gold. Recovery complexity is deliberately excluded from the score (effort is not criticality). Important: this model is guidance for the workshop, not a prescribed standard — the binding calibration of weights, thresholds and targets belongs to the customer and should be documented.",
  "↺ Neu berechnen (manuelle Reihenfolgen verwerfen)": "↺ Recalculate (discard manual ordering)",
  "↩ Letzte Gruppen-Zuweisung rückgängig": "↩ Undo last group assignment",
  "Runbook-Gruppen (Vorschlag für Veeam Recovery Orchestrator)": "Runbook groups (proposal for Veeam Recovery Orchestrator)",
  "Auf Basis der erfassten Abhängigkeiten werden zusammenhängende Systeme zu Gruppen zusammengefasst — jede Gruppe ist ein Kandidat für einen eigenen VRO Orchestration Plan. Die Startreihenfolge wird automatisch vorgeschlagen (wovon andere abhängen, startet zuerst) und lässt sich pro System über das Nummern-Feld übersteuern. Foundational-Systeme (AD/DNS/DC, Tier 0) bilden einen eigenen Block — im DR-Fall ein eigener Recovery Plan, der immer vor allen Service-Plänen startet. Optional lassen sie sich zusätzlich in jeder Gruppe einblenden, wenn das Runbook-Dokument in sich vollständig sein soll; für DataLab-Tests wird die Foundation stattdessen als Lab Group abgebildet (siehe Hinweis am Foundation-Block).": "Based on the recorded dependencies, related systems are combined into groups — each group is a candidate for its own VRO orchestration plan. The start order is proposed automatically (what others depend on starts first) and can be overridden per system via the number field. Foundational systems (AD/DNS/DC, Tier 0) form their own block — in a DR event a dedicated recovery plan that always starts before all service plans. Optionally they can additionally be shown in every group when the runbook document should be self-contained; for DataLab tests, the foundation is modeled as a lab group instead (see the note at the foundation block).",
  "Foundational-Systeme (Tier 0: AD/DNS/DC …) in jeder Gruppe mit einblenden (für in sich vollständige Runbook-Dokumente — DataLab-Tests nutzen stattdessen Lab Groups)": "Show foundational systems (Tier 0: AD/DNS/DC …) in every group (for self-contained runbook documents — DataLab tests use lab groups instead)",
  "Wiederherstellen": "Restore",
  // dynamic, variable-free texts (table headers, chips, badges, tooltips)
  "#": "#", "Name": "Name", "Team / Owner": "Team / Owner", "Typ": "Type", "OS": "OS",
  "Standort/Cluster": "Location/Cluster", "Größe (GiB)": "Size (GiB)", "Notiz": "Note",
  "Foundational?": "Foundational?", "Out of Scope (kein Backup)?": "Out of scope (no backup)?",
  "Abhängig von Foundation?": "Depends on foundation?",
  "Business Impact": "Business impact", "Regulatorik": "Regulatory", "Datensensitivität": "Data sensitivity",
  "Recovery-Komplexität": "Recovery complexity", "Schutzklasse": "Protection class",
  "Business Impact (BI)": "Business impact (BI)", "Regulatorik (Reg)": "Regulatory (Reg)",
  "Datensensitivität (DS)": "Data sensitivity (DS)", "Recovery-Komplexität (RK)": "Recovery complexity (RK)",
  "Vom Kunden validiert?": "Validated by customer?", "Ist-RPO (h)": "Actual RPO (h)", "Ist-RTO (h)": "Actual RTO (h)",
  "Abhängig von (IDs oder Namen, kommagetrennt)": "Depends on (IDs or names, comma-separated)",
  "Wird benötigt von": "Required by", "Verantwortlicher": "Responsible person", "E-Mail": "Email",
  "Owner": "Owner", "Klasse": "Class", "Ziel-RPO": "Target RPO", "Ziel-RTO": "Target RTO", "Abhängig von": "Depends on",
  "– unbewertet –": "– unrated –", "Out of Scope (kein Backup)": "Out of scope (no backup)",
  "manuell": "manual", "Foundation eingeblendet": "foundation shown",
  "– automatisch –": "– automatic –", "– alle –": "– all –", "(leer)": "(empty)",
  "Gesamt Workloads": "Total workloads", "Anzahl Workloads": "Number of workloads",
  "schwächere Abhängigkeit": "weaker dependency", "implizite Foundation-Abhängigkeit": "implicit foundation dependency",
  "Start-Nr.": "Start no.", "Hängt ab von (in dieser Gruppe)": "Depends on (within this group)",
  "Foundation-Block (startet immer zuerst)": "Foundation block (always starts first)",
  "Einzelsysteme (keine erfassten Abhängigkeiten)": "Standalone systems (no recorded dependencies)",
  "Interner Schlüssel": "Internal key", "Anzeigename": "Display name",
  "Score ab (automatische Einstufung)": "Score from (automatic classification)",
  "Ziel-RPO (Anzeige)": "Target RPO (display)", "Ziel-RTO (Anzeige)": "Target RTO (display)",
  "Ziel-RPO (h)": "Target RPO (h)", "Ziel-RTO (h)": "Target RTO (h)",
  "Empfohlene Veeam/VRO-Konfiguration": "Recommended Veeam/VRO configuration",
  "– (über \"Foundational Dependency\" gesteuert)": "– (controlled via \"Foundational Dependency\")",
  "Workload-Name": "Workload name", "Typ (VM/Physical/DB/SaaS/Cloud)": "Type (VM/Physical/DB/SaaS/Cloud)",
  "Betriebssystem": "Operating system", "Größe (GiB) — Einheit wird am Spaltennamen erkannt": "Size (GiB) — unit detected from the column name",
  "Verantwortlicher (Person)": "Responsible person", "Verantwortlicher E-Mail": "Responsible person email",
  "Quelle / Notiz": "Source / note", "— nicht zuordnen —": "— do not map —",
  "Hinweis": "Note",
  // Tooltips (dynamisch erzeugt)
  "Alle sichtbaren auswählen / erneut klicken zum Abwählen": "Select all visible / click again to deselect",
  "Feste Person (nicht Team) — Ansprechpartner/Eskalation für VRO-Runbooks.": "A specific person (not a team) — contact/escalation for VRO runbooks.",
  "E-Mail des Verantwortlichen. Ungültiges Format wird orange markiert (blockiert nichts).": "Email of the responsible person. Invalid format is highlighted orange (does not block anything).",
  "Workload wird absichtlich NICHT gesichert/klassifiziert (z. B. anderweitig gesichert, wird stillgelegt, vertraglich ausgeschlossen). Hat Vorrang vor Override und automatischer Berechnung.": "Workload is intentionally NOT protected/classified (e.g. protected elsewhere, being decommissioned, contractually excluded). Takes precedence over override and automatic calculation.",
  "Standard: ja. Nur abhaken bei Systemen, die auch ohne AD/DNS/DC funktionieren (OT, Appliances mit lokaler Auth, isolierte Inseln). Steuert die impliziten Kanten im Abhängigkeitsnetz.": "Default: yes. Only untick for systems that work without AD/DNS/DC (OT, appliances with local auth, isolated islands). Controls the implicit edges in the dependency network.",
  "Business Impact: wie stark trifft ein Ausfall das Geschäft (Umsatz, Kunden, Reputation)?": "Business impact: how severely does an outage affect the business (revenue, customers, reputation)?",
  "Regulatorik: wie stark unterliegt das System regulatorischen Pflichten (DORA, NIS2, ISO 27001, PII)?": "Regulatory: how strongly is the system subject to regulatory obligations (DORA, NIS2, ISO 27001, PII)?",
  "Datensensitivität: wie sensibel sind die verarbeiteten Daten?": "Data sensitivity: how sensitive is the processed data?",
  "Recovery-Komplexität: wie aufwändig ist die technische Wiederherstellung? Fließt NICHT in die Schutzklasse ein, nur zur Aufwandseinschätzung.": "Recovery complexity: how complex is the technical recovery? Does NOT influence the protection class — effort estimate only.",
  "Aktueller Ist-Wert in Stunden. 0 = CDP/kontinuierlich, leer = nicht erhoben. Rot = schlechter als das Klassen-Ziel.": "Current actual value in hours. 0 = CDP/continuous, empty = not surveyed. Red = worse than the class target.",
  "Aktueller Ist-Wert in Stunden. 0 = sofort, leer = nicht erhoben. Rot = schlechter als das Klassen-Ziel.": "Current actual value in hours. 0 = immediate, empty = not surveyed. Red = worse than the class target.",
  "IDs oder Namen, kommagetrennt. Beim Verlassen des Feldes werden IDs automatisch zu Namen aufgelöst.": "IDs or names, comma-separated. IDs are resolved to names automatically when leaving the field.",
  "Automatisch ermittelt: welche anderen Workloads hängen von diesem ab": "Determined automatically: which other workloads depend on this one",
  "Sortiert nach Rang (Tier 0 zuerst), nicht alphabetisch": "Sorted by rank (Tier 0 first), not alphabetically",
  "Sortiert nach Anzahl": "Sorted by count",
  "Automatisch ermittelt: welche anderen Workloads hängen von diesem ab. Sortiert nach Anzahl.": "Determined automatically: which other workloads depend on this one. Sorted by count.",
  "Numerisches Ziel in Stunden für die automatische Gap-Prüfung. 0 = CDP/kontinuierlich.": "Numeric target in hours for the automatic gap check. 0 = CDP/continuous.",
  "Numerisches Ziel in Stunden für die automatische Gap-Prüfung.": "Numeric target in hours for the automatic gap check.",
  "Foundational-Systeme sind standardmäßig ausgeblendet (hängen mit fast allem zusammen) — zum Einblenden anklicken.": "Foundational systems are hidden by default (they connect to almost everything) — click to show.",
  "Gruppenname — leer lassen für den automatischen Vorschlag": "Group name — leave empty for the automatic suggestion",
  "Vor- u. Nachname": "First and last name",
  "Sieht nicht wie eine gültige E-Mail-Adresse aus": "Does not look like a valid email address"
};

function normKey(s) { return s.replace(/\s+/g, ' ').trim(); }

// Translates text nodes + title/placeholder attributes below root using the dictionary.
// Renders always produce fresh German; with LANG=en, run over it once afterwards.
// Replaces the node content completely but preserves leading/trailing whitespace.
// IMPORTANT: no orig.replace(key, …). With multi-line text nodes (line break + indentation in the
// HTML) the normalized key does not occur literally in the original and the replacement fails
// silently. Exactly that left long paragraphs untranslated.
function i18nSwapText(node, orig, translation) {
  const lead = (orig.match(/^\s*/) || [''])[0];
  const trail = (orig.match(/\s*$/) || [''])[0];
  node.nodeValue = lead + translation + (lead === orig ? '' : trail);
}

function i18nApply(root) {
  if (LANG !== 'en' || !root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const p = n.parentElement;
    if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE')) continue;
    const key = normKey(n.nodeValue || '');
    if (key && STATIC_I18N[key] !== undefined) i18nSwapText(n, n.nodeValue, STATIC_I18N[key]);
  }
  root.querySelectorAll('[title], [placeholder]').forEach(el => {
    ['title', 'placeholder'].forEach(attr => {
      const v = el.getAttribute(attr);
      if (!v) return;
      const key = normKey(v);
      if (STATIC_I18N[key] !== undefined) el.setAttribute(attr, STATIC_I18N[key]);
    });
  });
}

// Static HTML: remember the originals so the way back EN -> DE works
const i18nTextOriginals = new WeakMap();
const i18nAttrOriginals = new WeakMap();
function translateStaticDom() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const p = n.parentElement;
    if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE')) continue;
    if (!i18nTextOriginals.has(n)) i18nTextOriginals.set(n, n.nodeValue);
    const orig = i18nTextOriginals.get(n);
    const key = normKey(orig || '');
    if (!key) continue;
    if (LANG === 'en' && STATIC_I18N[key] !== undefined) i18nSwapText(n, orig, STATIC_I18N[key]);
    else n.nodeValue = orig;
  }
  document.querySelectorAll('[title], [placeholder]').forEach(el => {
    if (!i18nAttrOriginals.has(el)) {
      i18nAttrOriginals.set(el, { title: el.getAttribute('title'), placeholder: el.getAttribute('placeholder') });
    }
    const orig = i18nAttrOriginals.get(el);
    ['title', 'placeholder'].forEach(attr => {
      if (orig[attr] === null || orig[attr] === undefined) return;
      const key = normKey(orig[attr]);
      if (LANG === 'en' && STATIC_I18N[key] !== undefined) el.setAttribute(attr, STATIC_I18N[key]);
      else el.setAttribute(attr, orig[attr]);
    });
  });
  document.title = 'DR Workload Classification';
  document.documentElement.lang = LANG; // screen readers/spell checkers follow the UI language
}

function applyLanguage() {
  translateStaticDom();
  // rebuild the dynamic views (they render fresh German, the i18nApply hooks then translate)
  renderOptionsTable();
  if (collectState.items.length) renderCollectTable();
  if (currentViewItems && currentViewItems.length) renderAll(currentViewItems);
  if (!document.getElementById('tab-runbook').classList.contains('hidden')) renderRunbookTab();
  renderAutosaveBannerText(); // otherwise a visible restore banner would not switch language
  if (typeof renderPrequalCatalog === 'function') renderPrequalCatalog(); // tr() column headers of the catalog
  if (typeof updatePrequalQuotaNote === 'function') updatePrequalQuotaNote();
  if (typeof renderCollectColumnPicker === 'function') renderCollectColumnPicker(); // tr() labels of the column chooser
  if (typeof renderAboutChangelog === 'function') renderAboutChangelog(); // Button-Text des Versionsverlaufs
}

document.getElementById('btn-lang-toggle').addEventListener('click', () => {
  // Class definitions are data: if they still exactly match the defaults of the OLD language
  // (nothing adjusted), they switch to the new language as well. Custom values stay.
  const wasUnmodified = JSON.stringify(CLASS_DEFS) === JSON.stringify(defaultClassDefs());
  LANG = LANG === 'de' ? 'en' : 'de';
  try { localStorage.setItem(LANG_KEY, LANG); } catch (e) { /* non-fatal */ }
  if (wasUnmodified) CLASS_DEFS = defaultClassDefs();
  applyLanguage();
});

// ---------------- About-Dialog + Versionsanzeige ----------------
document.getElementById('statusbar-version').textContent = TOOL_VERSION;
document.getElementById('statusbar-repo').href = REPO_URL; document.getElementById('statusbar-repo').title = REPO_URL;
document.getElementById('about-version').textContent = TOOL_VERSION;
// Release notes (v0.13.0): About shows the whole history (newest entry open), the welcome modal
// only the newest entry. Contents are data (English), hence no tr().
function changelogEntryHtml(e, open) {
  return '<details class="changelog-entry"' + (open ? ' open' : '') + '><summary><strong>' + escapeHtml(e.v) + '</strong> · ' + escapeHtml(e.date) + '</summary>' +
    '<ul>' + e.notes.map(n => '<li>' + escapeHtml(n) + '</li>').join('') + '</ul></details>';
}
// About: only the current release visible, older entries behind a click (otherwise About becomes a
// scroll page and the disclaimer part slides out of view). Rebuilt on a language switch.
function renderAboutChangelog() {
  const box = document.getElementById('about-changelog');
  if (!box) return;
  const older = CHANGELOG.slice(1);
  const showLabel = () => tr('Versionsverlauf anzeigen (' + older.length + ' weitere)', 'Show version history (' + older.length + ' more)');
  box.innerHTML = changelogEntryHtml(CHANGELOG[0], true) +
    (older.length
      ? '<button class="btn-ghost" id="btn-changelog-history" style="margin:6px 0 2px;">' + showLabel() + '</button>' +
        '<div id="about-changelog-history" class="hidden">' + older.map(e => changelogEntryHtml(e, false)).join('') + '</div>'
      : '');
  const btn = document.getElementById('btn-changelog-history');
  if (btn) btn.addEventListener('click', () => {
    const hist = document.getElementById('about-changelog-history');
    const nowHidden = hist.classList.toggle('hidden');
    btn.textContent = nowHidden ? showLabel() : tr('Verlauf ausblenden', 'Hide history');
  });
}
renderAboutChangelog();
document.getElementById('welcome-changelog').innerHTML = CHANGELOG[0].notes.map(n => '<li>' + escapeHtml(n) + '</li>').join('');
// Embedded libraries with LIVE version (fflate exports no version; constant from the license banner)
document.getElementById('about-libs').textContent =
  'SheetJS Community Edition ' + (typeof XLSX !== 'undefined' && XLSX.version ? XLSX.version : '') + ' (Apache-2.0) · ' +
  'Chart.js ' + (typeof Chart !== 'undefined' && Chart.version ? Chart.version : '') + ' (MIT) · ' +
  'D3.js ' + (typeof d3 !== 'undefined' && d3.version ? d3.version : '') + ' (ISC) · fflate 0.8.2 (MIT)';
document.querySelectorAll('[data-about-open]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('about-overlay').classList.add('open');
  });
});
document.getElementById('btn-about-close').addEventListener('click', () => {
  document.getElementById('about-overlay').classList.remove('open');
});
document.getElementById('about-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open'); // a click on the backdrop closes
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.getElementById('about-overlay').classList.remove('open');
});

// Beim Laden: gespeicherte Sprachwahl anwenden
if (LANG === 'en') {
  window.addEventListener('DOMContentLoaded', () => applyLanguage());
}
