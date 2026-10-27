import { describe, expect, it } from 'vitest';
import { LIBRARY_COLUMN_MIN_PX, openLibraryRow, panelRecords, panelShowsIndex, selectMapPin } from './libraryDetail';

const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n'];

describe('library detail', () => {
  it('opens a list row on the map, centered on that transient', () => {
    expect(openLibraryRow('place-13')).toEqual({ view: 'map', selectedId: 'place-13', focusId: 'place-13' });
  });

  it('selects a map dot without leaving the map', () => {
    expect(selectMapPin('place-13')).toEqual({ selectedId: 'place-13' });
  });

  it('keeps the index beside the map on a wide screen', () => {
    expect(LIBRARY_COLUMN_MIN_PX).toBe(840);
    expect(panelShowsIndex(840)).toBe(true);
    expect(panelShowsIndex(1100)).toBe(true);
    expect(panelRecords(1100, ids, 'n')).toEqual({ index: ids, detailId: 'n' });
  });

  it('leads the phone sheet with the opened transient instead of the whole library', () => {
    expect(panelShowsIndex(390)).toBe(false);
    expect(panelShowsIndex(839)).toBe(false);
    const panel = panelRecords(390, ids, 'n');
    expect(panel.index).toEqual([]);
    expect(panel.detailId).toBe('n');
  });
});
