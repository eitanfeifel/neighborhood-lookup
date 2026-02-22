"use client";

import { useEffect, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import GoogleMap from "@/components/GoogleMap";
import AmenitiesPanel from "@/components/AmenitiesPanel";
import { loadGoogleMaps } from "@/lib/googleMaps";
import type { LatLng, CategoryData } from "@/components/AmenitiesPanel";
import { computeScores, type Scores } from "@/lib/scores";
import { ALL_WALK_TYPES, ALL_DRIVE_TYPES, TYPE_COLORS, TYPE_LABELS } from "@/lib/mapConfig";

const HISTORY_KEY = "rent-engine-search-history";
const MAX_HISTORY = 5;
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const LOADING_PHRASES = [
  "Exploring the neighborhood…",
  "Trying out local cafes…",
  "Grabbing a quick bite…",
  "Going for a stroll…",
  "Finding the nearest pharmacy…",
  "Scouting transit options…",
  "Window shopping downtown…",
  "Getting in a quick lift...",
  "Going for a drive...",
  "Walking around the block..",
  "Hopping on the bus..."

];


function ScoreCard({ label, value, subtitle }: { label: string; value: number; subtitle: string }) {
  const color = value >= 70 ? "#16a34a" : value >= 40 ? "#d97706" : "#dc2626";
  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: "20px 24px", background: "#fafafa" }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 13, color, marginTop: 6, fontWeight: 600 }}>{subtitle}</div>
    </div>
  );
}

const LABEL_POS: Record<string, number> = {
  "Rural": 12, "Exurban": 37, "Suburban": 62, "Urban": 87,
};

