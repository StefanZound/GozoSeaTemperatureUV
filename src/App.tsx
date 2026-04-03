/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Sun, 
  Waves, 
  Clock, 
  MapPin, 
  Info, 
  ShieldCheck, 
  Timer,
  AlertTriangle,
  Droplets,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { cn } from './lib/utils';
import { 
  searchLocation, 
  getWeatherData, 
  getMarineData, 
  getUVAdvisory, 
  getWaterRating, 
  getSeaTempColor, 
  calculateSafeMinutes, 
  formatMinutes 
} from './services/api';
import { LocationData, WeatherResponse, MarineResponse } from './types';

const DEFAULT_LOCATION: LocationData = {
  name: "Marsalforn",
  latitude: 36.0714,
  longitude: 14.2586,
  timezone: "Europe/Malta",
  country: "Malta",
  admin1: "Gozo"
};

export default function App() {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState<LocationData>(DEFAULT_LOCATION);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [marine, setMarine] = useState<MarineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Sun Planner State
  const [planDuration, setPlanDuration] = useState(15);
  const [planSPF, setPlanSPF] = useState(0);
  const [planResult, setPlanResult] = useState<string | null>(null);

  const isUS = useMemo(() => {
    return location.country === "United States" || location.timezone.startsWith("America/");
  }, [location]);

  const convertTemp = (c: number) => {
    if (!isUS) return `${c.toFixed(1)}°C`;
    return `${((c * 9/5) + 32).toFixed(1)}°F`;
  };

  const fetchData = async (loc: LocationData) => {
    setLoading(true);
    setError(null);
    try {
      const [w, m] = await Promise.all([
        getWeatherData(loc.latitude, loc.longitude, loc.timezone),
        getMarineData(loc.latitude, loc.longitude, loc.timezone)
      ]);
      setWeather(w);
      setMarine(m);
    } catch (err) {
      setError("Failed to fetch data for this location.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(location);
  }, [location]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const result = await searchLocation(query);
    if (result) {
      setLocation(result);
      setQuery('');
    } else {
      setError("Location not found.");
    }
  };

  const currentHourIndex = useMemo(() => {
    if (!weather) return -1;
    const now = new Date();
    const localTimeStr = formatInTimeZone(now, location.timezone, "yyyy-MM-dd'T'HH:00:00");
    return weather.hourly.time.findIndex(t => t.startsWith(localTimeStr));
  }, [weather, location]);

  const daylightHours = useMemo(() => {
    if (!weather) return [];
    const sunrise = parseISO(weather.daily.sunrise[0]);
    const sunset = parseISO(weather.daily.sunset[0]);
    
    return weather.hourly.time.map((time, i) => ({
      time: parseISO(time),
      uv: weather.hourly.uv_index[i],
      index: i
    })).filter(h => h.time >= sunrise && h.time <= sunset);
  }, [weather]);

  const safeWindow = useMemo(() => {
    if (!weather) return null;
    const windows = daylightHours.filter(h => calculateSafeMinutes(h.uv, 0) >= 60);
    if (windows.length === 0) return "No 1-hour safe window today.";
    
    const start = format(windows[0].time, "h aa");
    const end = format(windows[windows.length - 1].time, "h aa");
    return `Safe for 1 hour without sunblock from ${start} to ${end}.`;
  }, [weather, daylightHours]);

  const calculatePlan = () => {
    if (!weather) return;
    const safeSlots = daylightHours.filter(h => calculateSafeMinutes(h.uv, planSPF) >= planDuration);
    if (safeSlots.length === 0) {
      setPlanResult(`No safe times found for ${planDuration} minutes with SPF ${planSPF}.`);
      return;
    }

    // Group consecutive slots
    const ranges: string[] = [];
    let start = safeSlots[0].time;
    let prev = safeSlots[0].time;

    for (let i = 1; i <= safeSlots.length; i++) {
      const curr = safeSlots[i]?.time;
      if (!curr || (curr.getTime() - prev.getTime()) > 3600000) {
        const startStr = format(start, "h aa");
        const endStr = format(prev, "h aa");
        ranges.push(startStr === endStr ? startStr : `${startStr} - ${endStr}`);
        if (curr) start = curr;
      }
      prev = curr;
    }

    setPlanResult(`You can be in the sun for ${planDuration} mins with SPF ${planSPF} from ${ranges.join(', ')}.`);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="bg-sea-deep text-white py-8 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight">Gozo Sea Temp & UV</h1>
              <p className="text-sea-accent/80 text-sm mt-1 flex items-center gap-1">
                <MapPin size={14} /> {location.name}, {location.admin1 || location.country}
              </p>
            </div>
            
            <form onSubmit={handleSearch} className="relative group">
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search location..."
                className="bg-white/10 border border-white/20 rounded-full py-2 pl-4 pr-10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-sea-accent w-full md:w-64 transition-all"
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white">
                <Search size={18} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-sea-light border-t-sea-accent rounded-full animate-spin" />
            <p className="text-slate-500 font-medium">Fetching coastal data...</p>
          </div>
        ) : (
          <>
            {/* Current Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sea Temperature Card */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Waves size={80} />
                </div>
                <h2 className="text-slate-500 font-semibold uppercase tracking-wider text-xs mb-4">Sea Temperature</h2>
                {marine?.current?.sea_surface_temperature ? (
                  <>
                    <div className={cn("text-7xl font-display font-bold mb-2", getSeaTempColor(marine.current.sea_surface_temperature))}>
                      {convertTemp(marine.current.sea_surface_temperature)}
                    </div>
                    <p className="text-slate-400 text-xs mb-4">
                      Updated today @ {formatInTimeZone(parseISO(marine.current.time), location.timezone, "h aa")}
                    </p>
                    <div className="bg-slate-50 rounded-2xl p-4 w-full">
                      <p className="text-slate-600 font-medium text-sm leading-relaxed italic">
                        "{getWaterRating(marine.current.sea_surface_temperature)}"
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="py-10 flex flex-col items-center gap-2">
                    <Waves size={40} className="text-slate-300" />
                    <p className="text-slate-400 font-medium">No Sea Data Found</p>
                  </div>
                )}
              </motion.div>

              {/* UV Summary Card */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col"
              >
                <h2 className="text-slate-500 font-semibold uppercase tracking-wider text-xs mb-6">Current UV Index</h2>
                {weather && currentHourIndex !== -1 ? (
                  <div className="space-y-6">
                    <div className="flex items-end gap-4">
                      <div className="text-7xl font-display font-bold text-orange-500">
                        {weather.hourly.uv_index[currentHourIndex]}
                      </div>
                      <div className="pb-2">
                        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold">
                          {getUVAdvisory(weather.hourly.uv_index[currentHourIndex]).risk}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                          <Timer size={20} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Safe Sun Time</p>
                          <p className="font-bold text-slate-700">
                            {formatMinutes(calculateSafeMinutes(weather.hourly.uv_index[currentHourIndex], 0))}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                          <Sun size={20} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Daylight</p>
                          <p className="font-bold text-slate-700">
                            {formatInTimeZone(parseISO(weather.daily.sunrise[0]), location.timezone, "h:mm aa")} - {formatInTimeZone(parseISO(weather.daily.sunset[0]), location.timezone, "h:mm aa")}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4">
                      <p className="text-orange-900/80 text-sm leading-relaxed">
                        {getUVAdvisory(weather.hourly.uv_index[currentHourIndex]).advice}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">UV data unavailable.</p>
                )}
              </motion.div>
            </div>

            {/* UV Chart Section */}
            <motion.section 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <h3 className="font-display font-bold text-lg flex items-center gap-2">
                  <Calendar size={20} className="text-sea-light" />
                  Hourly UV Forecast
                </h3>
                {safeWindow && (
                  <div className="hidden md:flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-semibold">
                    <ShieldCheck size={14} />
                    {safeWindow}
                  </div>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase tracking-widest">
                      <th className="px-6 py-4 font-semibold">Time</th>
                      <th className="px-6 py-4 font-semibold">UV Index</th>
                      <th className="px-6 py-4 font-semibold">Risk Level</th>
                      <th className="px-6 py-4 font-semibold">Max Unprotected Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {daylightHours.map((h) => {
                      const isCurrent = h.index === currentHourIndex;
                      const advisory = getUVAdvisory(h.uv);
                      return (
                        <tr key={h.index} className={cn("transition-colors", isCurrent ? "bg-sea-accent/10" : "hover:bg-slate-50/30")}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={cn("font-mono text-sm", isCurrent ? "text-sea-deep font-bold" : "text-slate-600")}>
                                {format(h.time, "h:00 aa")}
                              </span>
                              {isCurrent && <span className="text-[10px] bg-sea-deep text-white px-1.5 py-0.5 rounded uppercase font-bold">Now</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn("font-display font-bold text-lg", 
                              h.uv > 7 ? "text-red-500" : h.uv > 5 ? "text-orange-500" : h.uv > 2 ? "text-amber-500" : "text-emerald-500"
                            )}>
                              {h.uv}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn("text-xs font-semibold px-2 py-1 rounded-md",
                              h.uv > 7 ? "bg-red-50 text-red-600" : h.uv > 5 ? "bg-orange-50 text-orange-600" : h.uv > 2 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                            )}>
                              {advisory.risk}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {formatMinutes(calculateSafeMinutes(h.uv, 0))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {safeWindow && (
                <div className="md:hidden p-4 bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center gap-2">
                  <ShieldCheck size={14} />
                  {safeWindow}
                </div>
              )}
            </motion.section>

            {/* Sun Planner Section */}
            <motion.section 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-sea-deep rounded-3xl p-8 text-white shadow-xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Clock size={24} className="text-sea-accent" />
                </div>
                <h3 className="font-display font-bold text-xl">Plan Your Sun Time</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Desired Exposure</label>
                  <select 
                    value={planDuration}
                    onChange={(e) => setPlanDuration(Number(e.target.value))}
                    className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-sea-accent appearance-none"
                  >
                    <option value={15} className="text-slate-900">15 Minutes</option>
                    <option value={30} className="text-slate-900">30 Minutes</option>
                    <option value={60} className="text-slate-900">1 Hour</option>
                    <option value={120} className="text-slate-900">2 Hours</option>
                    <option value={240} className="text-slate-900">4 Hours</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">SPF Protection</label>
                  <select 
                    value={planSPF}
                    onChange={(e) => setPlanSPF(Number(e.target.value))}
                    className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-sea-accent appearance-none"
                  >
                    <option value={0} className="text-slate-900">No SPF (0)</option>
                    <option value={15} className="text-slate-900">SPF 15</option>
                    <option value={30} className="text-slate-900">SPF 30</option>
                    <option value={50} className="text-slate-900">SPF 50+</option>
                  </select>
                </div>
              </div>

              <button 
                onClick={calculatePlan}
                className="w-full bg-sea-accent text-sea-deep font-bold py-4 rounded-2xl hover:bg-white transition-colors shadow-lg"
              >
                Show Safe Hours
              </button>

              <AnimatePresence>
                {planResult && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6 p-4 bg-white/10 rounded-2xl border border-white/10"
                  >
                    <p className="text-sea-accent font-medium leading-relaxed">
                      {planResult}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>

            {/* Info Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                <h3 className="font-display font-bold text-lg mb-6 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-amber-500" />
                  Swimmer Tips
                </h3>
                <ul className="space-y-4">
                  <li className="flex gap-3">
                    <div className="mt-1 text-sea-light"><Droplets size={16} /></div>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-800">Reflection Effect:</span> Water reflects UV rays, increasing exposure. Even in "Moderate" UV, you can burn faster.</p>
                  </li>
                  <li className="flex gap-3">
                    <div className="mt-1 text-sea-light"><Sun size={16} /></div>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-800">Clouds Don’t Block UV:</span> Up to 80% of UV penetrates clouds—protect yourself even on overcast days.</p>
                  </li>
                  <li className="flex gap-3">
                    <div className="mt-1 text-sea-light"><ShieldCheck size={16} /></div>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-800">Reapply Sunscreen:</span> Water and towel-drying remove sunscreen. Reapply every 2 hours or after swimming.</p>
                  </li>
                </ul>
              </section>

              <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                <h3 className="font-display font-bold text-lg mb-6 flex items-center gap-2">
                  <ShieldCheck size={20} className="text-emerald-500" />
                  Safe Protection
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-1">Mineral-Based (Reef-Safe)</h4>
                    <p className="text-xs text-slate-500">Zinc Oxide & Titanium Dioxide provide broad-spectrum protection without harmful chemicals like Oxybenzone.</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-1">Protective Gear</h4>
                    <p className="text-xs text-slate-500">Rash guards (UPF 50+), wide-brimmed hats, and UV-blocking sunglasses are the most effective physical barriers.</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-1">Natural Boosters</h4>
                    <p className="text-xs text-slate-500">Red Raspberry Seed Oil (SPF 25-50) and Carrot Seed Oil (SPF 20-30) can boost resistance when paired with mineral sunscreen.</p>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 text-center text-slate-400 text-xs">
        <p>© {new Date().getFullYear()} Gozo Sea Temp & UV • Data via Open-Meteo</p>
      </footer>
    </div>
  );
}
