# AI/ML-Based Intelligent Anomaly Detection for Automatic Weather Stations

An intelligent weather monitoring system that detects abnormal weather readings by comparing data collected from different weather platforms and stations for a particular city.

The project uses Machine Learning and statistical techniques to identify unusual weather patterns, helping users recognize potentially inaccurate weather observations.

# Project Overview

Weather data collected from different platforms and Automatic Weather Stations (AWS) may contain inconsistencies due to sensor faults, communication errors, or environmental disturbances.

This project aims to identify such anomalies by analyzing and comparing weather parameters from multiple sources.

Users can enter a city name and view weather observations, compare readings, and identify potentially anomalous data.

# Objectives

- Collect and analyze weather data from multiple sources.
- Compare weather parameters across different platforms.
- Identify abnormal or inconsistent weather readings.
- Apply Machine Learning algorithms for anomaly detection.
- Improve the reliability of weather monitoring systems.
- Provide an easy-to-use web interface for users.

# Key Features

- **City-Based Search:** Enter a city name to analyze weather information.
- **Weather Data Comparison:** Compare readings from different weather platforms or stations.
- **Anomaly Detection:** Identify unusual or inconsistent weather observations.
- **Machine Learning Integration:** Apply anomaly detection algorithms.
- **Visual Representation:** Present weather information and detected anomalies through a web interface.
- **Automated Analysis:** Analyze weather readings and highlight potentially incorrect values.

# Machine Learning Algorithms

The project explores the following anomaly detection techniques:

### 1. Isolation Forest

An unsupervised Machine Learning algorithm that identifies anomalies by isolating unusual observations from normal data points.

### 2. Median Absolute Deviation (MAD)

A statistical technique used to detect outliers by measuring the deviation of observations from the median.

These methods help identify unusual weather readings without requiring manually labeled anomaly data.

# Technologies Used

- **Python** – Backend development and data processing.
- **Machine Learning** – Anomaly detection.
- **Isolation Forest** – Unsupervised anomaly detection.
- **Median Absolute Deviation (MAD)** – Statistical outlier detection.
- **React.js** – Frontend development (if used in the final implementation).
- **HTML, CSS, JavaScript** – Web technologies.
- **Weather APIs / Weather Data Sources** – Weather data collection.

# System Workflow

1. User enters a city name.
2. The application retrieves available weather observations.
3. Weather readings from different sources are collected.
4. Data is processed and prepared for analysis.
5. Isolation Forest and MAD techniques analyze the readings.
6. Abnormal observations are identified.
7. Results are displayed through the web interface.

# Project Structure

```text
AWS-Anomaly-Detection/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── main.py
│   ├── models/
│   ├── utils/
│   └── requirements.txt
│
├── README.md
└── .gitignore
```

# Project Information

**Project Title:** AI/ML-Based Intelligent Anomaly Detection for Automatic Weather Stations (AWS)

**Domain:** Artificial Intelligence, Machine Learning and Web Development

**Project Type:** Academic Mini Project

# Developed By

**Pushpendra Singh**

B.Tech – Computer Science Engineering (Data Science)

Ajay Kumar Garg Engineering College, Ghaziabad
