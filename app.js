// === LOAD CONFIG ===
let CONFIG = {};

fetch("config.json")
  .then(res => res.json())
  .then(data => {
    CONFIG = data;
    populateDropdowns();
  });

// === POPULATE DROPDOWNS ===
function populateDropdowns() {
  const medSel = document.getElementById("profileMedications");
  const condSel = document.getElementById("profileConditions");

  medSel.innerHTML = `<option value="">Välj medicin...</option>`;
  condSel.innerHTML = `<option value="">Välj hudproblem...</option>`;

  Object.entries(CONFIG.medications).forEach(([key, item]) => {
    medSel.innerHTML += `<option value="${key}">${item.name}</option>`;
  });

  Object.entries(CONFIG.conditions).forEach(([key, item]) => {
    condSel.innerHTML += `<option value="${key}">${item.name}</option>`;
  });
}

// === STORAGE KEYS ===
const STORAGE_KEYS = {
  location: "uvapp_location",
  profile: "uvapp_profile",
  outdoor: "uvapp_outdoor",
  spfTimer: "uvapp_spf_timer",
};

// === GLOBAL STATE ===
let currentLocation = null;
let outdoor = true;
let spfTimer = null;
let timerInterval = null;

// === PAGE NAVIGATION ===
const pages = {
  home: document.getElementById("page-home"),
  profile: document.getElementById("page-profile"),
};
const tabButtons = document.querySelectorAll(".tab-btn");

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.getAttribute("data-page");
    Object.entries(pages).forEach(([name, el]) => {
      el.classList.toggle("active", name === page);
    });
    tabButtons.forEach(b => b.classList.toggle("active", b === btn));
  });
});

// === LOCATION ===
function saveLocationToStorage() {
  if (!currentLocation) return;
  localStorage.setItem(STORAGE_KEYS.location, JSON.stringify(currentLocation));
}

function loadLocationFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEYS.location);
  if (!raw) return;
  currentLocation = JSON.parse(raw);
  updateLocationUI();
  loadWeather();
}

function updateLocationUI() {
  const chip = document.getElementById("locationChip");
  const label = document.getElementById("locationLabel");

  if (!currentLocation) {
    chip.textContent = "Ingen plats vald";
    label.textContent = "Ingen";
    return;
  }

  chip.textContent = currentLocation.name;
  label.textContent = currentLocation.name;
}

document.getElementById("btnMyLocation").addEventListener("click", () => {
  navigator.geolocation.getCurrentPosition(pos => {
    currentLocation = {
      name: "Min plats",
      lat: pos.coords.latitude,
      lon: pos.coords.longitude
    };
    saveLocationToStorage();
    updateLocationUI();
    loadWeather();
  });
});

document.getElementById("btnManualLocation").addEventListener("click", () => {
  const box = document.getElementById("manualLocationContainer");
  box.style.display = box.style.display === "none" ? "block" : "none";
});

document.getElementById("btnApplyManualLocation").addEventListener("click", async () => {
  const input = document.getElementById("manualLocationInput").value.trim();

  if (input.includes(",")) {
    const [lat, lon] = input.split(",").map(Number);
    currentLocation = { name: `Lat ${lat}, Lon ${lon}`, lat, lon };
    saveLocationToStorage();
    updateLocationUI();
    loadWeather();
    return;
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input)}&count=1&language=sv`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.results || !data.results.length) {
    alert("Kunde inte hitta platsen.");
    return;
  }

  const place = data.results[0];
  currentLocation = {
    name: `${place.name}, ${place.country_code}`,
    lat: place.latitude,
    lon: place.longitude
  };

  saveLocationToStorage();
  updateLocationUI();
  loadWeather();
});

// === WEATHER ===
async function loadWeather() {
  if (!currentLocation) return;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${currentLocation.lat}&longitude=${currentLocation.lon}&hourly=temperature_2m,uv_index,weathercode&current_weather=true&timezone=auto`;
  const res = await fetch(url);
  const data = await res.json();

  const temp = data.current_weather.temperature;
  const weatherCode = data.current_weather.weathercode;

  document.getElementById("tempDisplay").textContent = `${temp}°`;
  document.getElementById("weatherIcon").textContent = mapWeatherCodeToEmoji(weatherCode);

  const uv = data.hourly.uv_index[0];
  document.getElementById("uvDisplay").textContent = uv.toFixed(1);

  const sunTime = simulateSunTime(uv);
  document.getElementById("weatherMeta").textContent = `Soltid (simulerad): ${sunTime} min • Väder: ${mapWeatherCodeToText(weatherCode)}`;
}

function mapWeatherCodeToEmoji(code) {
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "🌤️";
  if (code === 3) return "⛅";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 61, 63, 65].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "☁️";
}

function mapWeatherCodeToText(code) {
  if (code === 0) return "klart";
  if ([1, 2].includes(code)) return "mest klart";
  if (code === 3) return "molnigt";
  if ([45, 48].includes(code)) return "dimma";
  if ([51, 53, 55].includes(code)) return "duggregn";
  if ([61, 63, 65].includes(code)) return "regn";
  if ([71, 73, 75, 77].includes(code)) return "snö";
  if ([85, 86].includes(code)) return "snöbyar";
  if ([95, 96, 99].includes(code)) return "åska";
  return "växlande";
}

// === RISK MULTIPLIER ===
function getRiskMultiplier() {
  let multiplier = 1;

  const med = document.getElementById("profileMedications").value;
  const cond = document.getElementById("profileConditions").value;

  if (CONFIG.medications[med]) multiplier *= CONFIG.medications[med].risk;
  if (CONFIG.conditions[cond]) multiplier *= CONFIG.conditions[cond].risk;

  return multiplier;
}

function simulateSunTime(uv) {
  let base = uv <= 2 ? 120 : uv <= 5 ? 60 : uv <= 7 ? 30 : uv <= 10 ? 20 : 10;
  return Math.round(base * getRiskMultiplier());
}

// === SPF TIMER ===
const spfButtons = document.querySelectorAll(".btn-spf");
const timerDisplay = document.getElementById("timerDisplay");
const timerBarInner = document.getElementById("timerBarInner");

spfButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const spf = parseInt(btn.dataset.spf);
    applySPF(spf);

    document.getElementById("waterWarning").style.display = "none";
    const waterBtn = document.getElementById("btnWaterEvent");
    waterBtn.disabled = false;
    waterBtn.textContent = "🚿 Jag har badat/duschat";
  });
});

function applySPF(spf) {
  const duration = spf === 15 ? 3600000 : spf === 30 ? 5400000 : 7200000;

  spfTimer = { spf, start: Date.now(), duration };
  localStorage.setItem(STORAGE_KEYS.spfTimer, JSON.stringify(spfTimer));

  startTimerInterval();
}

function startTimerInterval() {
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimerUI, 1000);
}

function updateTimerUI() {
  if (!spfTimer) {
    timerDisplay.textContent = "Ingen aktiv timer.";
    timerBarInner.style.width = "0%";
    return;
  }

  const elapsed = Date.now() - spfTimer.start;
  const remaining = spfTimer.duration - elapsed;

  if (remaining <= 0) {
    timerDisplay.textContent = "Dags att applicera solskydd igen!";
    timerBarInner.style.width = "100%";
    return;
  }

  const minutes = Math.round(remaining / 60000);
