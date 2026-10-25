import { describe, expect, it } from 'vitest';
import { captureLabel, capturedToast, capturedToPhotos, capturedUnshared, capturePending, emptyLibrary, importedLabel, libraryShareLabel, sharedWithLabel } from './actions';

describe('capture wording', () => {
  it('names the action Capture in the button, the toast, and the map', () => {
    expect(captureLabel).toBe('Capture');
    expect(sharedWithLabel).toBe('Shared with (optional)');
    expect(capturedToast).toBe('Captured');
    expect(capturedUnshared).toBe('Captured · not shared');
    expect(capturedToPhotos).toBe('Captured to Photos');
    expect(capturePending).toBe('Capturing the image runs in the browser.');
    expect(emptyLibrary).toBe('Nothing captured yet.');
    expect(importedLabel(1)).toBe('Imported 1 transient');
    expect(importedLabel(3)).toBe('Imported 3 transients');
    expect(libraryShareLabel([])).toBe(capturedUnshared);
    expect(libraryShareLabel([{ recipient: 'Ada' }])).toBe('Shared with Ada');
    expect(libraryShareLabel([{ recipient: 'Ada' }, { address: 'Bea' }])).toBe('Shared with Ada, Bea');
  });
});
