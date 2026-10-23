// Native (Android / iOS) versions. The web build uses device.web.ts.
// The admin section is web-first; these give a clear message instead of failing silently.

export type PickedImage = { blob: Blob; name: string; type: string; previewUri: string };

export async function currentPosition(): Promise<{ lat: number; lng: number }> {
  throw new Error("Use “Use my GPS location” in the web admin, or tap the map to set the pin.");
}

export async function pickImage(): Promise<PickedImage | null> {
  throw new Error("Photo upload works in the web admin for now.");
}
