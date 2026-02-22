"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import type { LatLng, CategoryData } from "@/components/AmenitiesPanel";
import { TYPE_COLORS, TYPE_LABELS } from "@/lib/mapConfig";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const WALK_RADIUS  = 804;   // 0.5 miles |
const DRIVE_RADIUS = 16093; // 10 miles  —-> ensure these match AmenitiesPanel

type Props = {
  address: string;
  onLocationFound?: (location: LatLng) => void;
  activeTab?: "walking" | "driving";
  amenities?: CategoryData[];
  selectedType?: string | null;
};

export default function GoogleMap({
  address,
  onLocationFound,
  activeTab = "walking",
  amenities = [],
  selectedType,
}: Props) {
  const mapDivRef      = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const locationRef    = useRef<LatLng | null>(null);
  const markersRef     = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const circleRef      = useRef<google.maps.Circle | null>(null);

  const [status, setStatus]     = useState<"loading" | "error" | "ready">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  function clearOverlays() {
    markersRef.current.forEach((m) => { m.map = null; });
    markersRef.current = [];
    circleRef.current?.setMap(null);
    circleRef.current = null;
  }

  function drawOverlays(
    map: google.maps.Map,
    location: LatLng,
    tab: "walking" | "driving",
    cats: CategoryData[],
    typeFilter?: string | null
  ) {
    clearOverlays();

    const isWalking = tab === "walking";
    const radius    = isWalking ? WALK_RADIUS : DRIVE_RADIUS;
    const color     = isWalking ? "#16a34a" : "#2563eb";

    circleRef.current = new google.maps.Circle({
      map,
      center: location,
      radius,
      strokeColor:   color,
      strokeOpacity: 0.5,
      strokeWeight:  1.5,
      fillColor:     color,
      fillOpacity:   0.05,
    });

    // Zoom map to fit the active radius circle
    const bounds = circleRef.current.getBounds();
    if (bounds) map.fitBounds(bounds);

    for (const cat of cats) {
      if (typeFilter && cat.type !== typeFilter) continue;
      const places      = isWalking ? cat.walkingPlaces : cat.drivingPlaces;
      const markerColor = TYPE_COLORS[cat.type] ?? "#666";
      const typeLabel   = TYPE_LABELS[cat.type] ?? cat.label;

      for (const place of places) {
        if (!place.location) continue;

        const pin = new google.maps.marker.PinElement({
          background:  markerColor,
          borderColor: markerColor,
          glyphColor:  "white",
        });

        const marker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: place.location,
          title:    place.name,
          content:  pin.element,
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="font-size:13px;padding:4px 6px">
            <strong>${place.name}</strong><br/>
            <span style="color:#888">${typeLabel}</span>
            ${place.rating != null ? `<br/><span style="color:#555">⭐ ${place.rating.toFixed(1)}</span>` : ""}
          </div>`,
        });

        marker.addListener("click", () => infoWindow.open({ map, anchor: marker }));
        markersRef.current.push(marker);
      }
    }
  }

  // Init map when address changes
  useEffect(() => {
    if (!API_KEY || API_KEY === "your_google_maps_api_key_here") {
      setStatus("error");
      setErrorMsg("Google Maps API key not configured.");
      return;
    }
    if (!address) {
      setStatus("error");
      setErrorMsg("No address provided.");
      return;
    }

    setStatus("loading");
    clearOverlays();
    locationRef.current    = null;
    mapInstanceRef.current = null;

    loadGoogleMaps(API_KEY)
      .then(() => {
        if (!mapDivRef.current) return;

        const map = new google.maps.Map(mapDivRef.current, {
          zoom: 15,
          center: { lat: 0, lng: 0 },
          mapId: "DEMO_MAP_ID",       // required for AdvancedMarkerElement
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapInstanceRef.current = map;

        new google.maps.Geocoder().geocode({ address }, (results, geocodeStatus) => {
          if (geocodeStatus === "OK" && results?.[0]) {
            const loc    = results[0].geometry.location;
            const latLng = { lat: loc.lat(), lng: loc.lng() };
            map.setCenter(loc);
            new google.maps.marker.AdvancedMarkerElement({ map, position: loc, title: address });
            locationRef.current = latLng;
            setStatus("ready");
            onLocationFound?.(latLng);
          } else {
            setStatus("error");
            setErrorMsg(`Could not locate address (${geocodeStatus})`);
          }
        });
      })
      .catch((err: Error) => {
        setStatus("error");
        setErrorMsg(err.message);
      });
  }, [address]);

  // Redraw overlays whenever tab, amenities, or selected category changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const loc = locationRef.current;
    if (!map || !loc || amenities.length === 0) return;
    drawOverlays(map, loc, activeTab, amenities, selectedType);
  }, [activeTab, amenities, selectedType]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={mapDivRef}
        style={{ width: "100%", height: "100%", display: status === "error" ? "none" : "block" }}
      />
      {status === "loading" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f5f5f5",
            color: "#888",
            fontSize: 14,
          }}
        >
          Loading map…
        </div>
      )}
      {status === "error" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            padding: 24,
            color: "#888",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}
