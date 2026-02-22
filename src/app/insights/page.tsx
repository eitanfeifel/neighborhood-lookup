"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import GoogleMap from "@/components/GoogleMap";
import AmenitiesPanel from "@/components/AmenitiesPanel";
import { computeScores, type Scores } from "@/lib/scores";
import { ALL_WALK_TYPES, ALL_DRIVE_TYPES, TYPE_COLORS, TYPE_LABELS } from "@/lib/mapConfig";
import type { LatLng, CategoryData } from "@/components/AmenitiesPanel";

// Shared display components 

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

// Main content
function InsightsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const address = searchParams.get("address") ?? "";

  const [location, setLocation]     = useState<LatLng | null>(null);
  const [scores, setScores]         = useState<Scores | null>(null);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [tab, setTab]               = useState<"walking" | "driving">("walking");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [summary, setSummary]       = useState<string>("");

  useEffect(() => {
    if (!scores || categories.length === 0) return;

    const topByCategory = categories
      .map((cat) => {
        const source =
          cat.walkingPlaces.length > 0
            ? cat.walkingPlaces
            : cat.drivingPlaces.slice(0, 5);

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
      body: JSON.stringify({ address, scores, topByCategory }),
    })
      .then((r) => r.json())
      .then((d) => setSummary(d.summary ?? ""));
  }, [scores, categories]);

  return (
    <main style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <button
          onClick={() => router.push("/")}
          style={{
            background: "none",
            border: "none",
            color: "#555",
            fontSize: 14,
            cursor: "pointer",
            marginBottom: 16,
            padding: 0,
          }}
        >
          ← Back
        </button>

        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Insights</h1>
        <p style={{ color: "#555", fontSize: 15, marginBottom: 24 }}>{address}</p>

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

        {/* AI Summary */}
        {scores && (
          <div
            style={{
              background: "#fafafa",
              border: "1px solid #e5e5e5",
              borderRadius: 10,
              padding: "20px 24px",
              marginBottom: 24,
              fontSize: 14,
              lineHeight: 1.8,
              color: "#333",
              minHeight: 80,
            }}
          >
            {summary ? (
              summary.split("\n").map((line, i) => {
                if (line.startsWith("**Highlights**")) return (
                  <div key={i} style={{ fontWeight: 600, fontSize: 15, marginTop: 16, marginBottom: 8 }}>
                    Highlights
                  </div>
                );
                if (line.startsWith("- ") || line.startsWith("• ")) return (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: "#16a34a", fontWeight: 600 }}>•</span>
                    <span>{line.replace(/^[-•]\s*/, "")}</span>
                  </div>
                );
                if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
                return <p key={i} style={{ margin: 0 }}>{line}</p>;
              })
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[100, 85, 70].map((w) => (
                  <div
                    key={w}
                    style={{
                      height: 14,
                      width: `${w}%`,
                      background: "#e5e5e5",
                      borderRadius: 4,
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Map */}
        <div style={{
          height: 480,
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid #e5e5e5",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}>
          <GoogleMap
            address={address}
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

        {/* Amenities panel */}
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
    </main>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p style={{ color: "#888" }}>Loading…</p>
      </main>
    }>
      <InsightsContent />
    </Suspense>
  );
}
