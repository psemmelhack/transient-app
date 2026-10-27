/** At this width the library index sits beside the map. Below it, the phone sheet is only the opened transient. */
export const LIBRARY_COLUMN_MIN_PX = 840;

export type LibraryView = 'map' | 'list';

export function panelShowsIndex(width: number): boolean {
  return width >= LIBRARY_COLUMN_MIN_PX;
}

/** A list row opens the map on that transient and asks the map to center there. */
export function openLibraryRow(id: string): { view: 'map'; selectedId: string; focusId: string } {
  return { view: 'map', selectedId: id, focusId: id };
}

/** A map dot selects the transient already on the map. */
export function selectMapPin(id: string): { selectedId: string } {
  return { selectedId: id };
}

/**
 * What the side panel lists. On a phone the index is omitted so the opened
 * transient is not pushed below the sheet by the rest of the library.
 */
export function panelRecords(width: number, ids: string[], selectedId: string | null): { index: string[]; detailId: string | null } {
  return {
    index: panelShowsIndex(width) ? ids : [],
    detailId: selectedId,
  };
}
