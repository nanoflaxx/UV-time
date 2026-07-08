// ======================================================
// UV-APP – APP.JS (FULL VERSION MED RISK-SERVICE)
// ======================================================

// GLOBAL CONFIG (från config.json)
let CONFIG = {};
fetch("./config.json")
  .then(res => res.json())
  .then(data => {
    CONFIG = data;
    populateDropdowns();
  });

// ======================================================
// DROPDOWNS FÖR MEDICINER & HUDSJUKDOMAR
// ======================================================
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

// ======================================================
// STORAGE KEYS
// ======================================================
const STORAGE_KEYS = {
  location: "uvapp_location",
  profile: "uvapp_profile",
  outdoor: "uvapp_outdoor",
  spfTimer: "uvapp_spf_timer",
};

// ======================================================
// GLOBAL STATE
// ======================================================
let currentLocation = null;
let outdoor = true;
let spfTimer = null;
let timerInterval = null;
let currentRiskMultiplier = 1;

// ======================================================
// PAGE NAVIGATION
// ======================================================
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

// ======================================================
// LOCATION HANDLING
// ======================================================
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

// ======================================================
// WEATHER + UV
// ======================================================
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
  document.getElementById("weatherMeta").textContent =
    `Soltid (simulerad): ${sunTime} min • Väder: ${mapWeatherCodeToText(weatherCode)}`;
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

// ======================================================
// RISK MULTIPLIER (från risk-service.js)
// ======================================================
function getRiskMultiplier() {
  return currentRiskMultiplier || 1;
}

function simulateSunTime(uv) {
  let base = uv <= 2 ? 120 : uv <= 5 ? 60 : uv <= 7 ? 30 : uv <= 10 ? 20 : 10;
  return Math.round(base * getRiskMultiplier());
}

// ======================================================
// SPF TIMER
// ======================================================
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
  timerDisplay.textContent = `Nästa applicering om ca ${minutes} min`;

  const progress = (elapsed / spfTimer.duration) * 100;
  timerBarInner.style.width = `${progress}%`;
}

// ======================================================
// BAD/DUSCH
// ======================================================
document.getElementById("btnWaterEvent").addEventListener("click", () => {
  spfTimer = null;
  localStorage.removeItem(STORAGE_KEYS.spfTimer);

  timerDisplay.textContent = "Du har badat/duschat – applicera solskydd igen!";
  timerBarInner.style.width = "0%";

  const warn = document.getElementById("waterWarning");
  warn.style.display = "block";

  const btn = document.getElementById("btnWaterEvent");
  btn.disabled = true;
  btn.textContent = "🚿 Badat/duschat (vänta 10 min)";

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = "🚿 Jag har badat/duschat";
    warn.style.display = "none";
  }, 600000);
});

// ======================================================
// UTE / INNE
// ======================================================
const toggleOutdoor = document.getElementById("toggleOutdoor");
const statusLabel = document.getElementById("statusLabel");
const toggleText = document.getElementById("toggleText");
const headerStatus = document.getElementById("headerStatus");

toggleOutdoor.addEventListener("click", () => {
  outdoor = !outdoor;
  localStorage.setItem(STORAGE_KEYS.outdoor, outdoor ? "1" : "0");
  updateOutdoorUI();
});

function updateOutdoorUI() {
  toggleOutdoor.classList.toggle("on", outdoor);
  statusLabel.textContent = outdoor ? "Ute" : "Inne";
  toggleText.textContent = outdoor ? "Ute" : "Inne";
  headerStatus.textContent = outdoor ? "Ute" : "Inne";
}

// ======================================================
// PROFIL
// ======================================================
const profileAge = document.getElementById("profileAge");
const profileSkinType = document.getElementById("profileSkinType");
const profileMedications = document.getElementById("profileMedications");
const profileConditions = document.getElementById("profileConditions");

document.getElementById("btnSaveProfile").addEventListener("click", saveProfile);
document.getElementById("btnClearProfile").addEventListener("click", clearProfile);

function saveProfile() {
  const profile = {
    age: profileAge.value || null,
    skinType: profileSkinType.value || null,
    medications: profileMedications.value || null,
    conditions: profileConditions.value || null,
  };

  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
  document.getElementById("profileMeta").textContent = "Profil sparad.";

  loadRiskData();
}

function loadProfile() {
  const raw = localStorage.getItem(STORAGE_KEYS.profile);
  if (!raw) return;

  const profile = JSON.parse(raw);

  profileAge.value = profile.age || "";
  profileSkinType.value = profile.skinType || "";
  profileMedications.value = profile.medications || "";
  profileConditions.value = profile.conditions || "";
}

function clearProfile() {
  localStorage.removeItem(STORAGE_KEYS.profile);

  profileAge.value = "";
  profileSkinType.value = "";
  profileMedications.value = "";
  profileConditions.value = "";

  document.getElementById("profileMeta").textContent = "Profil rensad.";
  document.getElementById("riskWarning").style.display = "none";
  updateProfileRiskBox([]);
  loadWeather();
}

// ======================================================
// RISKDATA (OpenFDA + DermNet + config.json)
// ======================================================
async function loadRiskData() {
  const med = profileMedications.value;
  const cond = profileConditions.value;

  const risk = await RiskService.getCombinedRisk(med, cond);

  currentRiskMultiplier = risk.multiplier;

  const riskWarning = document.getElementById("riskWarning");

  if (risk.warnings.length) {
    riskWarning.style.display = "block";
    riskWarning.innerHTML = `
      <strong>⚠ Viktigt:</strong><br>
      ${risk.warnings.join("<br><br>")}<br><br>
      <em>Dessa rekommendationer är endast uppskattningar baserade på öppna datakällor. Jag är inte läkare och detta ersätter inte medicinsk rådgivning.</em>
    `;
  } else {
    riskWarning.style.display = "none";
  }

  updateProfileRiskBox(risk.warnings);
  loadWeather();
}

function updateProfileRiskBox(warnings) {
  const box = document.getElementById("profileRiskBox");

  const med = profileMedications.value;
  const cond = profileConditions.value;

  let text = "";

  if (med) text += `<strong>Mediciner:</strong> ${CONFIG.medications[med].name}<br>`;
  if (cond) text += `<strong>Hudsjukdom:</strong> ${CONFIG.conditions[cond].name}<br>`;

  if (warnings.length) {
    text += `<br><strong>Risker:</strong><br>${warnings.join("<br>")}`;
  }

  if (!med && !cond && !warnings.length) {
    text = "Inga risker valda.";
  }

  box.innerHTML = text;
}

// ======================================================
// INIT
// ======================================================
async function init() {
  loadProfile();
  loadLocationFromStorage();
  loadOutdoorFromStorage();
  loadRiskData();
  loadWeather();
}

function loadOutdoorFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEYS.outdoor);
  outdoor = raw === "1";
  updateOutdoorUI();
}

document.addEventListener("DOMContentLoaded", init);
