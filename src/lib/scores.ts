import type { CategoryData } from "@/components/AmenitiesPanel";

function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function averageSpacingMeters(
  places: Array<{ location?: { lat: number; lng: number } }>
): number | null {
  const pts = places.filter((p) => p.location).map((p) => p.location!);
  if (pts.length < 2) return null;
  let total = 0;
  for (const p of pts) {
    let nearest = Infinity;
    for (const q of pts) {
      if (p === q) continue;
      const d = haversineDistance(p, q);
      if (d < nearest) nearest = d;
    }
    total += nearest;
  }
  return total / pts.length;
}

// Walkability
const WALK_WEIGHTS: Record<string, { weight: number; cap: number }> = {
  grocery_or_supermarket: { weight: 25, cap: 2 },
  pharmacy:               { weight: 20, cap: 2 },
  cafe:                   { weight: 12, cap: 3 },
  park:                   { weight: 10, cap: 2 },
  transit_station:        { weight: 18, cap: 2 },
  tourist_attraction:     { weight: 10, cap: 3 },
};
const MAX_WALK_RAW = 95;

// Urban Index
const URBAN_POSITIVE: Record<string, { weight: number; cap: number }> = {
  cafe:            { weight: 15, cap: 4 },
  park:            { weight: 12, cap: 3 },
  transit_station: { weight: 20, cap: 3 },
  pharmacy:        { weight: 10, cap: 2 },
};
const URBAN_NEGATIVE: Record<string, { weight: number; cap: number }> = {
  gas_station: { weight: 12, cap: 3 },
};
const MAX_URBAN_POS = 57;
const MAX_URBAN_NEG = 12;

export type Scores = {
  walkScore: number;  walkLabel: string;
  driveScore: number; driveLabel: string;
  urbanScore: number; urbanLabel: string;
};

function rawScore(count: number, weight: number, cap: number): number {
  return (Math.min(count, cap) / cap) * weight;
}

function byType(
  categories: CategoryData[],
  field: "walkingPlaces" | "drivingPlaces" | "urbanPlaces"
): Record<string, number> {
  return Object.fromEntries(categories.map(c => [c.type, c[field].length]));
}

function computeDriveScore(categories: CategoryData[]): number {
  const drivePlaces = categories.flatMap(c => c.drivingPlaces);

  const count = drivePlaces.length;
  const countScore =
    count >= 40 ? 100 :
    count >= 25 ? 80  :
    count >= 15 ? 60  :
    count >= 8  ? 40  :
    count >= 3  ? 20  :
    0;

  const spacing = averageSpacingMeters(drivePlaces);
  const spacingScore =
    spacing === null ? 50 :
    spacing > 3000   ? 90 :
    spacing > 1500   ? 70 :
    spacing > 500    ? 50 :
    spacing > 200    ? 30 :
    10;

  console.log("[drive]", { count, countScore, spacing: spacing?.toFixed(0), spacingScore });
  return Math.round((countScore + spacingScore) / 2);
}

export function computeScores(categories: CategoryData[]): Scores {
  const walkCounts  = byType(categories, "walkingPlaces");
  const urbanCounts = byType(categories, "urbanPlaces");

  // Walk score — density + spacing blend
  let walkRaw = 0;
  for (const [type, { weight, cap }] of Object.entries(WALK_WEIGHTS)) {
    walkRaw += rawScore(walkCounts[type] ?? 0, weight, cap);
  }
  const walkDensity = Math.min(100, Math.round(walkRaw / MAX_WALK_RAW * 100));

  const walkPlaces = categories.flatMap(c => c.walkingPlaces);
  const walkSpacing = averageSpacingMeters(walkPlaces);
  const walkSpacingScore = walkSpacing === null ? 50
    : Math.max(0, Math.min(100, Math.round(100 - walkSpacing / 30)));

  const walkAmenityCount = categories.reduce((sum, c) => sum + c.walkingPlaces.length, 0);
  let walkScore = Math.round(walkDensity * 0.5 + walkSpacingScore * 0.5);
  if (walkAmenityCount < 5) walkScore = Math.min(walkScore, 25);
  walkScore = Math.min(100, walkScore);

  console.log("[walk]", { walkDensity, walkSpacingScore, walkAmenityCount });

  // Drive score — simple count + spacing, no blending weights
  const driveScore = computeDriveScore(categories);

  const walkLabel =
    walkScore >= 80 ? "Very Walkable" :
    walkScore >= 55 ? "Walkable" :
    walkScore >= 30 ? "Car-Friendly" :
    "Car-Dependent";

  const driveLabel =
    driveScore >= 80 ? "Excellent" :
    driveScore >= 55 ? "Good" :
    driveScore >= 30 ? "Limited" :
    "Remote";

  // Urban score
  let urbanPos = 0;
  for (const [type, { weight, cap }] of Object.entries(URBAN_POSITIVE)) {
    urbanPos += rawScore(urbanCounts[type] ?? 0, weight, cap);
  }
  let urbanNeg = 0;
  for (const [type, { weight, cap }] of Object.entries(URBAN_NEGATIVE)) {
    urbanNeg += rawScore(urbanCounts[type] ?? 0, weight, cap);
  }
  const urbanScore = Math.min(100, Math.max(0, Math.round(
    (urbanPos - urbanNeg + MAX_URBAN_NEG) / (MAX_URBAN_POS + MAX_URBAN_NEG) * 100
  )));
  const urbanLabel = (() => {
    if (urbanScore >= 75) return "Urban";
    if (urbanScore >= 50) return "Suburban";
    if (urbanScore >= 25) return driveScore >= 55 ? "Suburban" : "Exurban";
    if (driveScore >= 65) return "Suburban";
    if (driveScore >= 35) return "Exurban";
    return "Rural";
  })();

  return { walkScore, walkLabel, driveScore, driveLabel, urbanScore, urbanLabel };
}
