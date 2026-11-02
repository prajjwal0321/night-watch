
import "dotenv/config";
import express from "express";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const API_KEY = process.env.OVERPASS_API_KEY;

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());

app.get("/", (_req, res) => {
  res.send("NIGHTWATCH API is running.");
});

app.post("/api/area-data", async (req, res) => {
  if (!API_KEY) {
    res.status(500).json({ error: "Area-data service is not configured." });
    return;
  }
  console.log("Area-data request received", {
  origin: req.headers.origin,
  points: req.body?.points?.length,
});

  const { points } = req.body ?? {};

  if (
    !Array.isArray(points) ||
    points.length === 0 ||
    points.length > 50 ||
    !points.every(
      (point: any) =>
        point &&
        typeof point.lat === "number" &&
        typeof point.lon === "number" &&
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lon) &&
        point.lat >= -90 &&
        point.lat <= 90 &&
        point.lon >= -180 &&
        point.lon <= 180,
    )
  ) {
    res.status(400).json({
      error: "Between 1 and 50 valid route points are required.",
    });
    return;
  }

  const queries = points.map(
    (point: { lat: number; lon: number }) => `
      nwr(around:60,${point.lat},${point.lon})[highway=street_lamp];
      nwr(around:60,${point.lat},${point.lon})[man_made=street_lamp];
      nwr(around:60,${point.lat},${point.lon})[amenity~"^(bench|drinking_water|toilets)$"];
    `,
  );

  const query = `
    [out:json][timeout:25];
    (
      ${queries.join("\n")}
    );
    out center tags;
  `;

  try {
    const response = await fetch(
      `https://api.overpass.ch/v1/${API_KEY}/interpreter`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(30000),
      },
    );

    if (!response.ok) {
      res.status(502).json({
        error: `The map-data service returned error ${response.status}.`,
      });
      return;
    }

    const result = await response.json();

    if (!Array.isArray(result.elements)) {
      res.status(502).json({ error: "Unexpected map-data response." });
      return;
    }

    res.json(result);
  } catch {
    res.status(502).json({
      error: "Could not retrieve route data. Please try again later.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`NIGHTWATCH API running on port ${PORT}`);
});
