import { describe, expect, it } from 'vitest';
import { shellIconButton, shellIconRow } from './shellChrome';

describe('shell header icons', () => {
  it('does not clip the icon row or the buttons', () => {
    expect(shellIconRow.overflow).toBe('visible');
    expect(shellIconRow.flex).toBe('none');
    expect(shellIconButton.overflow).toBe('visible');
    expect(shellIconButton.maxWidth).toBe('none');
    expect(shellIconButton.width).toBe(40);
    expect(shellIconButton.height).toBe(40);
  });
});
