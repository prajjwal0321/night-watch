type AreaFeature = {
  id: number;
  type: string;
  lat: number;
  lon: number;
  category: "streetlight" | "amenity";
  name: string;
};

type AreaData = {
  features: AreaFeature[];
  fetchedAt: string;
};

import { useEffect, useState } from "react";
import {
  Clock3,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  Sparkles,
  Trees,
  Zap,
  Route as RouteIcon,
} from "lucide-react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
} from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./index.css";

type Place = {
  name: string;
  lat: number;
  lon: number;
};

type RouteData = {
  coordinates: [number, number][];
  distance: number;
  duration: number;

};

const DEFAULT_PLACE: Place = {
  name: "Lucknow, Uttar Pradesh, India",
  lat: 26.8467,
  lon: 80.9462,
};

function formatDistance(meters: number) {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(2)} km`
    : `${Math.round(meters)} m`;
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

function FitRoute({ route }: { route: RouteData | null }) {
  const map = useMap();

  useEffect(() => {
    if (!route || route.coordinates.length === 0) return;

    const bounds: LatLngBoundsExpression = route.coordinates.map(
      ([lat, lon]) => [lat, lon] as [number, number],
    );

    map.fitBounds(bounds, { padding: [55, 55], maxZoom: 16 });
  }, [map, route]);

  return null;
}


async function geocodePlace(query: string): Promise<Place> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      { signal: controller.signal },
    );

    if (!response.ok) {
      throw new Error(
        `Location search failed (${response.status}). Please try again shortly.`,
      );
    }

    const results = (await response.json()) as {
      display_name: string;
      lat: string;
      lon: string;
    }[];

    if (!results.length) {
      throw new Error(
        `No location found for "${query}". Try a more specific address.`,
      );
    }

    return {
      name: results[0].display_name,
      lat: Number(results[0].lat),
      lon: Number(results[0].lon),
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "Location search took too long. Please try again.",
      );
    }

    if (err instanceof TypeError) {
      throw new Error(
        "Could not connect to location search. Check your internet connection.",
      );
    }

    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}




type SingleRouteData = {
  coordinates: [number, number][];
  distance: number;
  duration: number;
};

async function getWalkingRoute(
  from: Place,
  to: Place,
): Promise<SingleRouteData[]> {
  const url =
    `https://routing.openstreetmap.de/routed-foot/route/v1/foot/` +
    `${from.lon},${from.lat};${to.lon},${to.lat}` +
    `?overview=full&geometries=geojson&alternatives=3`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `The walking route service returned error ${response.status}. Please try again shortly.`,
      );
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes?.length) {
      throw new Error(
        "No walking route was found between these locations. Try more specific addresses.",
      );
    }

    return data.routes.map((result: any): SingleRouteData => ({
      coordinates: result.geometry.coordinates.map(
        ([lon, lat]: [number, number]) => [lat, lon],
      ),
      distance: result.distance,
      duration: result.duration,
    }));
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "The routing service took too long to respond. Please try again.",
      );
    }

    if (err instanceof TypeError) {
      throw new Error(
        "Could not connect to the routing service. Check your internet connection and try again.",
      );
    }

    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}



