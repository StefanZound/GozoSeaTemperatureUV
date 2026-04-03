export interface LocationData {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country?: string;
  admin1?: string;
}

export interface UVData {
  time: string[];
  uv_index: number[];
}

export interface SeaData {
  temperature: number | null;
  time: string;
}

export interface WeatherResponse {
  hourly: {
    time: string[];
    uv_index: number[];
  };
  daily: {
    sunrise: string[];
    sunset: string[];
  };
}

export interface MarineResponse {
  current: {
    sea_surface_temperature: number;
    time: string;
  };
}
