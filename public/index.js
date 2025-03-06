const LANGUAGES = {
  en: "English",
  vi: "Vietnamese",
  af: "Afrikaans",
  sq: "Albanian",
  ar: "Arabic",
  hy: "Armenian",
  ca: "Catalan",
  zh: "Chinese",
  "zh-cn": "Chinese (Mandarin/China)",
  "zh-tw": "Chinese (Mandarin/Taiwan)",
  "zh-yue": "Chinese (Cantonese)",
  hr: "Croatian",
  cs: "Czech",
  da: "Danish",
  nl: "Dutch",
  "en-au": "English (Australia)",
  "en-uk": "English (United Kingdom)",
  "en-us": "English (United States)",
  eo: "Esperanto",
  fi: "Finnish",
  fr: "French",
  de: "German",
  el: "Greek",
  ht: "Haitian Creole",
  hi: "Hindi",
  hu: "Hungarian",
  is: "Icelandic",
  id: "Indonesian",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  la: "Latin",
  lv: "Latvian",
  mk: "Macedonian",
  no: "Norwegian",
  pl: "Polish",
  pt: "Portuguese",
  "pt-br": "Portuguese (Brazil)",
  ro: "Romanian",
  ru: "Russian",
  sr: "Serbian",
  sk: "Slovak",
  es: "Spanish",
  "es-es": "Spanish (Spain)",
  "es-us": "Spanish (United States)",
  sw: "Swahili",
  sv: "Swedish",
  ta: "Tamil",
  th: "Thai",
  tr: "Turkish",
  cy: "Welsh",
};

document.addEventListener("DOMContentLoaded", () => {
  const languageSelectEl = document.getElementById("languageSelect");
  const speedSlider = document.getElementById("speedSlider");
  const speedValue = document.getElementById("speedValue");
  const tabPanels = {
    tts: document.getElementById("tts-panel"),
    history: document.getElementById("history-panel"),
  };
  const tabs = document.querySelectorAll(".tab-btn");

  sessionStorage.removeItem("ttsHistory");
  document.getElementById("historyContainer").innerHTML = "";

  languageSelectEl.innerHTML = Object.entries(LANGUAGES)
    .map(([code, name]) => `<option value="${code}">${name}</option>`)
    .join("");

  // Load language & speed from localStorage
  const setDefault = (el, storageKey, targetProp = "value") => {
    const savedValue = localStorage.getItem(storageKey);
    if (savedValue) el[targetProp] = savedValue;
  };

  setDefault(languageSelectEl, "selectedLanguage");
  setDefault(speedSlider, "selectedSpeed");
  setDefault(speedValue, "selectedSpeed", "innerText");

  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      Object.entries(tabPanels).forEach(([name, panel]) => {
        panel.classList.toggle("hidden", tab.dataset.tab !== name);
      });
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
    })
  );
});

document
  .getElementById("languageSelect")
  .addEventListener("change", function () {
    localStorage.setItem("selectedLanguage", this.value);
  });

document.getElementById("speedSlider").addEventListener("input", function () {
  document.getElementById("speedValue").innerText = this.value;
  localStorage.setItem("selectedSpeed", this.value);
});

function generateSpeech() {
  const text = document.getElementById("textInput").value.trim();
  const language = document.getElementById("languageSelect").value;
  const speed = document.getElementById("speedSlider").value;

  if (!text) {
    alert("Please enter some text!");
    return;
  }

  const generateButton = document.getElementById("generateButton");
  const toggleLoading = (isLoading) => {
    document
      .getElementById("loadingIndicator")
      .classList.toggle("hidden", !isLoading);
    generateButton.disabled = isLoading;
    generateButton.classList.toggle("opacity-50", isLoading);
    generateButton.classList.toggle("cursor-not-allowed", isLoading);
  };

  toggleLoading(true);
  document.getElementById("audioContainer").innerHTML = "";

  const isOptimizeWithAI = document.getElementById("optimizeWithAI")?.checked;

  fetch("/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, speed, language, isOptimizeWithAI }),
  })
    .then((response) => response.blob())
    .then((blob) => {
      const audioUrl = URL.createObjectURL(blob);
      document.getElementById("audioContainer").innerHTML = `
      <audio controls class="w-full">
        <source src="${audioUrl}" type="audio/mp3">
      </audio>
    `;

      addHistoryItem(text, audioUrl);
    })
    .catch((error) => console.error("Error:", error))
    .finally(() => toggleLoading(false));
}

function addHistoryItem(text, audioUrl) {
  const historyContainer = document.getElementById("historyContainer");
  const historyItem = document.createElement("div");
  historyItem.classList.add("p-3", "bg-gray-700", "rounded-md");

  historyItem.innerHTML = `
    <p class="text-sm text-gray-300">${text.slice(0, 50)}...</p>
    <audio controls class="w-full mt-2">
      <source src="${audioUrl}" type="audio/mp3">
    </audio>
  `;

  historyContainer.prepend(historyItem);
}
