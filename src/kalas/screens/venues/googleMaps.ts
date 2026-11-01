/* Google Maps, loaded when the couple opens the map and not before: it is a
   third-party script, and most visits to Venues never need it.

   No @types/google.maps in the project, and the map uses a dozen methods, so
   the handful it touches are typed here instead. */

export interface LatLngLiteral { lat: number; lng: number }
export interface BoundsLiteral { south: number; west: number; north: number; east: number }

export interface GMap {
  fitBounds(bounds: BoundsLiteral, padding?: number): void;
  setCenter(c: LatLngLiteral): void;
  setZoom(z: number): void;
  getZoom(): number | undefined;
  getBounds(): { toJSON(): BoundsLiteral } | undefined;
  addListener(event: string, fn: () => void): { remove(): void };
}
export interface GMarker {
  setMap(map: GMap | null): void;
  setIcon(icon: unknown): void;
  setZIndex(z: number): void;
  setTitle(title: string): void;
  addListener(event: string, fn: () => void): { remove(): void };
}
export interface GoogleMaps {
  Map: new (el: HTMLElement, options: Record<string, unknown>) => GMap;
  Marker: new (options: Record<string, unknown>) => GMarker;
}

declare global {
  interface Window {
    google?: { maps?: GoogleMaps };
    __kalasMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

/** For /dev harnesses only: Google serves a watermarked map without a key. */
export const KEYLESS = 'keyless';

let pending: Promise<GoogleMaps> | null = null;

export function loadGoogleMaps(key: string): Promise<GoogleMaps> {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  pending ??= new Promise<GoogleMaps>((resolve, reject) => {
    const fail = (why: string) => { pending = null; reject(new Error(why)); };
    window.__kalasMapsReady = () => {
      const maps = window.google?.maps;
      if (maps?.Map) resolve(maps); else fail('Google Maps loaded without a map');
    };
    // A key that is wrong, or not allowed on this address, loads the script
    // fine and then calls this. Without it the map is a grey box forever.
    window.gm_authFailure = () => fail('Google Maps rejected the key');
    const params = new URLSearchParams({ v: 'weekly', loading: 'async', callback: '__kalasMapsReady' });
    if (key !== KEYLESS) params.set('key', key);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => fail('Google Maps could not be loaded');
    document.head.appendChild(script);
  });
  return pending;
}

/* Kalas's own paper and sage, so the map sits in the page instead of looking
   pasted onto it. Businesses and transit are switched off: the only pins that
   matter here are the venues. */
export const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#f1f2ee' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5f6b66' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f8f9f8' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c6cbc6' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#dbe5e0' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e8f0ec' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e6e9e5' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ece6dc' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cddcdc' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#516b60' }] },
];