function UrbanSpectrum({ value, label }: { value: number; label: string }) {
  const markerPos = LABEL_POS[label] ?? value;
  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: "20px 24px", background: "#fafafa" }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Urban Character
      </div>
      <div
        style={{
          position: "relative",
          height: 8,
          borderRadius: 4,
          background: "linear-gradient(to right, #86efac, #fcd34d, #fb923c, #ef4444)",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${markerPos}%`,
            transform: "translate(-50%, -50%)",
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "white",
            border: "2.5px solid #111",
            boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#bbb", marginBottom: 14 }}>
        <span>Rural</span>
        <span>Exurban</span>
        <span>Suburban</span>
        <span>Urban</span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 20, color: "#111" }}>{label}</div>
    </div>
  );
}

function MapLegend({
  activeTab,
  selectedType,
  onTypeChange,
}: {
  activeTab: "walking" | "driving";
  selectedType: string | null;
  onTypeChange: (type: string | null) => void;
}) {
  const types = activeTab === "walking" ? ALL_WALK_TYPES : ALL_DRIVE_TYPES;
  const pillBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    padding: "4px 12px",
    borderRadius: 999,
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
      <button
        onClick={() => onTypeChange(null)}
        style={{
          ...pillBase,
          border: `2px solid ${selectedType === null ? "#111" : "#e5e5e5"}`,
          background: selectedType === null ? "#111" : "white",
          color: selectedType === null ? "white" : "#666",
          fontWeight: selectedType === null ? 600 : 400,
        }}
      >
        All
      </button>
      {types.map((type) => {
        const active = type === selectedType;
        const color  = TYPE_COLORS[type];
        return (
          <button
            key={type}
            onClick={() => onTypeChange(type)}
            style={{
              ...pillBase,
              border: `2px solid ${active ? color : "#e5e5e5"}`,
              background: active ? `${color}18` : "white",
              color: active ? color : "#666",
              fontWeight: active ? 600 : 400,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            {TYPE_LABELS[type]}
          </button>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const [history, setHistory] = useState<string[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [scores, setScores] = useState<Scores | null>(null);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [tab, setTab] = useState<"walking" | "driving">("walking");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phraseVisible, setPhraseVisible] = useState(true);
  const [summary, setSummary] = useState<string>("");
  const [summaryPhraseIndex, setSummaryPhraseIndex] = useState(0);
  const [summaryPhraseVisible, setSummaryPhraseVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) setHistory(JSON.parse(stored));
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) handleSearch(q);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (API_KEY) {
      loadGoogleMaps(API_KEY)
        .then(() => setMapsReady(true))
        .catch(console.error);
    }
  }, []);

  // Cycle loading phrases while scores are loading
  useEffect(() => {
    if (!selectedAddress || scores) return;
    const interval = setInterval(() => {
      setPhraseVisible(false);
      setTimeout(() => {
        setPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length);
        setPhraseVisible(true);
      }, 350);
    }, 2300);
    return () => clearInterval(interval);
  }, [selectedAddress, scores]);

  // Cycle loading phrases while summary is fetching
  useEffect(() => {
    if (!scores || summary || !selectedAddress) return;
    const interval = setInterval(() => {
      setSummaryPhraseVisible(false);
      setTimeout(() => {
        setSummaryPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length);
        setSummaryPhraseVisible(true);
      }, 350);
    }, 2300);
    return () => clearInterval(interval);
  }, [scores, summary, selectedAddress]);

  // Fetch AI summary once scores + categories are ready
  useEffect(() => {
    if (!scores || categories.length === 0 || !selectedAddress) return;

    setSummary("");

    const LLM_TYPES = new Set(["shopping_mall", "park", "restaurant", "cafe", "tourist_attraction"]);

    const topByCategory = categories
      .filter((cat) => LLM_TYPES.has(cat.type))
      .map((cat) => {
        const source =
          cat.walkingPlaces.length > 0 ? cat.walkingPlaces : cat.drivingPlaces.slice(0, 5);
        const topRated = [...source]
          .filter((p) => p.rating != null)
          .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
          .slice(0, 2);
        return {
          category: cat.label,
          places: topRated.map((p) => ({
            name: p.name,
            rating: p.rating,
            isWalking: cat.walkingPlaces.length > 0,
          })),
        };
      })
      .filter((c) => c.places.length > 0);

    fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: selectedAddress, scores, topByCategory }),
    })
      .then((r) => r.json())
      .then((d) => setSummary(d.summary ?? "Unable to load summary."))
      .catch(() => setSummary("Unable to load summary."));
  }, [scores, categories]);

  function handleSearch(address: string) {
    const updated = [address, ...history.filter((a) => a !== address)].slice(0, MAX_HISTORY);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    window.history.replaceState({}, "", `?q=${encodeURIComponent(address)}`);
    setLocation(null);
    setScores(null);
    setCategories([]);
    setSummary("");
    setSummaryPhraseIndex(0);
    setSummaryPhraseVisible(true);
    setTab("walking");
    setSelectedType(null);
    setPhraseIndex(0);
    setPhraseVisible(true);
    setSelectedAddress(address);
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", gap: 24, alignItems: "flex-start", minHeight: "calc(100vh - 48px)" }}>

        {/* Left sidebar — share + recent searches */}
        {(selectedAddress || history.length > 0) && (
          <div
            style={{
              width: 210,
              flexShrink: 0,
              background: "white",
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
              padding: 16,
              position: "sticky",
              top: 24,
              height: "calc(100vh - 48px)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Recent searches */}
            {history.length > 0 && (
              <>
                <p
                  style={{
                    fontSize: 11,
                    color: "#aaa",
                    marginBottom: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    fontWeight: 600,
                  }}
                >
                  Recent Searches
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {history.map((addr) => (
                    <li key={addr}>
                      <button
                        onClick={() => handleSearch(addr)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "7px 10px",
                          background: addr === selectedAddress ? "#f0f0f0" : "transparent",
                          border: "1px solid",
                          borderColor: addr === selectedAddress ? "#bbb" : "#e0e0e0",
                          borderRadius: 6,
                          fontSize: 12,
                          color: addr === selectedAddress ? "#111" : "#555",
                          fontWeight: addr === selectedAddress ? 600 : 400,
                          cursor: "pointer",
                          lineHeight: 1.4,
                        }}
                      >
                        {addr}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Share button — pinned to bottom */}
            {selectedAddress && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                style={{
                  marginTop: "auto",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 10px",
                  background: copied ? "#f0fdf4" : "transparent",
                  border: `1px solid ${copied ? "#86efac" : "#e0e0e0"}`,
                  borderRadius: 6,
                  fontSize: 12,
                  color: copied ? "#16a34a" : "#555",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <span style={{ fontSize: 13 }}>{copied ? "✓" : "↗"}</span>
                {copied ? "Link copied!" : "Share this result"}
              </button>
            )}
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0, maxWidth: 860 }}>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Neighborhood Explorer</h1>
          <p style={{ color: "#555", marginBottom: 16 }}>
            Type an address to explore Neighborhood Scores.
          </p>

          <AddressSearch onSubmit={handleSearch} mapsReady={mapsReady} />

          {selectedAddress && (
            <div style={{ marginTop: 24 }}>
              <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>{selectedAddress}</p>

              {/* Loading phrase */}
              {!scores && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "18px 20px",
                    marginBottom: 24,
                    background: "#fafafa",
                    border: "1px solid #e5e5e5",
                    borderRadius: 10,
                    opacity: phraseVisible ? 1 : 0,
                    transition: "opacity 0.35s ease",
                  }}
                >
                  <span style={{ fontSize: 18 }}>🗺️</span>
                  <span style={{ fontSize: 14, color: "#666", fontStyle: "italic" }}>
                    {LOADING_PHRASES[phraseIndex]}
                  </span>
                </div>
              )}

              {/* Score cards */}
              {scores && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 16,
                    marginBottom: 24,
                  }}
                >
                  <ScoreCard label="Walk Score"  value={scores.walkScore}  subtitle={scores.walkLabel} />
                  <ScoreCard label="Drive Score" value={scores.driveScore} subtitle={scores.driveLabel} />
                  <UrbanSpectrum value={scores.urbanScore} label={scores.urbanLabel} />
                </div>
              )}

              {/* Map */}
              <div
                style={{
                  height: 460,
                  borderRadius: 10,
                  overflow: "hidden",
                  border: "1px solid #e5e5e5",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                <GoogleMap
                  address={selectedAddress}
                  onLocationFound={setLocation}
                  activeTab={tab}
                  amenities={categories}
                  selectedType={selectedType}
                />
              </div>

              {/* Map legend */}
              <MapLegend
                activeTab={tab}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
              />

              {location && (
                <AmenitiesPanel
                  location={location}
                  onDataLoaded={(data) => {
                    setCategories(data);
                    setScores(computeScores(data));
                  }}
                  tab={tab}
                  onTabChange={(newTab) => {
                    setTab(newTab);
                    setSelectedType(null);
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Right sidebar — AI summary */}
        {selectedAddress && (
          <div
            style={{
              width: 280,
              flexShrink: 0,
              background: "white",
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
              padding: 20,
              position: "sticky",
              top: 24,
              height: "calc(100vh - 48px)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: "#aaa",
                marginBottom: 14,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              AI Summary
            </p>

            <div style={{ flex: 1, overflowY: "auto", paddingRight: 2 }}>
            {summary ? (
              <div style={{ fontSize: 13, lineHeight: 1.75, color: "#333" }}>
                {summary.split("\n").map((line, i) => {
                  if (line.startsWith("**Highlights**")) return (
                    <div key={i} style={{ fontWeight: 600, fontSize: 13, marginTop: 14, marginBottom: 6, color: "#111" }}>
                      Highlights
                    </div>
                  );
                  if (line.startsWith("- ") || line.startsWith("• ")) return (
                    <div key={i} style={{ display: "flex", gap: 7, marginBottom: 5 }}>
                      <span style={{ color: "#16a34a", fontWeight: 700, flexShrink: 0 }}>•</span>
                      <span>{line.replace(/^[-•]\s*/, "")}</span>
                    </div>
                  );
                  if (line.trim() === "") return <div key={i} style={{ height: 6 }} />;
                  return <p key={i} style={{ margin: 0 }}>{line}</p>;
                })}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  opacity: summaryPhraseVisible ? 1 : 0,
                  transition: "opacity 0.35s ease",
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>🗺️</span>
                <span style={{ fontSize: 13, color: "#666", fontStyle: "italic", lineHeight: 1.5 }}>
                  {LOADING_PHRASES[summaryPhraseIndex]}
                </span>
              </div>
            )}
            </div>
          </div>
        )}
      </div>


    </main>
  );
}
