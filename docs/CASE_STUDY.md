# NIGHTWATCH

*A project exploring how the information around a walking route can be just as interesting as the route itself.*

## Where the idea came from

When we think about choosing a route, we usually look at how far it is or how long it will take to reach our destination. But there's another part of the journey that often gets overlooked: what's actually around us?

That question became the starting point for NIGHTWATCH.

I came across an idea about looking at streets from a safety-focused perspective, particularly for women travelling through unfamiliar areas or at night. It made me think about how much information about our surroundings is available on maps, but how little of it is considered when choosing a route.

I wanted to explore that idea by building something myself.

I didn't begin with the intention of creating a system that could tell someone whether a street was safe. That would require much more reliable information than I could provide. Instead, I started with a smaller question: could I show people some of the environmental information around their walking routes and let them consider it themselves?

That's what NIGHTWATCH became.

## What I've built so far

NIGHTWATCH is a web application that lets users search for locations, explore walking routes and view mapped environmental features along those routes.

At the moment, it focuses on two categories:

- **Streetlights:** OpenStreetMap records of mapped streetlights near a route.
- **Public amenities:** Mapped benches, drinking-water facilities and public toilets.

Users can also compare available walking routes and switch environmental markers on or off on the map.

This is the first working version of the idea, not the finished vision.

## How it works

I built the frontend using React and TypeScript, with Leaflet handling the interactive map. The backend uses Express to retrieve environmental information from the Overpass API.

The process starts when a user searches for two locations. NIGHTWATCH retrieves walking routes and displays the available alternatives.

To keep requests manageable, I sample coordinates along the selected route, targeting a maximum of 40 points while retaining the final coordinate. The frontend sends these points to my Express backend, which queries the Overpass API for mapped features within approximately 60 metres of them.

After receiving the results, the application removes duplicate OpenStreetMap records and checks their proximity to the actual route segments. Features within 30 metres are included in the route indicators, with each unique feature counted only once.

I had to think about more than simply displaying map markers. I also needed to keep requests manageable, avoid counting the same feature multiple times and make sure the information shown actually related to the selected route.

## The technology behind it

| Technology | How I used it |
|---|---|
| React | Building the interface |
| TypeScript | Writing application logic |
| Vite | Development and production builds |
| Leaflet | Interactive maps |
| React Leaflet | Connecting maps with React |
| Express | Building the backend API |
| OpenStreetMap | Map and environmental records |
| Nominatim | Searching for locations |
| Overpass API | Retrieving mapped features |
| Vercel | Hosting the frontend |
| Render | Hosting the backend |

## What I had to be careful about

One thing I realised while building NIGHTWATCH is that having information on a map doesn't automatically make that information reliable.

For example, finding a streetlight record doesn't mean the light is currently working. Similarly, not finding a record doesn't mean there is no streetlight on that road.

OpenStreetMap data can be incomplete or outdated, and the route-sampling process can miss some features.

For that reason, NIGHTWATCH does not give routes a safety score or label them as safe or unsafe. It only presents publicly mapped information that users can consider.

I think this distinction is important, especially because the original idea was connected to personal safety. I wouldn't want an application to create a false sense of security simply because its map looks convincing.

## Where I want to take it

The current version is only a starting point.

I'd like to explore whether additional information about streets, nearby activity and public infrastructure could make the platform more useful. I'd also like to investigate ways of improving data coverage and checking the reliability of the information being displayed.

The bigger challenge is figuring out which indicators are genuinely useful, how they should be interpreted and how to present them without making claims the data cannot support.

## What this project has taught me

Building NIGHTWATCH gave me an opportunity to work across different parts of software development instead of focusing on just one.

I worked with frontend development, backend APIs, mapping libraries, geospatial data and deployment. I also had to understand how the different pieces communicated with each other and what could go wrong when real-world data was involved.

But probably the most important thing I learned was to question what my application was actually telling its users.

It is easy to display information and make something look functional. It is harder to understand the limitations of that information and communicate them honestly.

NIGHTWATCH is still evolving, and there is a lot I haven't figured out yet. That's also what makes it interesting to continue working on.


## Explore NIGHTWATCH

- **Live application:** https://night-watch-sand.vercel.app
- **GitHub repository:** https://github.com/prajjwal0321/night-watch
- **Technical methodology:** [Data Collection and Methodology](METHODOLOGY.md)