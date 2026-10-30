import numpy as np
import pandas as pd

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


FEATURES = [
    "temperature",
    "humidity",
    "wind_speed",
    "pressure",
    "rainfall"
]


def clean_data(df):

    df = df.copy()

    for feature in FEATURES:
        df[feature] = pd.to_numeric(
            df[feature],
            errors="coerce"
        )

    df = df.dropna(subset=FEATURES)

    return df


def calculate_peer_deviation(df):

    df = df.copy()

    for feature in FEATURES:

        median_values = (
            df.groupby("timestamp")[feature]
            .transform("median")
        )

        mad_values = (
            df.groupby("timestamp")[feature]
            .transform(
                lambda x: np.median(
                    np.abs(x - np.median(x))
                )
            )
        )

        mad_values = mad_values.replace(0, np.nan)

        deviation = (
            np.abs(df[feature] - median_values)
            / mad_values
        )

        df[f"{feature}_deviation"] = (
            deviation.replace(
                [np.inf, -np.inf],
                np.nan
            ).fillna(0)
        )

    deviation_columns = [
        f"{feature}_deviation"
        for feature in FEATURES
    ]

    df["peer_deviation"] = (
        df[deviation_columns]
        .mean(axis=1)
    )

    return df


def detect_anomalies(df):

    df = clean_data(df)

    if len(df) < 10:
        raise ValueError(
            "Not enough weather observations for ML analysis"
        )

    # Standardize variables
    scaler = StandardScaler()

    X = scaler.fit_transform(
        df[FEATURES]
    )

    # Isolation Forest
    model = IsolationForest(
        contamination=0.10,
        random_state=42,
        n_estimators=200
    )

    predictions = model.fit_predict(X)

    raw_scores = model.decision_function(X)

    df["ml_prediction"] = predictions

    # -1 = anomaly
    # +1 = normal

    min_score = raw_scores.min()
    max_score = raw_scores.max()

    if max_score != min_score:

        anomaly_score = (
            (max_score - raw_scores)
            / (max_score - min_score)
        ) * 100

    else:
        anomaly_score = np.zeros(
            len(raw_scores)
        )

    df["ml_anomaly_score"] = anomaly_score

    df = calculate_peer_deviation(df)

    # Combine ML score and peer deviation

    peer_score = np.clip(
        df["peer_deviation"] * 15,
        0,
        100
    )

    df["final_anomaly_score"] = (
        0.7 * df["ml_anomaly_score"]
        + 0.3 * peer_score
    )

    df["status"] = np.where(
        df["final_anomaly_score"] >= 70,
        "Anomalous",
        np.where(
            df["final_anomaly_score"] >= 45,
            "Suspicious",
            "Normal"
        )
    )

    return df


def generate_station_summary(df):

    summary = (
        df.groupby("station")
        .agg(
            observations=("station", "count"),
            average_anomaly_score=(
                "final_anomaly_score",
                "mean"
            ),
            maximum_anomaly_score=(
                "final_anomaly_score",
                "max"
            ),
            anomalies=(
                "status",
                lambda x: (x == "Anomalous").sum()
            ),
            suspicious=(
                "status",
                lambda x: (x == "Suspicious").sum()
            )
        )
        .reset_index()
    )

    summary["average_anomaly_score"] = (
        summary["average_anomaly_score"]
        .round(2)
    )

    summary["maximum_anomaly_score"] = (
        summary["maximum_anomaly_score"]
        .round(2)
    )

    summary = summary.sort_values(
        "average_anomaly_score",
        ascending=False
    )

    return summary