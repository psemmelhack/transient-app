export interface FitFaceStatus {
  family: string;
  weight: string;
  style: string;
  status: string;
}

export interface FitLineReport {
  text: string;
  family: string;
  weight: number;
  style: string;
  variation: string;
  fontsStatus: string;
  faces: FitFaceStatus[];
  check: boolean | null;
  domAdvance: number;
  domLine: number;
  domTrim: number;
  domBaseline: number | null;
  canvasAdvance: number | null;
  canvasAscent: number | null;
  canvasDescent: number | null;
  canvasFontAscent: number | null;
  fontSize: number;
  height: number;
  source: string;
}

interface FitStore {
  lines: FitLineReport[];
  open: boolean;
}

let store: FitStore = { lines: [], open: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getFitStore(): FitStore {
  return store;
}

export function subscribeFitStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function replaceFitReport(lines: FitLineReport[]): void {
  store = { ...store, lines };
  emit();
}

export function setDiagnosticOpen(open: boolean): void {
  if (store.open === open) return;
  store = { ...store, open };
  emit();
}

export function toggleDiagnostic(): void {
  setDiagnosticOpen(!store.open);
}
