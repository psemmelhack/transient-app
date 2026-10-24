/** Open-Meteo current temperature. No key. Returns null when offline or refused. */
export async function fetchTemperatureC(
  latitude: number,
  longitude: number,
  timeoutMs = 8000,
): Promise<number | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(latitude))}&longitude=${encodeURIComponent(String(longitude))}&current=temperature_2m&temperature_unit=celsius`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { current?: { temperature_2m?: unknown } };
    const value = json.current?.temperature_2m;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