const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function fetchAreaData(route: SingleRouteData): Promise<AreaData> {
  const coordinates = route.coordinates;
  const maxPoints = 40;

  const step = Math.max(
    1,
    Math.ceil((coordinates.length - 1) / (maxPoints - 1)),
  );

  const sampledCoordinates = coordinates.filter(
    (_, index) => index % step === 0,
  );

  const lastCoordinate = coordinates[coordinates.length - 1];

  if (
    sampledCoordinates.length === 0 ||
    sampledCoordinates[sampledCoordinates.length - 1] !== lastCoordinate
  ) {
    sampledCoordinates.push(lastCoordinate);
  }

  const points = sampledCoordinates.map(([lat, lon]) => ({ lat, lon }));

  const response = await fetch(`${API_BASE_URL}/api/area-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ points }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(
      result.error ?? "Could not load route data. Try again later.",
    );
  }

  const result = await response.json();

  if (!Array.isArray(result.elements)) {
    throw new Error("The map-data service returned an unexpected response.");
  }

  const uniqueElements = new Map<string, any>();

  for (const element of result.elements) {
    uniqueElements.set(`${element.type}-${element.id}`, element);
  }

  const features: AreaFeature[] = Array.from(uniqueElements.values())
    .map((element: any): AreaFeature | null => {
      const tags = element.tags ?? {};
      const point = element.center ?? element;

      if (
        typeof point.lat !== "number" ||
        typeof point.lon !== "number"
      ) {
        return null;
      }

      const category =
  tags.highway === "street_lamp" ||
  tags.man_made === "street_lamp"
    ? "streetlight"
    : "amenity";

      return {
        id: element.id,
        type: element.type,
        lat: point.lat,
        lon: point.lon,
        category,
        name:
          tags.name ??
          (category === "streetlight"
            ? "Mapped streetlight"
            : String(tags.amenity ?? "public amenity").replaceAll("_", " ")),
      };
    })
    .filter((feature): feature is AreaFeature => feature !== null);

  return {
    features,
    fetchedAt: new Date().toISOString(),
  };
}


function distanceToSegment(
  point: [number, number],
  start: [number, number],
  end: [number, number],
): number {
  const lat = (point[0] * Math.PI) / 180;
  const metersPerLon = 111320 * Math.cos(lat);
  const metersPerLat = 110540;

  const px = 0;
  const py = 0;

  const sx = (start[1] - point[1]) * metersPerLon;
  const sy = (start[0] - point[0]) * metersPerLat;
  const ex = (end[1] - point[1]) * metersPerLon;
  const ey = (end[0] - point[0]) * metersPerLat;

  const dx = ex - sx;
  const dy = ey - sy;

  const lengthSquared = dx * dx + dy * dy;

  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((px - sx) * dx + (py - sy) * dy) / lengthSquared),
        );

  const closestX = sx + t * dx;
  const closestY = sy + t * dy;

  return Math.sqrt(closestX ** 2 + closestY ** 2);
}

function getRouteIndicators(
  selectedRoute: SingleRouteData,
  features: AreaFeature[],
) {
  const nearbyFeatures = features.filter((feature) => {
    const point: [number, number] = [feature.lat, feature.lon];

    for (let i = 0; i < selectedRoute.coordinates.length - 1; i++) {
      if (
        distanceToSegment(
          point,
          selectedRoute.coordinates[i],
          selectedRoute.coordinates[i + 1],
        ) <= 30
      ) {
        return true;
      }
    }

    return false;
  });

  return {
    streetlights: nearbyFeatures.filter(
      (feature) => feature.category === "streetlight",
    ).length,
    amenities: nearbyFeatures.filter(
      (feature) => feature.category === "amenity",
    ).length,
  };
}



function App() {
  const [fromQuery, setFromQuery] = useState("Lucknow, Uttar Pradesh, India");
  const [toQuery, setToQuery] = useState("Hazratganj, Lucknow, India");
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeOptions, setRouteOptions] = useState<SingleRouteData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nightMode, setNightMode] = useState(true);
const [areaData, setAreaData] = useState<AreaData | null>(null);
const [areaLoading, setAreaLoading] = useState(false);
const [areaError, setAreaError] = useState("");
const [showAreaFeatures, setShowAreaFeatures] = useState(true);
async function loadRouteEnvironment(route: SingleRouteData) {
  setAreaLoading(true);
  setAreaError("");
  setAreaData(null);

  try {
    const data = await fetchAreaData(route);
    setAreaData(data);
  } catch (err) {
    setAreaError(
      err instanceof Error
        ? err.message
        : "Could not load route environment data.",
    );
  } finally {
    setAreaLoading(false);
  }
}

function selectRoute(option: SingleRouteData) {
  setRoute(option);
  void loadRouteEnvironment(option);
}
const routeIndicators =
  route && areaData
    ? getRouteIndicators(route, areaData.features)
    : null;


  async function handleRouteSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fromQuery.trim() || !toQuery.trim()) {
      setError("Enter both a starting point and a destination.");
      return;
    }

    setLoading(true);
    setError("");
    setRoute(null);

    try {
      const start = await geocodePlace(fromQuery.trim());

      // Respect public geocoding service usage limits.
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const end = await geocodePlace(toQuery.trim());

      if (
        Math.abs(start.lat - end.lat) < 0.00001 &&
        Math.abs(start.lon - end.lon) < 0.00001
      ) {
        throw new Error("Choose two different locations.");
      }

setOrigin(start);
setDestination(end);
setAreaData(null);
setAreaError("");
const walkingRoutes = await getWalkingRoute(start, end);

setRouteOptions(walkingRoutes);
setRoute(walkingRoutes[0] ?? null);


await loadRouteEnvironment(walkingRoutes[0]);


    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const center: [number, number] = origin
    ? [origin.lat, origin.lon]
    : [DEFAULT_PLACE.lat, DEFAULT_PLACE.lon];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Nightwatch home">
          <span className="brand-icon">
            <ShieldCheck size={23} />
          </span>
          <span>
            <span className="brand-name">NIGHTWATCH</span>
            <span className="brand-caption">URBAN INTELLIGENCE</span>
          </span>
        </a>

        

        <section className="sidebar-section">
          <div className="section-label">YOUR JOURNEY</div>
          <h1>Move with<br />more awareness.</h1>
          <p className="muted intro">
            Explore real places and discover walking routes before you head out.
          </p>

          <form className="route-form" onSubmit={handleRouteSearch}>
            <label className="input-label" htmlFor="from">
              STARTING POINT
            </label>
            <div className="search-box">
              <LocateFixed size={16} />
              <input
                id="from"
                value={fromQuery}
                onChange={(e) => setFromQuery(e.target.value)}
                placeholder="Address or landmark"
                required
              />
            </div>

            <label className="input-label destination-label" htmlFor="to">
              DESTINATION
            </label>
            <div className="search-box">
              <Search size={16} />
              <input
                id="to"
                value={toQuery}
                onChange={(e) => setToQuery(e.target.value)}
                placeholder="Where do you want to go?"
                required
              />
            </div>

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? (
                <span className="loading-dot">Finding your route...</span>
              ) : (
                <>
                  <RouteIcon size={17} />
                  Find walking route
                </>
              )}
            </button>
          </form>

          {error && <div className="error-message">{error}</div>}
        </section>

        <section className="sidebar-section">
          <div className="section-label">ROUTE OVERVIEW</div>

          {route ? (
            <>
              <div className="route-stat-grid">
                <div className="route-stat">
                  <Navigation size={17} />
                  <strong>{formatDistance(route.distance)}</strong>
                  <small>Distance</small>
                </div>
                <div className="route-stat">
                  <Clock3 size={17} />
                  <strong>{formatDuration(route.duration)}</strong>
                  <small>Estimated walking</small>
                </div>
              </div>
              <p className="muted helper-text">
                Estimates from the routing service; actual conditions may vary.
              </p>
            </>
          ) : (
            <p className="muted helper-text">
              Your distance and estimated walking time will appear here after
              a route is calculated.
            </p>
          )}
        </section>



<section className="sidebar-section">
  <div className="section-label">ALTERNATIVE WALKING ROUTES</div>

  {routeOptions.length > 0 ? (
    <div className="route-options">
      {routeOptions.map((option, index) => {
        const shortestDistance = Math.min(
          ...routeOptions.map((item) => item.distance)
        );

        const fastestDuration = Math.min(
          ...routeOptions.map((item) => item.duration)
        );

        return (
          <button
            key={index}
            type="button"
            className={`route-option ${route === option ? "active" : ""}`}
            onClick={() => selectRoute(option)}
          >
            <span>
              <strong>Route {index + 1}</strong>
              <small>{formatDistance(option.distance)}</small>

              <span className="route-badges">
                {option.distance === shortestDistance && (
                  <small className="route-badge shortest">Shortest</small>
                )}
                {option.duration === fastestDuration && (
                  <small className="route-badge fastest">Fastest</small>
                )}
              </span>
            </span>

            <span>
              <strong>{formatDuration(option.duration)}</strong>
              <small>{route === option ? "Selected" : "View route"}</small>
            </span>
          </button>
        );
      })}
    </div>
  ) : (
    <p className="muted helper-text">
      Alternative routes will appear when available.
    </p>
  )}
</section>


<section className="sidebar-section">
  <div className="section-label">ROUTE ENVIRONMENT</div>

  {!route ? (
    <p className="muted helper-text">
      Calculate a walking route to see nearby mapped features.
    </p>
  ) : areaLoading ? (
    <p className="muted helper-text">
      Loading mapped area records…
    </p>
  ) : areaError ? (
    <p className="muted helper-text">
      Area records could not be loaded.
    </p>
  ) : routeIndicators ? (
    <>
      <div className="indicator-row">
        <span className="indicator-icon lime">
          <Zap size={17} />
        </span>
        <span className="indicator-copy">
          <strong>Streetlights near route</strong>
          <small>{routeIndicators.streetlights} mapped records within 30 m</small>
        </span>
      </div>

      <div className="indicator-row">
        <span className="indicator-icon blue">
          <Trees size={17} />
        </span>
        <span className="indicator-copy">
          <strong>Public amenities near route</strong>
          <small>{routeIndicators.amenities} mapped records within 30 m</small>
        </span>
      </div>

      <p className="muted helper-text">
         Counts include mapped records found within 60 m of sampled points along this route. Nearby counts are measured within 30 m of the route. OpenStreetMap records may be incomplete or outdated; this is not a safety rating.
      </p>
    </>
  ) : null}
</section>




        
<section className="sidebar-section">
  <div className="section-label"> MAPPED ROUTE FEATURES</div>

  <div className="area-data-heading">
    <span>
      {areaLoading
        ? "Collecting mapped records…"
        : areaData
          ? `${areaData.features.length} mapped features`
          : "No area data loaded"}
    </span>

    <button
      className="area-toggle"
      type="button"
      onClick={() => setShowAreaFeatures(!showAreaFeatures)}
    >
      {showAreaFeatures ? "Hide map layer" : "Show map layer"}
    </button>
  </div>

  <div className="indicator-row">
    <span className="indicator-icon lime"><Zap size={17} /></span>
    <span className="indicator-copy">
      <strong>Mapped streetlights</strong>
      <small>
        {areaLoading
          ? "Loading records…"
          : areaData
            ? `${areaData.features.filter((f) => f.category === "streetlight").length} recorded`
            : "Awaiting data"}
      </small>
    </span>
  </div>

  <div className="indicator-row">
    <span className="indicator-icon blue"><Trees size={17} /></span>
    <span className="indicator-copy">
      <strong>Public amenities</strong>
      <small>
  {areaLoading
    ? "Loading records…"
    : areaData
      ? `${areaData.features.filter((f) => f.category === "amenity").length} recorded`
      : "Awaiting data"}
</small>
    </span>
  </div>

  {areaError && <div className="error-message">{areaError}</div>}

  {areaData && (
    <p className="muted helper-text">
      Source: OpenStreetMap contributors. Retrieved{" "}
      {new Date(areaData.fetchedAt).toLocaleTimeString()}. These counts
      represent mapped records, not verified real-world coverage or a
      safety rating.
    </p>
  )}

  <p className="muted helper-text">
    No mapped record does not necessarily mean the feature is absent.
  </p>
</section>


        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>
              <strong>Evidence over assumptions</strong>
              <small>Missing data does not mean a place is unsafe.</small>
            </span>
          </div>
          <div className="sidebar-footer">
            NIGHTWATCH <span>·</span> PROTOTYPE 0.2
          </div>
        </div>
      </aside>

      <section className="map-panel">
        <header className="map-topbar">
          <div className="breadcrumb">
            <span>Explore</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{destination?.name.split(",")[0] ?? "Lucknow"}</strong>
          </div>

          <div className="topbar-actions">
            <span className="data-status">
              <span className="live-dot" />
              INTERACTIVE MAP
            </span>
            <button
              className="icon-button"
              onClick={() => setNightMode(!nightMode)}
              aria-label="Toggle map appearance"
              title="Toggle map appearance"
              type="button"
            >
              {nightMode ? "☀" : "☾"}
            </button>
          </div>
        </header>

        <div className="map-canvas">
          <MapContainer
            center={center}
            zoom={13}
            zoomControl={false}
            className={`leaflet-map ${nightMode ? "night-map" : ""}`}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ZoomControl position="bottomright" />
            <FitRoute route={route} />

            {origin && (
              <CircleMarker
                center={[origin.lat, origin.lon]}
                radius={8}
                
pathOptions={{
  color: "#172C2A",
  fillColor: "#57958A",
  fillOpacity: 1,
  weight: 2,
}}

              />
            )}

            {destination && (
              <CircleMarker
                center={[destination.lat, destination.lon]}
                radius={8}
                
pathOptions={{
  color: "#38291F",
  fillColor: "#D18B55",
  fillOpacity: 1,
  weight: 2,
}}

              /> )}

            
      
{routeOptions.map((option, index) =>
  option !== route ? (
    <Polyline
      key={`alternative-${index}`}
      positions={option.coordinates}
      pathOptions={{
        color: "#84918A",
        weight: 4,
        opacity: 0.55,
        dashArray: "8 10",
      }}
    />
  ) : null
)}

{route && (
  <Polyline
    positions={route.coordinates}
    pathOptions={{
      color: "#D18B55",
      weight: 6,
      opacity: 1,
    }}
  />
)}

{showAreaFeatures &&
  areaData?.features.map((feature) => (
    <CircleMarker
      key={`${feature.type}-${feature.id}`}
      center={[feature.lat, feature.lon]}
      radius={feature.category === "streetlight" ? 6 : 5}
      pathOptions={{
        color:
          feature.category === "streetlight" ? "#D9B85B" : "#69A6D8",
        fillColor:
          feature.category === "streetlight" ? "#D9B85B" : "#69A6D8",
        fillOpacity: 0.9,
        weight: 1,
      }}
    >
      <Popup>
        <strong>
          {feature.category === "streetlight"
            ? "Mapped streetlight"
            : "Public amenity"}
        </strong>
        <br />
        {feature.name}
      </Popup>
    </CircleMarker>
  ))}


          </MapContainer>
          
          <div className="map-legend">
  <span><i className="legend-dot streetlight" /> Streetlight</span>
  <span><i className="legend-dot amenity" /> Public amenity</span>
  <span><i className="legend-dot origin" /> Starting point</span>
  <span><i className="legend-dot destination" /> Destination</span>
</div>

          <div className="map-floating-label">
            <span className="map-pin-icon"><MapPin size={16} /></span>
            <span>
              <strong>
                {destination?.name.split(",")[0] ?? "Lucknow"}
              </strong>
              <small>
                {route ? "Walking route displayed" : "Search two places to begin"}
              </small>
            </span>
          </div>

          <div className="map-attribution-note">
            © OpenStreetMap contributors
          </div>
        </div>

        <section className="bottom-panel">
          <div className="bottom-heading">
            <div>
              <div className="section-label">NIGHTWATCH ROUTING</div>
              <h2>{route ? "Your route is ready." : "Plan your next journey."}</h2>
            </div>
            <span className="coming-soon">
              <Sparkles size={14} /> {route ? "ROUTE FOUND" : "MVP 0.2"}
            </span>
          </div>

          <div className="journey-grid">
            <div className="journey-card">
              <div className="journey-icon"><Navigation size={18} /></div>
              <div>
                <strong>Walking directions</strong>
                <p>
                  {route
                    ? `${formatDistance(route.distance)} · ${formatDuration(route.duration)}`
                    : "Search a starting point and destination to calculate a route."}
                </p>
              </div>
            </div>

            <div className="journey-card">
              <div className="journey-icon"><ShieldCheck size={18} /></div>
              <div>
                <strong>Mapped route context</strong>
                <p>Streetlights and public amenities recorded near sampled route points.</p>
              </div>
            </div>
          </div>

          <div className="disclaimer">
            <ShieldCheck size={15} />
            <span>
              A walking route is not a safety rating. NIGHTWATCH does not yet
              verify crime, lighting, traffic, or current street conditions.
            </span>
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;

