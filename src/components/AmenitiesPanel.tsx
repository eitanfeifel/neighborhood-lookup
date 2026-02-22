"use client";

import { useEffect, useRef, useState } from "react";

export type LatLng = { lat: number; lng: number };

type PlaceItem = {
  name: string;
  vicinity?: string;
  rating?: number;
  location?: { lat: number; lng: number };
};

//Keep walking, driving, and urban-ness metrics seperate for granularity
export type CategoryData = {
  label: string;
  type: string;
  walkingPlaces: PlaceItem[];
  drivingPlaces: PlaceItem[];
  urbanPlaces: PlaceItem[];
};

type ExpandedView = {
  label: string;
  places: PlaceItem[];
};

const WALKING_M = 804;   // 0.5 miles
const URBAN_M   = 500;   // 500 m 
const DRIVING_M = 16093; // 10 miles
const PREVIEW_COUNT = 6;

const CATEGORIES: { label: string; type: string; walkingOnly?: boolean }[] = [
  { label: "Grocery & Markets",  type: "grocery_or_supermarket" },
  { label: "Restaurants",        type: "restaurant" },
  { label: "Gyms & Fitness",     type: "gym" },
  { label: "Gas Stations",       type: "gas_station" },
  { label: "Shopping",           type: "shopping_mall" },
  { label: "Cafes",              type: "cafe" },
  { label: "Pharmacies",         type: "pharmacy" },
  { label: "Parks",              type: "park" },
  { label: "Hospitals",          type: "hospital" },
  { label: "Transit Stations",   type: "transit_station", walkingOnly: true },
  { label: "Other Attractions",  type: "tourist_attraction" },
];


function nearbySearch(
  service: google.maps.places.PlacesService,
  location: LatLng,
  type: string,
  radius: number
): Promise<PlaceItem[]> {
  return new Promise((resolve) => {
    service.nearbySearch(
      { location, radius, type },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          resolve(
            results.map((r) => ({
              name: r.name ?? "Unknown",
              vicinity: r.vicinity,
              rating: r.rating,
              location: r.geometry?.location
                ? { lat: r.geometry.location.lat(), lng: r.geometry.location.lng() }
                : undefined,
            }))
          );
        } else {
          resolve([]);
        }
      }
    );
  });
}

