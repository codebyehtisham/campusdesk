import { useEffect, useRef, useState } from 'react';

type Props = {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  onPick: (latitude: number, longitude: number) => void;
};

declare global {
  interface Window {
    L?: {
      map: (el: HTMLElement, options: object) => LeafletMap;
      tileLayer: (url: string, options: object) => { addTo: (map: LeafletMap) => void };
      marker: (latlng: [number, number], options?: object) => LeafletMarker;
      circle: (latlng: [number, number], options: object) => LeafletCircle;
    };
  }
}

type LeafletMap = {
  setView: (latlng: [number, number], zoom: number) => void;
  on: (event: string, handler: (e: { latlng: { lat: number; lng: number } }) => void) => void;
  remove: () => void;
};

type LeafletMarker = {
  setLatLng: (latlng: [number, number]) => LeafletMarker;
  getLatLng: () => { lat: number; lng: number };
  on: (event: string, handler: () => void) => void;
};

type LeafletCircle = {
  setLatLng: (latlng: [number, number]) => LeafletCircle;
  setRadius: (radius: number) => LeafletCircle;
};

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const DEFAULT_CENTER: [number, number] = [31.5497, 74.3436];

let leafletPromise: Promise<void> | null = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load map library.'));
    document.body.appendChild(script);
  });
  return leafletPromise;
}

export default function CampusMapPicker({ latitude, longitude, radiusMeters, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const circleRef = useRef<LeafletCircle | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then(() => {
        if (cancelled || !hostRef.current || !window.L) return;
        const L = window.L;
        const start: [number, number] =
          latitude != null && longitude != null ? [latitude, longitude] : DEFAULT_CENTER;
        const map = L.map(hostRef.current, { scrollWheelZoom: true }).setView(start, 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker(start, { draggable: true }).addTo(map);
        const circle = L.circle(start, {
          radius: radiusMeters,
          color: '#0f5c5c',
          fillColor: '#0f5c5c',
          fillOpacity: 0.15,
          weight: 2,
        }).addTo(map);

        const sync = (lat: number, lng: number) => {
          marker.setLatLng([lat, lng]);
          circle.setLatLng([lat, lng]);
          onPick(lat, lng);
        };

        map.on('click', (event) => sync(event.latlng.lat, event.latlng.lng));
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          sync(pos.lat, pos.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;
        circleRef.current = circle;
        setReady(true);
      })
      .catch((err) => setError(err.message || 'Map failed to load.'));

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || latitude == null || longitude == null) return;
    markerRef.current?.setLatLng([latitude, longitude]);
    circleRef.current?.setLatLng([latitude, longitude]);
    mapRef.current?.setView([latitude, longitude], 16);
  }, [latitude, longitude, ready]);

  useEffect(() => {
    circleRef.current?.setRadius(radiusMeters);
  }, [radiusMeters, ready]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      {error && <p className="m-0 bg-crimson-pale px-4 py-3 text-sm font-semibold text-crimson-dark">{error}</p>}
      <div ref={hostRef} className="h-[360px] w-full bg-bg-alt" aria-label="Campus location map" />
      <p className="m-0 border-t border-border px-4 py-3 text-sm text-text-muted">
        Click the map or drag the pin to set where students must be to mark QR attendance.
      </p>
    </div>
  );
}
