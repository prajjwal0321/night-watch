# NIGHTWATCH — Data Collection and Methodology

## 1. Overview

NIGHTWATCH retrieves mapped streetlight and public amenity records around a selected walking route. It processes these records to identify features located near the route and presents the results on an interactive map.

The application uses OpenStreetMap data and its associated geocoding, routing, and query services.

## 2. Route Generation

Users provide starting and destination locations.

- **Geocoding:** Nominatim converts location searches into geographic coordinates.
- **Routing:** The OpenStreetMap routed-foot service generates walking routes.
- **Route alternatives:** The routing request allows up to three alternative routes.
- **Route geometry:** The application uses the returned GeoJSON coordinates to represent each route.

## 3. Coordinate Sampling

The selected route may contain many geographic coordinates. To limit the amount of data requested, NIGHTWATCH samples the route before querying the environmental data service.

The sampling process:
- Uses a maximum target of 40 coordinates.
- Calculates a sampling interval based on the route geometry.
- Retains the final route coordinate when it is not already included.

This reduces the number of query locations while maintaining coverage along the route.

## 4. Environmental Data Retrieval

The frontend sends the sampled coordinates to the Express backend through:

`POST /api/area-data`

The backend validates the submitted coordinates and accepts between 1 and 50 valid points.

For each coordinate, the backend queries the Overpass API for mapped OpenStreetMap objects within a 60-metre radius.

The requested feature categories are:

| Category | OpenStreetMap tags |
|---|---|
| Streetlights | `highway=street_lamp` |
| Streetlights | `man_made=street_lamp` |
| Benches | `amenity=bench` |
| Drinking water | `amenity=drinking_water` |
| Toilets | `amenity=toilets` |

The backend returns the retrieved records to the frontend.

## 5. Feature Processing

The frontend:
1. Removes duplicate records using each element's type and ID.
2. Extracts geographic coordinates from the element or its centre.
3. Classifies records as either streetlights or amenities.
4. Retains records with valid latitude and longitude values.
5. Uses available OpenStreetMap names or descriptive fallback labels.

## 6. Route Proximity Calculation

NIGHTWATCH uses a 30-metre threshold to identify features near the selected route.

For each mapped feature, the application calculates its distance from the individual line segments making up the route.

The calculation uses a local approximation to convert latitude and longitude differences into metres. A feature is counted as nearby if its calculated distance from any route segment is 30 metres or less.

The application then calculates:
- The number of nearby mapped streetlights.
- The number of nearby mapped public amenities.

## 7. Technology and Data Sources

| Component | Technology or service |
|---|---|
| Frontend | React, TypeScript, Vite |
| Interactive map | Leaflet, React Leaflet |
| Geocoding | Nominatim |
| Walking routes | OpenStreetMap routed-foot service |
| Environmental data | Overpass API |
| Geographic data | OpenStreetMap |
| Backend | Node.js, Express |
| Frontend hosting | Vercel |
| Backend hosting | Render |

## 8. Limitations

NIGHTWATCH reports mapped geographic records, not verified real-world conditions.

- OpenStreetMap coverage may be incomplete or outdated.
- An unrecorded streetlight or amenity may still exist physically.
- A mapped feature does not guarantee that it is functional or accessible.
- Coordinate sampling may miss features between sampled query locations.
- The 60-metre retrieval radius and 30-metre proximity threshold are computational parameters, not guarantees of complete coverage.
- The distance calculation uses a local geographic approximation rather than a full geodesic calculation.
- Feature counts should not be interpreted as a safety score or guarantee of route safety.

NIGHTWATCH is intended as an informational route-awareness tool. Its results should be interpreted alongside real-world judgement and local conditions.