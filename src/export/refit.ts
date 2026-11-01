/** A nowrap line measured in the export document. `box` is the margin it must stay inside. */
export interface MeasuredLine {
  family: string;
  fontSize: number;
  box: number;
  content: number;
}

/**
 * Scale a font down until its advance fits the box. A line that already fits is unchanged.
 * Callers pass the export clone, never the live stage.
 */
export function refitSize(box: number, content: number, fontSize: number): number {
  if (!(box > 0) || !(content > 0) || !(fontSize > 0)) return fontSize;
  if (content <= box + 0.5) return fontSize;
  const scaled = Math.floor(((fontSize * box) / content) * 100) / 100;
  if (!(scaled > 0)) return Math.min(fontSize, 8);
  return Math.min(fontSize, Math.max(8, scaled));
}

export function fittedWidth(content: number, from: number, to: number): number {
  if (!(from > 0) || !(to > 0)) return content;
  return content * (to / from);
}

export function refitLines(lines: MeasuredLine[]): MeasuredLine[] {
  return lines.map((line) => {
    const fontSize = refitSize(line.box, line.content, line.fontSize);
    const content = fontSize === line.fontSize ? line.content : fittedWidth(line.content, line.fontSize, fontSize);
    return { ...line, fontSize, content };
  });
}

const REFIT_ATTR = 'data-refit-id';

interface LineReading {
  box: number;
  content: number;
  fontSize: number;
}

interface ConfirmFace {
  family: string;
  url: string;
  weight: string;
  style: string;
}

function faceBlocks(css: string): ConfirmFace[] {
  const faces: ConfirmFace[] = [];
  for (const block of css.match(/@font-face\s*\{[^}]*\}/gi) ?? []) {
    const family = block.match(/font-family:\s*(['"]?)([^;'"]+)\1/i)?.[2]?.trim();
    const url = block.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i)?.[2];
    if (!family || !url) continue;
    faces.push({
      family,
      url,
      weight: block.match(/font-weight:\s*([^;]+)/i)?.[1]?.trim() || '400',
      style: block.match(/font-style:\s*([^;]+)/i)?.[1]?.trim() || 'normal',
    });
  }
  return faces;
}

function styleText(svg: SVGSVGElement): string {
  return Array.from(svg.querySelectorAll('style'))
    .map((node) => node.textContent ?? '')
    .join('\n');
}

function readingOf(node: HTMLElement, stage: HTMLElement): LineReading | null {
  const view = node.ownerDocument.defaultView;
  if (!view) return null;
  const computed = view.getComputedStyle(node);
  const nowrap = computed.whiteSpace === 'nowrap' || computed.whiteSpace === 'pre' || node.hasAttribute('data-fit');
  if (!nowrap) return null;
  const stageRect = stage.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  const available = stageRect.width > 0 ? stageRect.right - rect.left : node.clientWidth;
  const box = Math.min(node.clientWidth > 0 ? node.clientWidth : available, available > 0 ? available : node.clientWidth);
  const content = node.scrollWidth;
  const fontSize = Number.parseFloat(computed.fontSize);
  if (!(box > 0) || !(content > 0) || !(fontSize > 0)) return null;
  return { box, content, fontSize };
}

async function loadFaces(doc: Document, css: string): Promise<void> {
  const fonts = doc.fonts;
  const Face = doc.defaultView?.FontFace;
  if (!fonts || !Face) return;
  const pending: Promise<unknown>[] = [];
  for (const face of faceBlocks(css)) {
    try {
      const loaded = new Face(face.family, `url("${face.url}")`, {
        weight: face.weight,
        style: face.style,
        display: 'block',
      });
      fonts.add(loaded);
      pending.push(loaded.load().then(() => undefined, () => undefined));
    } catch {
      // A face the document cannot construct is measured with the fallback.
    }
  }
  await Promise.all(pending);
  await fonts.ready.then(() => undefined, () => undefined);
}

/**
 * Measure nowrap lines where the only faces are the ones embedded in the export SVG.
 * The page's own stylesheet stays out, so a missing file is measured as the fallback.
 */
async function measureIsolated(svg: SVGSVGElement, stage: HTMLElement): Promise<Map<string, LineReading> | null> {
  const width = Number(svg.getAttribute('width')) || stage.clientWidth || 1080;
  const height = Number(svg.getAttribute('height')) || stage.clientHeight || 1350;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;border:0;opacity:0;pointer-events:none;z-index:-1`;
  document.body.appendChild(iframe);
  try {
    const frameDocument = iframe.contentDocument;
    const view = iframe.contentWindow;
    if (!frameDocument || !view) return null;
    const css = styleText(svg).replace(/<\/(style)/gi, '<\\/$1');
    frameDocument.open();
    frameDocument.write(`<!doctype html><html><head><style>html,body{margin:0;padding:0;width:${width}px;height:${height}px}${css}</style></head><body></body></html>`);
    frameDocument.close();
    const doc = iframe.contentDocument;
    if (!doc?.body) return null;
    const copy = stage.cloneNode(true);
    if (!(copy instanceof HTMLElement)) return null;
    copy.style.transform = 'none';
    copy.style.left = '0';
    copy.style.top = '0';
    doc.body.appendChild(copy);
    await loadFaces(doc, css);
    const readings = new Map<string, LineReading>();
    copy.querySelectorAll<HTMLElement>(`[${REFIT_ATTR}]`).forEach((node) => {
      const id = node.getAttribute(REFIT_ATTR);
      if (!id) return;
      const reading = readingOf(node, copy);
      if (reading) readings.set(id, reading);
    });
    return readings;
  } catch {
    return null;
  } finally {
    iframe.remove();
  }
}

function stamp(stage: HTMLElement): HTMLElement[] {
  const marked: HTMLElement[] = [];
  // The export clone keeps white-space on a class, so every element is measured and non-nowrap lines are skipped.
  stage.querySelectorAll<HTMLElement>('*').forEach((node) => {
    node.setAttribute(REFIT_ATTR, String(marked.length));
    marked.push(node);
  });
  return marked;
}

/**
 * Shrink nowrap text in the export SVG until each line stays inside its box.
 * The live preview is not in this SVG.
 */
export async function refitExportSvg(svg: SVGSVGElement): Promise<void> {
  if (typeof document === 'undefined' || !document.body) return;
  const stage = svg.querySelector('foreignObject')?.firstElementChild;
  if (!(stage instanceof HTMLElement)) return;
  const marked = stamp(stage);
  if (!marked.length) return;
  try {
    let readings = await measureIsolated(svg, stage);
    if (!readings) {
      readings = new Map();
      const holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;z-index:-1';
      holder.appendChild(svg);
      document.body.appendChild(holder);
      try {
        marked.forEach((node) => {
          const id = node.getAttribute(REFIT_ATTR);
          if (!id) return;
          const reading = readingOf(node, stage);
          if (reading) readings?.set(id, reading);
        });
      } finally {
        holder.remove();
      }
    }
    for (const node of marked) {
      const id = node.getAttribute(REFIT_ATTR);
      const reading = id ? readings.get(id) : undefined;
      if (!reading) continue;
      const next = refitSize(reading.box, reading.content, reading.fontSize);
      if (next < reading.fontSize - 0.25) node.style.setProperty('font-size', `${next}px`, 'important');
    }
  } finally {
    marked.forEach((node) => node.removeAttribute(REFIT_ATTR));
  }
}
