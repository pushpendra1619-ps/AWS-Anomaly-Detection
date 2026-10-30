import sqlite3
from pathlib import Path


DATABASE = Path(__file__).parent / "weather.db"


def create_database():

    connection = sqlite3.connect(DATABASE)

    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS weather_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city TEXT,
            timestamp TEXT,
            station TEXT,
            temperature REAL,
            humidity REAL,
            wind_speed REAL,
            pressure REAL,
            rainfall REAL,
            anomaly_score REAL,
            status TEXT
        )
        
    """)

    connection.commit()
    connection.close()


def save_results(city, df):

    connection = sqlite3.connect(DATABASE)

    records = []

    for _, row in df.iterrows():

        records.append((
            city,
            str(row["timestamp"]),
            row["station"],
            float(row["temperature"]),
            float(row["humidity"]),
            float(row["wind_speed"]),
            float(row["pressure"]),
            float(row["rainfall"]),
            float(row["final_anomaly_score"]),
            row["status"]
        ))

    connection.executemany(
        """
        INSERT INTO weather_records
        (
            city,
            timestamp,
            station,
            temperature,
            humidity,
            wind_speed,
            pressure,
            rainfall,
            anomaly_score,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        records
    )

    connection.commit()
    connection.close()


def get_recent_cities(limit=10):
    connection = sqlite3.connect(DATABASE)
    cursor = connection.cursor()
    cursor.execute("""
        SELECT city, MAX(timestamp) as last_seen
        FROM weather_records
        GROUP BY city
        ORDER BY last_seen DESC
        LIMIT ?
    """, (limit,))
    cities = [row[0] for row in cursor.fetchall()]
    connection.close()
    return cities


def get_latest_city_results(city):
    connection = sqlite3.connect(DATABASE)
    cursor = connection.cursor()
    cursor.execute("""
        SELECT timestamp, station, temperature, humidity, wind_speed, pressure, rainfall, anomaly_score, status
        FROM weather_records
        WHERE LOWER(city) = LOWER(?)
        ORDER BY timestamp DESC
    """, (city,))
    rows = cursor.fetchall()
    connection.close()
    if not rows:
        return None

    # Group by station to get latest record per station
    seen_stations = set()
    stations = []
    for r in rows:
        station_name = r[1]
        if station_name not in seen_stations:
            seen_stations.add(station_name)
            stations.append({
                "station": r[1],
                "timestamp": r[0],
                "temperature": round(r[2], 2),
                "humidity": round(r[3], 2),
                "wind_speed": round(r[4], 2),
                "pressure": round(r[5], 2),
                "rainfall": round(r[6], 2),
                "anomaly_score": round(r[7], 2),
                "status": r[8]
            })
    return stations
