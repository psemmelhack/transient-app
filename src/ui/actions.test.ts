import { describe, expect, it } from 'vitest';
import { captureLabel, capturedToast, capturedToPhotos, capturedUnshared, capturePending, emptyLibrary } from './actions';

describe('capture wording', () => {
  it('names the action Capture in the button, the toast, and the map', () => {
    expect(captureLabel).toBe('Capture');
    expect(capturedToast).toBe('Captured');
    expect(capturedUnshared).toBe('Captured · not shared');
    expect(capturedToPhotos).toBe('Captured to Photos');
    expect(capturePending).toBe('Capturing the image runs in the browser.');
    expect(emptyLibrary).toBe('Nothing captured yet.');
  });
});
