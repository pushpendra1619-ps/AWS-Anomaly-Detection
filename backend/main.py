from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from weather_api import (
    get_coordinates,
    get_weather_station_data
)

from anomaly_detector import (
    detect_anomalies,
    generate_station_summary
)

from database import (
    create_database,
    save_results,
    get_recent_cities,
    get_latest_city_results
)


app = FastAPI(
    title="AWS Anomaly Detection API",
    description="AI/ML Based Weather Station Anomaly Detection",
    version="1.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


create_database()


@app.get("/")
def home():

    return {
        "message": "AWS Anomaly Detection API is running"
    }


@app.get("/health")
def health():

    return {
        "status": "healthy"
    }


@app.get("/recent-cities")
def list_recent_cities():

    try:
        cities = get_recent_cities()
        return {"cities": cities}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@app.get("/history/{city}")
def get_history(city: str):

    try:
        stations = get_latest_city_results(city)
        if not stations:
            raise HTTPException(
                status_code=404,
                detail=f"No saved records found for city '{city}'"
            )

        station_summary = []
        for s in stations:
            station_summary.append({
                "station": s["station"],
                "average_anomaly_score": s["anomaly_score"],
                "maximum_anomaly_score": s["anomaly_score"],
                "anomalies": 1 if s["status"] == "Anomalous" else 0,
                "suspicious": 1 if s["status"] == "Suspicious" else 0
            })

        return {
            "city": city,
            "country": "",
            "latitude": 0.0,
            "longitude": 0.0,
            "stations": stations,
            "station_summary": station_summary,
            "is_history": True
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@app.get("/analyze/{city}")
def analyze_weather(city: str):

    try:

        # Step 1
        location = get_coordinates(city)

        # Step 2
        weather_df = get_weather_station_data(
            location["latitude"],
            location["longitude"]
        )

        # Step 3
        result_df = detect_anomalies(
            weather_df
        )

        # Step 4
        station_summary = (
            generate_station_summary(
                result_df
            )
        )

        # Save results
        save_results(
            location["name"],
            result_df
        )

        # Latest observation for each station
        latest = (
            result_df
            .sort_values("timestamp")
            .groupby("station")
            .tail(1)
        )

        latest_records = []

        for _, row in latest.iterrows():

            latest_records.append({
                "station": row["station"],
                "timestamp": str(
                    row["timestamp"]
                ),
                "temperature": round(
                    float(row["temperature"]),
                    2
                ),
                "humidity": round(
                    float(row["humidity"]),
                    2
                ),
                "wind_speed": round(
                    float(row["wind_speed"]),
                    2
                ),
                "pressure": round(
                    float(row["pressure"]),
                    2
                ),
                "rainfall": round(
                    float(row["rainfall"]),
                    2
                ),
                "anomaly_score": round(
                    float(
                        row["final_anomaly_score"]
                    ),
                    2
                ),
                "status": row["status"]
            })

        return {
            "city": location["name"],
            "country": location["country"],
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "stations": latest_records,
            "station_summary":
                station_summary.to_dict(
                    orient="records"
                )
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )