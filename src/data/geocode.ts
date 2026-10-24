import type { PlaceInfo } from './moment';

/** BigDataCloud reverse geocode. No key. Null when it cannot be reached. */
export async function reverseGeocode(latitude: number, longitude: number): Promise<PlaceInfo | null> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(String(latitude))}&longitude=${encodeURIComponent(String(longitude))}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      locality?: string;
      city?: string;
      principalSubdivision?: string;
    };
    const city = (json.locality || json.city || '').trim() || null;
    const region = (json.principalSubdivision || '').trim() || null;
    const full = city && region ? `${city}, ${region}` : city || region;
    if (!full) return null;
    return { city, region, full };
  } catch {
    return null;
  }
}
