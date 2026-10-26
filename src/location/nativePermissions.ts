/** Web builds never ask the phone. The native module requests what the gesture can grant. */
export async function requestNativeTelemetryPermissions(): Promise<void> {}