function PlaceRow({ p, last }: { p: PlaceItem; last: boolean }) {
  return (
    <li
      style={{
        padding: "8px 0",
        borderBottom: last ? "none" : "1px solid #eee",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#222" }}>{p.name}</div>
        {p.vicinity && (
          <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{p.vicinity}</div>
        )}
      </div>
      {p.rating != null && (
        <span
          style={{
            fontSize: 11,
            color: "#555",
            whiteSpace: "nowrap",
            paddingTop: 2,
          }}
        >
          {p.rating.toFixed(1)} / 5
        </span>
      )}
    </li>
  );
}

type Props = {
  location: LatLng;
  onDataLoaded?: (categories: CategoryData[]) => void;
  tab: "walking" | "driving";
  onTabChange: (tab: "walking" | "driving") => void;
};

export default function AmenitiesPanel({ location, onDataLoaded, tab, onTabChange }: Props) {
  const attrRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<ExpandedView | null>(null);

  useEffect(() => {
    if (!attrRef.current || !window.google?.maps?.places) return;

    const service = new google.maps.places.PlacesService(attrRef.current);
    setLoading(true);
    setCategories([]);

    (async () => {
      const data: CategoryData[] = [];
      for (const cat of CATEGORIES) {
        const [walking, urban, driving] = await Promise.all([
          nearbySearch(service, location, cat.type, WALKING_M),
          nearbySearch(service, location, cat.type, URBAN_M),
          cat.walkingOnly
            ? Promise.resolve([] as PlaceItem[])
            : nearbySearch(service, location, cat.type, DRIVING_M),
        ]);
        data.push({ label: cat.label, type: cat.type, walkingPlaces: walking, drivingPlaces: driving, urbanPlaces: urban });
      }
      console.log("[amenities]", data.map(c => ({ label: c.label, walking: c.walkingPlaces.length, driving: c.drivingPlaces.length })));
      setCategories(data);
      onDataLoaded?.(data);
      setLoading(false);
    })();
  }, [location]);

  // Close modal on Escape
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [expanded]);

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    border: "none",
    borderBottom: active ? "2px solid #111" : "2px solid transparent",
    background: "none",
    color: active ? "#111" : "#888",
  });

  return (
    <div style={{ marginTop: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Nearby Amenities</h2>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
        Places within the selected radius of the searched address.
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #e5e5e5", marginBottom: 24 }}>
        <button style={tabBtn(tab === "walking")} onClick={() => onTabChange("walking")}>
          Walking Radius &nbsp;<span style={{ color: "#aaa", fontWeight: 400 }}>0.5 mi</span>
        </button>
        <button style={tabBtn(tab === "driving")} onClick={() => onTabChange("driving")}>
          Driving Radius &nbsp;<span style={{ color: "#aaa", fontWeight: 400 }}>10 mi</span>
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#888", fontSize: 14 }}>Loading nearby places…</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {categories.map((cat) => {
            const catDef = CATEGORIES.find((c) => c.label === cat.label)!;
            if (tab === "driving" && catDef.walkingOnly) return null;
            const places = tab === "walking" ? cat.walkingPlaces : cat.drivingPlaces;
            const hasResults = places.length > 0;
            const overflow = places.length > PREVIEW_COUNT;

            return (
              <div
                key={cat.label}
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 10,
                  padding: 16,
                  background: "#fafafa",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{cat.label}</span>
                  <span
                    style={{
                      background: hasResults ? "#111" : "#e5e5e5",
                      color: hasResults ? "white" : "#999",
                      borderRadius: 999,
                      fontSize: 11,
                      padding: "2px 8px",
                      fontWeight: 600,
                    }}
                  >
                    {places.length}{places.length === 20 ? "+" : ""}
                  </span>
                </div>

                {/* Place list */}
                {!hasResults ? (
                  <p style={{ fontSize: 13, color: "#bbb" }}>None found</p>
                ) : (
                  <>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, flex: 1 }}>
                      {places.slice(0, PREVIEW_COUNT).map((p, i) => (
                        <PlaceRow
                          key={i}
                          p={p}
                          last={i === Math.min(places.length, PREVIEW_COUNT) - 1 && !overflow}
                        />
                      ))}
                    </ul>

                    {overflow && (
                      <button
                        onClick={() => setExpanded({ label: cat.label, places })}
                        style={{
                          marginTop: 10,
                          border: "none",
                          background: "none",
                          fontSize: 12,
                          color: "#555",
                          cursor: "pointer",
                          textAlign: "left",
                          textDecoration: "underline",
                          padding: 0,
                        }}
                      >
                        View all {places.length}{places.length === 20 ? "+" : ""} results
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Required Google attribution */}
      <div ref={attrRef} style={{ display: "none" }} />
      <p style={{ fontSize: 11, color: "#ccc", marginTop: 20 }}>Powered by Google</p>

      {/* Full-list modal */}
      {expanded && (
        <div
          onClick={() => setExpanded(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 12,
              width: "100%",
              maxWidth: 520,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                borderBottom: "1px solid #e5e5e5",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{expanded.label}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                  {expanded.places.length}{expanded.places.length === 20 ? "+" : ""} places found
                </div>
              </div>
              <button
                onClick={() => setExpanded(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "#555",
                  lineHeight: 1,
                  padding: "4px 8px",
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Scrollable list */}
            <ul
              style={{
                listStyle: "none",
                padding: "8px 20px",
                margin: 0,
                overflowY: "auto",
              }}
            >
              {expanded.places.map((p, i) => (
                <PlaceRow key={i} p={p} last={i === expanded.places.length - 1} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
