"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search } from "lucide-react";

// Use CDN-hosted marker icons since Leaflet's default image paths don't
// resolve correctly through Next.js/webpack.
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER: [number, number] = [33.749, -84.388]; // Atlanta, GA

interface VenueLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterOnChange({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, map.getZoom());
  }, [position, map]);
  return null;
}

export default function VenueLocationPicker({
  latitude,
  longitude,
  onChange,
}: VenueLocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const position: [number, number] =
    latitude !== null && longitude !== null ? [latitude, longitude] : DEFAULT_CENTER;
  const hasPosition = latitude !== null && longitude !== null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          searchQuery
        )}`
      );
      const results = await res.json();
      if (results.length === 0) {
        setSearchError("No location found for that search");
        return;
      }
      onChange(parseFloat(results[0].lat), parseFloat(results[0].lon));
    } catch (error) {
      console.error("Geocoding search failed:", error);
      setSearchError("Search failed, please try again");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500 text-sm"
          placeholder="Search for an address..."
        />
        <button
          type="submit"
          disabled={searching}
          className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          <Search size={14} />
          {searching ? "Searching..." : "Search"}
        </button>
      </form>
      {searchError && (
        <p className="text-red-400 text-xs mb-2">{searchError}</p>
      )}

      <div className="rounded-lg overflow-hidden border border-white/10" style={{ height: 250 }}>
        <MapContainer
          center={position}
          zoom={hasPosition ? 16 : 11}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onPick={onChange} />
          <RecenterOnChange position={position} />
          {hasPosition && (
            <Marker
              position={position}
              icon={markerIcon}
              draggable
              ref={markerRef}
              eventHandlers={{
                dragend: () => {
                  const marker = markerRef.current;
                  if (marker) {
                    const { lat, lng } = marker.getLatLng();
                    onChange(lat, lng);
                  }
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      <p className="text-white/40 text-xs mt-1.5">
        Search for an address, click the map, or drag the pin to set the exact check-in location.
      </p>
    </div>
  );
}
