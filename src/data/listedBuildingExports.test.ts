import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const exportsByProject = {
  'alloa-scotland': 91,
  'alva-scotland': 7,
  'culross-scotland': 127,
  'kincardine-on-forth-scotland': 57,
  'tillicoultry-scotland': 13,
  'quarriers-village-scotland': 12,
  'biggar-scotland': 108,
  'killin-scotland': 26,
};

describe('listed-building CSV exports', () => {
  it('provides one Excel-friendly, deduplicated statutory register for every published town', async () => {
    for (const [projectId, expectedRows] of Object.entries(exportsByProject)) {
      const contents = await readFile(
        resolve('data/exports', `${projectId}-listed-buildings.csv`),
        'utf8',
      );
      const rows = contents.trim().split(/\r?\n/);
      expect(rows[0].replace(/^\uFEFF/, '')).toContain('hes_designation_reference');
      expect(rows).toHaveLength(expectedRows + 1);
      const references = rows.slice(1).map((row) => row.split(',')[3].replaceAll('"', ''));
      expect(new Set(references).size).toBe(expectedRows);
    }
  });
});
