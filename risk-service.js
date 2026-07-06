// ===============================
// RISK SERVICE – UV-App
// ===============================
// Hämtar riskdata från:
// ✔ OpenFDA (mediciner)
// ✔ DermNet (hudsjukdomar)
// ✔ config.json (fallback + multipliers)
// ===============================

let CONFIG = {};

// Ladda config.json
fetch("config.json")
  .then(res => res.json())
  .then(data => CONFIG = data);

// ===============================
// 1. Hämta medicinrisk från OpenFDA
// ===============================
async function fetchMedicationRisk(medKey) {
  if (!medKey) return null;

  const medConfig = CONFIG.medications[medKey];
  let apiRisk = null;
  let apiDescription = null;

  try {
    const url = `https://api.fda.gov/drug/label.json?search=${medKey}`;
    const res = await fetch(url);
    const data = await res.json();

    const text = JSON.stringify(data.results?.[0] || "").toLowerCase();

    if (
      text.includes("photosensitivity") ||
      text.includes("phototoxicity") ||
      text.includes("sunburn") ||
      text.includes("uv sensitivity")
    ) {
      apiRisk = 0.5; // API-baserad risk
      apiDescription = "OpenFDA: Medicinen är kopplad till ljuskänslighet.";
    }
  } catch (e) {
    console.warn("OpenFDA API error:", e);
  }

  return {
    name: medConfig?.name || medKey,
    configRisk: medConfig?.risk || 1,
    apiRisk,
    description: medConfig?.description || "Ingen beskrivning.",
    apiDescription
  };
}

// ===============================
// 2. Hämta hudsjukdomsrisk från DermNet
// ===============================
async function fetchConditionRisk(condKey) {
  if (!condKey) return null;

  const condConfig = CONFIG.conditions[condKey];
  let apiRisk = null;
  let apiDescription = null;

  try {
    const url = `https://dermnetapi.herokuapp.com/conditions?search=${condKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data?.length) {
      const text = JSON.stringify(data[0]).toLowerCase();

      if (
        text.includes("sun") ||
        text.includes("uv") ||
        text.includes("photosensitivity") ||
        text.includes("flare")
      ) {
        apiRisk = 0.7;
        apiDescription = "DermNet: Hudsjukdomen kan påverka UV‑tolerans.";
      }
    }
  } catch (e) {
    console.warn("DermNet API error:", e);
  }

  return {
    name: condConfig?.name || condKey,
    configRisk: condConfig?.risk || 1,
    apiRisk,
    description: condConfig?.description || "Ingen beskrivning.",
    apiDescription
  };
}

// ===============================
// 3. Kombinera riskdata
// ===============================
async function getCombinedRisk(medKey, condKey) {
  const medRisk = await fetchMedicationRisk(medKey);
  const condRisk = await fetchConditionRisk(condKey);

  let warnings = [];
  let multiplier = 1;

  // Medicinrisk
  if (medRisk) {
    multiplier *= medRisk.apiRisk || medRisk.configRisk;

    warnings.push(
      `<strong>${medRisk.name}</strong>: ${medRisk.description}` +
      (medRisk.apiDescription ? `<br>${medRisk.apiDescription}` : "")
    );
  }

  // Hudsjukdomsrisk
  if (condRisk) {
    multiplier *= condRisk.apiRisk || condRisk.configRisk;

    warnings.push(
      `<strong>${condRisk.name}</strong>: ${condRisk.description}` +
      (condRisk.apiDescription ? `<br>${condRisk.apiDescription}` : "")
    );
  }

  return {
    multiplier,
    warnings
  };
}

// ===============================
// 4. Exportera funktioner
// ===============================
window.RiskService = {
  getCombinedRisk
};
