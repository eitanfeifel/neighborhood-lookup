const SCRIPT_ID = "google-maps-script";

export function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return;
    if (window.google?.maps) { resolve(); return; }

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    // include places library for autocomplete
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}
