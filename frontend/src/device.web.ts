// Web versions of device features used by the admin section.

export type PickedImage = { blob: Blob; name: string; type: string; previewUri: string };

export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This browser cannot share your location. Tap the map to set the pin."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission was denied. Allow it in the browser, or tap the map to set the pin."
              : "Could not get your location. Tap the map to set the pin."
          )
        ),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

/** Opens the browser's file picker for one image. Resolves null when cancelled. */
export function pickImage(): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ blob: file, name: file.name, type: file.type, previewUri: URL.createObjectURL(file) });
    };
    input.click();
  });
}
