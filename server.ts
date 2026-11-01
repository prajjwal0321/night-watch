import "dotenv/config";
import express from "express";

const app = express();
const PORT = 3001;
const API_KEY = process.env.OVERPASS_API_KEY;

app.use(express.json());


app.post("/api/area-data", async (req, res) => {
  if (!API_KEY) {
    res.status(500).json({ error: "Area-data service is not configured." });
    return;
  }

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
  console.log(`NIGHTWATCH data server running at http://localhost:${PORT}`);
});
