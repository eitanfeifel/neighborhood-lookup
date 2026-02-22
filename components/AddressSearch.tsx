"use client";

import { useState, useRef, useEffect } from "react";

type Prediction = google.maps.places.AutocompletePrediction;

type AddressSearchProps = {
  onSubmit: (address: string) => void;
  mapsReady?: boolean;
};

export default function AddressSearch({ onSubmit, mapsReady }: AddressSearchProps) {
  const [address, setAddress] = useState("");
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  //Wait until places and maps loaded to set up autcomplete search
  useEffect(() => {
    if (mapsReady && window.google?.maps?.places) {
      serviceRef.current = new google.maps.places.AutocompleteService();
    }
  }, [mapsReady]);

  function handleInputChange(value: string) {
    setAddress(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim() || !serviceRef.current) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      serviceRef.current!.getPlacePredictions(
        { input: value, types: ["address"] },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(predictions);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        }
      );
    }, 300);
  }

  function handleSelect(prediction: Prediction) {
    setAddress(prediction.description);
    setSuggestions([]);
    setShowSuggestions(false);
    onSubmit(prediction.description);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;
    setSuggestions([]);
    setShowSuggestions(false);
    onSubmit(trimmed);
  }

  return (
    <div style={{ position: "relative" }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          value={address}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="e.g., 1600 Amphitheatre Parkway, Mountain View, CA"
          autoComplete="off"
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid #ccc",
            borderRadius: 8,
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={!address.trim()}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            fontSize: 14,
            opacity: address.trim() ? 1 : 0.5,
            cursor: address.trim() ? "pointer" : "not-allowed",
          }}
        >
          Search
        </button>
      </form>

      {showSuggestions && suggestions.length > 0 && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "white",
            border: "1px solid #e5e5e5",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
            listStyle: "none",
            padding: "4px 0",
            margin: "4px 0 0",
            zIndex: 100,
          }}
        >
          {suggestions.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                onMouseDown={() => handleSelect(s)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  border: "none",
                  background: "none",
                  fontSize: 14,
                  cursor: "pointer",
                  color: "#333",
                  lineHeight: 1.4,
                }}
              >
                <span style={{ fontWeight: 500 }}>
                  {s.structured_formatting.main_text}
                </span>
                <span style={{ color: "#888", fontSize: 12, marginLeft: 6 }}>
                  {s.structured_formatting.secondary_text}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
