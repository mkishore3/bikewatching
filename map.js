import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
// Check that Mapbox GL JS is loaded
console.log('Mapbox GL JS Loaded:', mapboxgl);

// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoibWtpc2hvcmUiLCJhIjoiY21haHNzamlmMGYxajJqb2pwZmc1ejR2YSJ9.zjqrGBzpY3_NWngVG-XDqw';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18, // Maximum allowed zoom
});

// TO PREVENT MAPBOX ERROR FOR NON-EMPTY CONTAINERS ?
const mapContainer = document.getElementById('map');
const svg = d3.select(mapContainer)
    .append('svg')
    .attr('id', 'overlay');
// const svg = d3.select('#map').select('svg');
function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat); // Convert lon/lat to Mapbox LngLat
    const { x, y } = map.project(point); // Project to pixel coordinates
    return { cx: x, cy: y }; // Return as object for use in SVG attributes
  }

// Global time filter value
let timeFilter = -1;

// Format minutes since midnight as HH:MM AM/PM
function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

// step 5.3
function computeStationTraffic(stations, trips) {
    // Compute departures
    const departures = d3.rollup(
      trips,
      (v) => v.length,
      (d) => d.start_station_id
    );
  
    // Compute arrivals
    const arrivals = d3.rollup(
      trips,
      (v) => v.length,
      (d) => d.end_station_id
    );
  
    // Update station objects
    return stations.map((station) => {
      const id = station.short_name;
      station.departures = departures.get(id) ?? 0;
      station.arrivals = arrivals.get(id) ?? 0;
      station.totalTraffic = station.arrivals + station.departures;
      return station;
    });
  }

function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

function filterTripsbyTime(trips, timeFilter) {
return timeFilter === -1
    ? trips
    : trips.filter((trip) => {
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);
        return (
        Math.abs(startedMinutes - timeFilter) <= 60 ||
        Math.abs(endedMinutes - timeFilter) <= 60
        );
    });
}
  
  

map.on('load', async () => {
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
      });
      map.addLayer({
        id: 'bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: {
            'line-color': '#32D400',  // A bright green using hex code
            'line-width': 5,          // Thicker lines
            'line-opacity': 0.6       // Slightly less transparent
          }
      });
      map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
      });
      map.addLayer({
        id: 'bike-lanes-c',
        type: 'line',
        source: 'cambridge_route',
        paint: {
            'line-color': '#32D400',  // A bright green using hex code
            'line-width': 5,          // Thicker lines
            'line-opacity': 0.6       // Slightly less transparent
          }
      });
      let jsonData;
    try {
        const jsonurl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";

        // Await JSON fetch
        jsonData = await d3.json(jsonurl);

        console.log('Loaded JSON Data:', jsonData); // Log to verify structure
    } catch (error) {
        console.error('Error loading JSON:', error); // Handle errors
    }
    // let stations = jsonData.data.stations;
    // console.log('Stations Array:', stations);

    const trafficURL = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';

    let trips = await d3.csv(
        'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
        (trip) => {
          trip.started_at = new Date(trip.started_at);
          trip.ended_at = new Date(trip.ended_at);
          return trip;
        }
      );
      

    // // Step 4.2: Calculate departures and arrivals
    // const departures = d3.rollup(
    //     trips,
    //     (v) => v.length,
    //     (d) => d.start_station_id
    // );
    
    // const arrivals = d3.rollup(
    //     trips,
    //     (v) => v.length,
    //     (d) => d.end_station_id
    // );
    
    // // Add traffic info to each station
    // stations = stations.map((station) => {
    //     let id = station.short_name;
    //     station.arrivals = arrivals.get(id) ?? 0;
    //     station.departures = departures.get(id) ?? 0;
    //     station.totalTraffic = station.arrivals + station.departures;
    //     return station;
    // });

    const stations = computeStationTraffic(jsonData.data.stations, trips);
    
    // Optional: check in the console
    // console.log("Stations with traffic data:", stations);

    // Step 4.3: Create a square root scale for marker radius
    const radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]);

  

    // Append circles to the SVG for each station
    const circles = svg
        .selectAll('circle')
        .data(stations, (d) => d.short_name) // Use station short_name as the key
        .enter()
        .append('circle')
        .attr('r', (d) => radiusScale(d.totalTraffic)) // Dynamic radius based on traffic (step 4.3)
        .attr('fill', 'steelblue') // Circle fill color
        .attr('stroke', 'white') // Circle border color
        .attr('stroke-width', 1) // Circle border thickness
        .attr('opacity', 0.8) // Circle opacity
        .each(function (d) {
            // Add <title> for browser tooltips
            d3.select(this)
              .append('title')
              .text(
                `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`,
              );
            });
    
    // Function to update circle positions when the map moves/zooms
    function updatePositions() {
        circles
        .attr('cx', (d) => getCoords(d).cx) // Set the x-position using projected coordinates
        .attr('cy', (d) => getCoords(d).cy); // Set the y-position using projected coordinates
    }
      
    // Initial position update when map loads
    updatePositions();
    map.on('move', updatePositions); // Update during map movement
    map.on('zoom', updatePositions); // Update during zooming
    map.on('resize', updatePositions); // Update on window resize
    map.on('moveend', updatePositions); // Final adjustment after movement ends
    // === Time slider reactivity ===
    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById('time-display');
    const anyTimeLabel = document.getElementById('any-time');

    function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);

    if (timeFilter === -1) {
        selectedTime.textContent = '';
        anyTimeLabel.style.display = 'block';
    } else {
        selectedTime.textContent = formatTime(timeFilter);
        anyTimeLabel.style.display = 'none';
    }
    updateScatterPlot(timeFilter);
    }
    function updateScatterPlot(timeFilter) {
        const filteredTrips = filterTripsbyTime(trips, timeFilter);
        const filteredStations = computeStationTraffic(stations, filteredTrips);
      
        // Dynamically adjust circle size scale
        timeFilter === -1
          ? radiusScale.range([0, 25])
          : radiusScale.range([3, 50]);
      
        // Update circle sizes based on filtered traffic
        circles
          .data(filteredStations, (d) => d.short_name) // Keyed join
          .join('circle')
          .attr('r', (d) => radiusScale(d.totalTraffic));
      }
      

    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay(); // Call once to initialize display

  });