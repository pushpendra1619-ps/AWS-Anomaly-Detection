import requests
import pandas as pd
from datetime import datetime


GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"


def get_coordinates(city):
    params = {
        "name": city,
        "count": 1,
        "language": "en",
        "format": "json"
    }

    response = requests.get(GEOCODING_URL, params=params, timeout=15)
    response.raise_for_status()

    data = response.json()

    if "results" not in data or not data["results"]:
        raise ValueError(f"City '{city}' not found")

    result = data["results"][0]

    return {
        "name": result["name"],
        "latitude": result["latitude"],
        "longitude": result["longitude"],
        "country": result.get("country", "")
    }


def get_weather_station_data(latitude, longitude):
    """
    Fetch weather data from multiple nearby Open-Meteo
    forecast/model sources.

    NOTE:
    These are data/model sources, not necessarily physical
    AWS instruments.
    """

    sources = [
        {
            "name": "Open-Meteo ERA5",
            "model": "era5_seamless"
        },
        {
            "name": "Open-Meteo Best Match",
            "model": "best_match"
        },
        {
            "name": "Open-Meteo GFS",
            "model": "gfs_seamless"
        },
        {
            "name": "Open-Meteo ICON",
            "model": "icon_seamless"
        }
    ]

    all_data = []

    for source in sources:

        params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": ",".join([
                "temperature_2m",
                "relative_humidity_2m",
                "wind_speed_10m",
                "surface_pressure",
                "precipitation"
            ]),
            "past_days": 2,
            "forecast_days": 1,
            "timezone": "auto",
            "models": source["model"]
        }

        try:
            response = requests.get(
                WEATHER_URL,
                params=params,
                timeout=20
            )

            response.raise_for_status()

            data = response.json()

            hourly = data.get("hourly")

            if not hourly:
                continue

            df = pd.DataFrame(hourly)

            df["timestamp"] = pd.to_datetime(df["time"])

            df["station"] = source["name"]

            df = df.rename(columns={
                "temperature_2m": "temperature",
                "relative_humidity_2m": "humidity",
                "wind_speed_10m": "wind_speed",
                "surface_pressure": "pressure",
                "precipitation": "rainfall"
            })

            all_data.append(df[
                [
                    "timestamp",
                    "station",
                    "temperature",
                    "humidity",
                    "wind_speed",
                    "pressure",
                    "rainfall"
                ]
            ])

        except Exception as e:
            print(
                f"Failed to fetch {source['name']}: {e}"
            )

    if not all_data:
        raise RuntimeError("Could not obtain weather data")

    return pd.concat(
        all_data,
        ignore_index=True
    )