import { LocationData, WeatherResponse, MarineResponse } from "../types";

const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const MARINE_API = "https://marine-api.open-meteo.com/v1/marine";

export async function searchLocation(query: string): Promise<LocationData | null> {
  try {
    const res = await fetch(`${GEO_API}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;
    const result = data.results[0];
    return {
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone,
      country: result.country,
      admin1: result.admin1,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

export async function getWeatherData(lat: number, lon: number, timezone: string): Promise<WeatherResponse | null> {
  try {
    const res = await fetch(
      `${WEATHER_API}?latitude=${lat}&longitude=${lon}&hourly=uv_index&daily=sunrise,sunset&forecast_days=1&timezone=${encodeURIComponent(timezone)}`
    );
    return await res.json();
  } catch (error) {
    console.error("Weather API error:", error);
    return null;
  }
}

export async function getMarineData(lat: number, lon: number, timezone: string): Promise<MarineResponse | null> {
  try {
    const res = await fetch(
      `${MARINE_API}?latitude=${lat}&longitude=${lon}&current=sea_surface_temperature&timezone=${encodeURIComponent(timezone)}`
    );
    return await res.json();
  } catch (error) {
    // Marine API might fail for inland locations
    console.warn("Marine API error (likely inland):", error);
    return null;
  }
}

export function getUVAdvisory(uv: number) {
  if (uv <= 2) return { risk: "Low", advice: "Minimal risk. No protection needed for short swims. Still apply SPF if sensitive to sun." };
  if (uv <= 5) return { risk: "Moderate", advice: "Moderate risk. Wear water-resistant SPF 30+, sunglasses, and a rash guard if swimming for >30 mins. Reapply sunscreen after drying off." };
  if (uv <= 7) return { risk: "High", advice: "High risk. Seek shade during peak hours (11 AM–3 PM). Use SPF 50+, UV-blocking swimwear, a wide-brimmed hat, and reapply sunscreen every 2 hours." };
  if (uv <= 10) return { risk: "Very High", advice: "Very high risk. Limit swimming to early morning/late afternoon. Wear a long-sleeve rash guard, SPF 50+, and waterproof lip balm. Stay hydrated." };
  return { risk: "Extreme", advice: "Extreme risk. Avoid swimming at midday. Full sun protection essential: rash guard, SPF 50+, hat, UV sunglasses, and frequent shade breaks." };
}

export function getWaterRating(tempC: number) {
  if (tempC < 15) return "Extremely cold. High risk of cold shock.";
  if (tempC < 16) return "Very cold. Risk of cold shock. Only for short dips or wetsuit use.";
  if (tempC < 18) return "Chilly. Tolerable for short swims; wetsuits recommended for most.";
  if (tempC < 20) return "Cool but manageable. Comfortable for acclimatised swimmers.";
  if (tempC < 22) return "Pleasant. Warm enough for extended swimming without gear for many.";
  if (tempC < 25) return "Very warm. Ideal for all swimmers, including children.";
  if (tempC <= 27) return "Balmy. Feels like bathwater—perfect for snorkelling and long swims.";
  return "Hot. Very warm water, like a heated pool.";
}

export function getSeaTempColor(tempC: number) {
  if (tempC < 15) return "text-blue-900";
  if (tempC < 18) return "text-blue-600";
  if (tempC < 20) return "text-cyan-500";
  if (tempC < 22) return "text-emerald-500";
  if (tempC < 24) return "text-yellow-500";
  if (tempC < 26) return "text-orange-500";
  return "text-red-500";
}

export function calculateSafeMinutes(uv: number, spf: number = 0): number {
  if (uv <= 0.5) return 480; // 8 hours max
  const baseMinutes = 200 / uv;
  const multiplier = spf === 0 ? 1 : spf;
  return Math.min(baseMinutes * multiplier, 1440); // Cap at 24 hours
}

export function formatMinutes(mins: number): string {
  if (mins >= 480) return "All day";
  if (mins < 1) return "< 1 min";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} mins`;
}
