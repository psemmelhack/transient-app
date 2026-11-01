import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildScene, type SceneNode } from '../composition/scene';
import { exampleMoment, EXAMPLE_INSTANT } from '../data/moment';
import { presetById, styleFromPreset } from '../style/presets';
import { embedSceneFonts, fontFaceCss, parseFontFaces } from './fontEmbed';
import { refitLines } from './refit';
import { fontFileAllowed, fontRelativePath } from '../native/fontFile';
import { parseWebMessage } from '../native/protocol';

const fontsCss = readFileSync(new URL('../../public/fonts.css', import.meta.url), 'utf8');
const moment = exampleMoment(EXAMPLE_INSTANT);

function heroFamily(nodes: SceneNode[]): string {
  const hero = nodes.find((node) => node.kind === 'fit-stack');
  if (!hero || hero.kind !== 'fit-stack') throw new Error('missing hero');
  return hero.font.family;
}

describe('capture font embed', () => {
  it('reads the pack faces the poster actually uses', () => {
    const faces = parseFontFaces(fontsCss);
    expect(faces.find((face) => face.family === 'Big Shoulders Display')?.url).toBe('fonts/BigShouldersDisplay-wght.ttf');
    expect(faces.filter((face) => face.family === 'Instrument Serif').map((face) => face.style).sort()).toEqual(['italic', 'normal']);
    expect(fontRelativePath('file:///var/mobile/pack/fonts/BigShouldersDisplay-wght.ttf')).toBe('fonts/BigShouldersDisplay-wght.ttf');
    expect(fontRelativePath('fonts/../../secret.ttf')).toBeNull();
    expect(fontRelativePath('https://evil.test/other/passwd')).toBeNull();
  });

  it('inlines the style family and keeps the date inside the margin', async () => {
    const style = styleFromPreset(presetById('02'));
    const scene = buildScene(style, moment, 'The light on the water, right now.', EXAMPLE_INSTANT);
    const family = heroFamily(scene.nodes);
    expect(family).toBe('Big Shoulders Display');
    const cssText = await embedSceneFonts([family, 'JetBrains Mono'], {
      css: fontsCss,
      bytes: async () => null,
      native: async (path) => (path.startsWith('fonts/') ? 'QUJDRA==' : null),
    });
    expect(cssText).toContain("font-family:'Big Shoulders Display'");
    expect(cssText).toContain("font-family:'JetBrains Mono'");
    expect(cssText).toContain('data:font/ttf;base64,QUJDRA==');
    expect(cssText).not.toMatch(/url\((['"]?)fonts\//);
    const [date] = refitLines([{ family, fontSize: 64, box: 900, content: 1184 }]);
    expect(date.family).toBe(family);
    expect(date.fontSize).toBeLessThan(64);
    expect(date.content).toBeLessThanOrEqual(date.box + 0.5);
    const [fitted] = refitLines([{ family, fontSize: 40, box: 900, content: 640 }]);
    expect(fitted.fontSize).toBe(40);
    expect(fitted.content).toBeLessThanOrEqual(fitted.box);
  });

  it('inlines Instrument from the stylesheet when the file can be fetched', async () => {
    const style = styleFromPreset(presetById('04'));
    const scene = buildScene(style, moment, 'We were here.', EXAMPLE_INSTANT);
    const quiet = scene.nodes.find((node) => node.kind === 'quiet');
    const family = quiet && quiet.kind === 'quiet' ? quiet.blocks.find((block) => block.kind !== 'rule' && 'font' in block && block.font.family === 'Instrument Serif') : undefined;
    expect(family && 'font' in family && family.font.family).toBe('Instrument Serif');
    const cssText = await embedSceneFonts(['Instrument Serif'], {
      css: fontsCss,
      bytes: async (url) => (url.includes('InstrumentSerif') ? 'SU5T' : null),
    });
    expect(cssText).toContain("font-family:'Instrument Serif'");
    expect(cssText).toContain('base64,SU5T');
    expect(cssText.match(/@font-face/g)?.length).toBe(2);
  });

  it('builds a data-url face and nothing else', () => {
    const css = fontFaceCss([
      {
        family: 'Big Shoulders Display',
        weight: '100 900',
        style: 'normal',
        url: 'fonts/BigShouldersDisplay-wght.ttf',
        format: 'truetype',
        dataUrl: 'data:font/ttf;base64,QQ==',
      },
    ]);
    expect(css).toContain("font-family:'Big Shoulders Display'");
    expect(css).toContain("src:url('data:font/ttf;base64,QQ==')");
    expect(css).toContain('font-display:block');
  });
});

describe('pack font reads', () => {
  it('joins a font file under the directory the WebView can already read', () => {
    expect(fontFileAllowed('fonts/BigShouldersDisplay-wght.ttf', 'file:///var/mobile/pack/')).toBe(
      'file:///var/mobile/pack/fonts/BigShouldersDisplay-wght.ttf',
    );
    expect(fontFileAllowed('fonts/InstrumentSerif-Italic.ttf', 'file:///pack')).toBe('file:///pack/fonts/InstrumentSerif-Italic.ttf');
  });

  it('rejects a path that leaves the font folder', () => {
    const root = 'file:///var/mobile/pack';
    expect(fontFileAllowed('../secret.ttf', root)).toBeNull();
    expect(fontFileAllowed('fonts/../secret.ttf', root)).toBeNull();
    expect(fontFileAllowed('/etc/passwd', root)).toBeNull();
    expect(fontFileAllowed('fonts/notes.txt', root)).toBeNull();
    expect(fontFileAllowed('fonts/BigShouldersDisplay-wght.ttf', '')).toBeNull();
    expect(fontFileAllowed('fonts/BigShouldersDisplay-wght.ttf', 'file:///pack/../')).toBeNull();
    expect(parseWebMessage({ source: 'transient-web', type: 'read-font', id: 'f1', path: 'fonts/BigShouldersDisplay-wght.ttf' })).toEqual({
      source: 'transient-web',
      type: 'read-font',
      id: 'f1',
      path: 'fonts/BigShouldersDisplay-wght.ttf',
    });
    expect(parseWebMessage({ source: 'transient-web', type: 'read-font', id: 'f1', path: 'fonts/../../secret.ttf' })).toBeNull();
    expect(parseWebMessage({ source: 'transient-web', type: 'read-font', id: '', path: 'fonts/Anton-Regular.ttf' })).toBeNull();
  });
});
