// Used by scoring — subset of categories that matter for each metric
export const WALK_TYPES = [
  "grocery_or_supermarket",
  "pharmacy",
  "cafe",
  "park",
  "transit_station",
];

export const DRIVE_TYPES = [
  "shopping_mall",
  "grocery_or_supermarket",
  "gym",
  "hospital",
  "gas_station",
  "restaurant",
];

// All categories shown in the amenities panel — used for map legend
export const ALL_WALK_TYPES = [
  "grocery_or_supermarket",
  "restaurant",
  "gym",
  "gas_station",
  "shopping_mall",
  "cafe",
  "pharmacy",
  "park",
  "hospital",
  "transit_station",
  "tourist_attraction",
];

export const ALL_DRIVE_TYPES = [
  "grocery_or_supermarket",
  "restaurant",
  "gym",
  "gas_station",
  "shopping_mall",
  "cafe",
  "pharmacy",
  "park",
  "hospital",
  "tourist_attraction",
  // transit_station excluded — drivingPlaces is always empty for it
];

export const TYPE_COLORS: Record<string, string> = {
  grocery_or_supermarket: "#16a34a",
  pharmacy:               "#9333ea",
  cafe:                   "#d97706",
  park:                   "#15803d",
  transit_station:        "#2563eb",
  shopping_mall:          "#db2777",
  gym:                    "#ea580c",
  hospital:               "#dc2626",
  gas_station:            "#64748b",
  restaurant:             "#f59e0b",
  tourist_attraction:     "#7c3aed",
};

export const TYPE_LABELS: Record<string, string> = {
  grocery_or_supermarket: "🛒 Grocery",
  pharmacy:               "💊 Pharmacy",
  cafe:                   "☕ Cafe",
  park:                   "🌳 Park",
  transit_station:        "🚌 Transit",
  shopping_mall:          "🛍️ Shopping",
  gym:                    "🏋️ Gym",
  hospital:               "🏥 Hospital",
  gas_station:            "⛽ Gas",
  restaurant:             "🍽️ Restaurant",
  tourist_attraction:     "🎭 Other Attractions",
};
