import { describe, expect, it } from 'vitest';
import { extractHistoricEnglandDate } from './historicDateExtraction';

describe('Historic England date extraction', () => {
  it('extracts a hyphenated qualified century from Scottish designation wording', () => {
    expect(extractHistoricEnglandDate('Mid 19th-century. Single storey irregular-plan gabled villa.')).toEqual({
      evidenceText: 'Mid 19th-century',
      earliestPossibleYear: 1830,
      latestPossibleYear: 1869,
      datePrecision: 'part century',
      dateBasis: 'estimated_from_authoritative_source',
      dateConfidence: 'medium',
    });
  });

  it.each([
    ['Dated 1671. Restored 1929.', 1671, 1671, 'documented_construction'],
    ['Signal box. Built in 1894 by the Great Northern Railway.', 1894, 1894, 'documented_construction'],
    ['Mainly circa 1300 or early C14. Restored in 1875.', 1300, 1300, 'estimated_from_authoritative_source'],
    ['Late Cl7/early C18 house.', 1660, 1739, 'estimated_from_authoritative_source'],
    ['Built by Peter Mills (1653-6).', 1653, 1656, 'documented_date_range'],
    ['Open air swimming pools. Designed 1936 by a committee of honorary architects.', 1936, 1936, 'documented_construction'],
    ['A medieval tower built around AD 1300.', 1300, 1300, 'documented_construction'],
    ['II 2. 1842. W J Donthorne, architect. Norman style.', 1842, 1842, 'documented_construction'],
    ['Building: Roman Catholic church. Date: 1895-1896.', 1895, 1896, 'documented_date_range'],
    ['Built in 1894. Interlocking had been completed in 1892.', 1894, 1894, 'documented_construction'],
    ['Mainly circa 1150. Mid C12 nave with reset early C9 carved stones.', 1150, 1150, 'estimated_from_authoritative_source'],
  ])('normalises %s', (text, earliest, latest, basis) => {
    expect(extractHistoricEnglandDate(text)).toMatchObject({
      earliestPossibleYear: earliest,
      latestPossibleYear: latest,
      dateBasis: basis,
    });
  });

  it('does not treat restoration and listing administration as construction evidence', () => {
    expect(extractHistoricEnglandDate('Listed 7.2.52. Restored 1929.')).toBeUndefined();
    expect(extractHistoricEnglandDate('This list entry was amended on 02/05/2018.')).toBeUndefined();
  });

  it('uses an official archaeological period only when no more precise date is stated', () => {
    expect(extractHistoricEnglandDate('A Bronze Age post alignment and timber platform.')).toMatchObject({
      earliestPossibleYear: -2500,
      latestPossibleYear: -801,
      datePrecision: 'archaeological period',
    });
  });

  it('does not infer a Roman date from a building name alone', () => {
    expect(extractHistoricEnglandDate('Roman Catholic church with no construction date.')).toBeUndefined();
  });

  it('preserves BC and AD qualifiers in archaeological ranges', () => {
    expect(extractHistoricEnglandDate('The fort was in use between about 1200 BC and 1100 AD.')).toMatchObject({
      earliestPossibleYear: -1200,
      latestPossibleYear: 1100,
      datePrecision: 'archaeological date range',
    });
  });

  it('does not mistake an excavation date for the monument date', () => {
    expect(extractHistoricEnglandDate('A prehistoric burial cairn. Nineteenth century excavations revealed a cist.')).toMatchObject({
      earliestPossibleYear: -10000,
      latestPossibleYear: 42,
      datePrecision: 'broad historic period',
    });
  });
});
