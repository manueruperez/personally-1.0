/**
 * Auditoría de matching CSV → catálogo de ejercicios.
 *
 * Para cada nombre único de ejercicio en un CSV de rutina, reporta:
 *   - EXACT      → matchea exacto contra `nameEs` (lo que hace el importer)
 *   - CI         → solo matchea case-insensitive (se crearía como custom)
 *   - NORMALIZED → solo matchea normalizando (sin acentos, sin paréntesis)
 *   - CONTAINS   → solo hay match parcial (contains) en EN o ES
 *   - NONE       → no hay ningún match
 *
 * Además, para cada match indica si el ejercicio del catálogo tiene `imageUrl`.
 *
 * Read-only: no modifica la DB.
 *
 * Ejecución:
 *   pnpm --filter @personally/db exec tsx src/scripts/audit-csv-catalog.ts [path/al/csv]
 *
 * Default CSV: ../../samples/rutina-demo-12-semanas.csv
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Carga vars del .env del root del monorepo si Prisma no encuentra DATABASE_URL.
// Necesario cuando `pnpm --filter @personally/db exec` cambia cwd al subpackage.
if (!process.env.DATABASE_URL) {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const txt = readFileSync(p, 'utf-8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1]!;
      let val = m[2]!;
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
    break;
  }
}

const { prisma } = await import('../index.js');

const DEFAULT_CSV = resolve(
  process.cwd(),
  '../../samples/rutina-demo-12-semanas.csv',
);

type MatchKind = 'EXACT' | 'CI' | 'NORMALIZED' | 'CONTAINS' | 'NONE';

interface MatchedExercise {
  id: string;
  nameEs: string;
  nameEn: string | null;
  source: string;
  hasImage: boolean;
}

interface AuditEntry {
  csvName: string;
  occurrences: number;
  kind: MatchKind;
  match: MatchedExercise | null;
  candidates?: MatchedExercise[]; // para CONTAINS / debug
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // quitar (paréntesis)
    .replace(/[\/\-_]/g, ' ') // slashes / guiones → espacio
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCsvExerciseColumn(content: string): string[] {
  // Parser simple: el CSV demo no tiene comas embebidas ni quotes.
  // Asumimos que la columna `Exercise` es la 4ª (índice 3).
  const lines = content.split(/\r?\n/);
  const header = lines[0]?.split(',').map((c) => c.trim()) ?? [];
  const exIdx = header.indexOf('Exercise');
  if (exIdx === -1) throw new Error('Columna "Exercise" no encontrada');

  const out: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.trim()) continue;
    const cols = line.split(',');
    const name = cols[exIdx]?.trim();
    if (name) out.push(name);
  }
  return out;
}

async function main() {
  const csvPath = process.argv[2] ?? DEFAULT_CSV;
  console.log(`📄 CSV: ${csvPath}`);

  const content = readFileSync(csvPath, 'utf-8');
  const allNames = parseCsvExerciseColumn(content);
  const counts = new Map<string, number>();
  for (const n of allNames) counts.set(n, (counts.get(n) ?? 0) + 1);

  const uniqueNames = Array.from(counts.keys());
  console.log(`   ${allNames.length} filas, ${uniqueNames.length} nombres únicos\n`);

  // Cargar TODO el catálogo (es ~800 filas, no es caro)
  const catalog = await prisma.exercise.findMany({
    select: {
      id: true,
      nameEs: true,
      nameEn: true,
      source: true,
      imageUrl: true,
    },
  });

  // Índices para lookup rápido
  const byExact = new Map<string, MatchedExercise>();
  const byCI = new Map<string, MatchedExercise>();
  const byNormalized = new Map<string, MatchedExercise>();

  for (const ex of catalog) {
    const m: MatchedExercise = {
      id: ex.id,
      nameEs: ex.nameEs,
      nameEn: ex.nameEn,
      source: ex.source,
      hasImage: !!ex.imageUrl,
    };
    // EXACT: nameEs tal cual
    if (!byExact.has(ex.nameEs)) byExact.set(ex.nameEs, m);
    // CI: lowercase de nameEs y nameEn
    const ciEs = ex.nameEs.toLowerCase();
    const ciEn = ex.nameEn?.toLowerCase();
    if (!byCI.has(ciEs)) byCI.set(ciEs, m);
    if (ciEn && !byCI.has(ciEn)) byCI.set(ciEn, m);
    // NORMALIZED: sin acentos, sin paréntesis
    const nEs = normalize(ex.nameEs);
    const nEn = ex.nameEn ? normalize(ex.nameEn) : '';
    if (nEs && !byNormalized.has(nEs)) byNormalized.set(nEs, m);
    if (nEn && !byNormalized.has(nEn)) byNormalized.set(nEn, m);
  }

  const audit: AuditEntry[] = [];

  for (const name of uniqueNames) {
    const occurrences = counts.get(name)!;
    const exact = byExact.get(name);
    if (exact) {
      audit.push({ csvName: name, occurrences, kind: 'EXACT', match: exact });
      continue;
    }
    const ci = byCI.get(name.toLowerCase());
    if (ci) {
      audit.push({ csvName: name, occurrences, kind: 'CI', match: ci });
      continue;
    }
    const norm = byNormalized.get(normalize(name));
    if (norm) {
      audit.push({ csvName: name, occurrences, kind: 'NORMALIZED', match: norm });
      continue;
    }
    // CONTAINS: tokens del nombre normalizado dentro de algún catálogo
    const tokens = normalize(name)
      .split(' ')
      .filter((t) => t.length >= 4); // ignora "de", "con", etc.
    const candidates: MatchedExercise[] = [];
    if (tokens.length > 0) {
      for (const ex of catalog) {
        const hay = normalize(ex.nameEs) + ' ' + (ex.nameEn ? normalize(ex.nameEn) : '');
        const hitCount = tokens.filter((t) => hay.includes(t)).length;
        if (hitCount === tokens.length) {
          candidates.push({
            id: ex.id,
            nameEs: ex.nameEs,
            nameEn: ex.nameEn,
            source: ex.source,
            hasImage: !!ex.imageUrl,
          });
          if (candidates.length >= 5) break;
        }
      }
    }
    if (candidates.length > 0) {
      audit.push({
        csvName: name,
        occurrences,
        kind: 'CONTAINS',
        match: null,
        candidates,
      });
      continue;
    }
    audit.push({ csvName: name, occurrences, kind: 'NONE', match: null });
  }

  // Resumen
  const summary = {
    totalRows: allNames.length,
    uniqueNames: uniqueNames.length,
    byKind: {
      EXACT: 0,
      CI: 0,
      NORMALIZED: 0,
      CONTAINS: 0,
      NONE: 0,
    },
    withImage: {
      EXACT: 0,
      CI: 0,
      NORMALIZED: 0,
    },
    rowsWithImage: 0, // suma ponderada por occurrences
    rowsWithoutImage: 0,
  };

  for (const e of audit) {
    summary.byKind[e.kind]++;
    if (e.match) {
      if (e.kind === 'EXACT' || e.kind === 'CI' || e.kind === 'NORMALIZED') {
        if (e.match.hasImage) {
          (summary.withImage as Record<string, number>)[e.kind]++;
        }
      }
    }
    // Para "rowsWithImage" sólo cuentan los que matchearían con el importer actual = EXACT
    if (e.kind === 'EXACT' && e.match?.hasImage) {
      summary.rowsWithImage += e.occurrences;
    } else {
      summary.rowsWithoutImage += e.occurrences;
    }
  }

  console.log('═══ RESUMEN ═══');
  console.log(JSON.stringify(summary, null, 2));
  console.log();

  // Detalle agrupado por kind
  const order: MatchKind[] = ['NONE', 'CONTAINS', 'NORMALIZED', 'CI', 'EXACT'];
  for (const kind of order) {
    const items = audit.filter((a) => a.kind === kind);
    if (items.length === 0) continue;
    console.log(`\n═══ ${kind} (${items.length}) ═══`);
    items
      .sort((a, b) => b.occurrences - a.occurrences)
      .forEach((e) => {
        const img =
          e.match?.hasImage === true
            ? '🖼️ '
            : e.match?.hasImage === false
              ? '   '
              : '   ';
        const xN = `×${e.occurrences}`.padStart(5);
        const head = `  ${img}${xN}  "${e.csvName}"`;
        if (e.match) {
          console.log(
            `${head}  →  [${e.match.source}] ${e.match.nameEs}${
              e.match.nameEn && e.match.nameEn !== e.match.nameEs
                ? ` (en: ${e.match.nameEn})`
                : ''
            }`,
          );
        } else if (e.candidates && e.candidates.length > 0) {
          console.log(head);
          for (const c of e.candidates) {
            const cImg = c.hasImage ? '🖼️ ' : '   ';
            console.log(
              `         ${cImg}    ↳ [${c.source}] ${c.nameEs}${
                c.nameEn && c.nameEn !== c.nameEs ? ` (en: ${c.nameEn})` : ''
              }`,
            );
          }
        } else {
          console.log(head);
        }
      });
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
