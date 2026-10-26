import * as Brightness from 'expo-brightness';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';

/** Ask for the permissions a gesture can grant. A denial leaves that sensor out. */
export async function requestNativeTelemetryPermissions(): Promise<void> {
  await Promise.all([
    Location.requestForegroundPermissionsAsync().catch(() => undefined),
    Pedometer.requestPermissionsAsync().catch(() => undefined),
    safe(() => Brightness.requestPermissionsAsync?.()),
  ]);
}

async function safe(run: () => Promise<unknown> | undefined): Promise<void> {
  try {
    await run();
  } catch {
    /* Permission APIs are missing on some platforms. */
  }
}
