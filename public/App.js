import React, { useEffect, useState } from "react";

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

const App = () => {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState(
    localStorage.getItem("selectedLanguage") || "en"
  );
  const [speed, setSpeed] = useState(
    localStorage.getItem("selectedSpeed") || "1"
  );
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [history, setHistory] = useState(
    JSON.parse(sessionStorage.getItem("ttsHistory")) || []
  );

  useEffect(() => {
    localStorage.setItem("selectedLanguage", language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem("selectedSpeed", speed);
  }, [speed]);

  const generateSpeech = () => {
    if (!text) {
      alert("Please enter some text!");
      return;
    }

    setLoading(true);
    setAudioUrl("");

    const isOptimizeWithAI = document.getElementById("optimizeWithAI")?.checked;

    fetch("http://localhost:3000/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speed, language, isOptimizeWithAI }),
    })
      .then((response) => response.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        addHistoryItem(text, url);
      })
      .catch((error) => console.error("Error:", error))
      .finally(() => setLoading(false));
  };

  const addHistoryItem = (text, url) => {
    const newHistory = [{ text, url }, ...history];
    setHistory(newHistory);
    sessionStorage.setItem("ttsHistory", JSON.stringify(newHistory));
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-3xl font-bold text-center mb-4">Text to Speech</h2>

      {/* Mobile Tabs */}
      <div className="md:hidden flex gap-4 mb-4">
        <button
          className="tab-btn flex-1 py-2 text-center rounded-md bg-gray-700 active"
          data-tab="tts"
        >
          TTS
        </button>
        <button
          className="tab-btn flex-1 py-2 text-center rounded-md bg-gray-700"
          data-tab="history"
        >
          History
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 content-wrapper">
        {/* Left Panel (TTS) */}
        <div
          id="tts-panel"
          className="md:w-2/3 bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col overflow-y-auto"
        >
          <div className="mb-2">
            <label className="block text-gray-300 mb-2">Enter Text:</label>
            <textarea
              id="textInput"
              className="w-full p-3 bg-gray-700 text-white rounded-md focus:ring focus:ring-blue-500 transition resize-none h-24"
              placeholder="Type your text here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            ></textarea>
          </div>
          <div className="mt-4">
            <label className="block text-gray-300 mb-2">Select Language:</label>
            <select
              id="languageSelect"
              className="w-full p-3 bg-gray-700 text-white rounded-md"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex items-center">
            <label
              htmlFor="optimizeWithAI"
              className="block text-gray-300 cursor-pointer"
            >
              Optimize with AI:
            </label>
            <input
              type="checkbox"
              id="optimizeWithAI"
              className="checkbox mt-1 mx-4"
            />
          </div>
          <div className="mt-4">
            <label className="block text-gray-300 mb-2">
              Speed: <span id="speedValue">{speed}</span>x
            </label>
            <input
              type="range"
              id="speedSlider"
              className="w-full"
              min="0.5"
              max="2"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
            />
          </div>
          <button
            id="generateButton"
            className={`mt-4 w-full p-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition flex items-center justify-center ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
            onClick={generateSpeech}
            disabled={loading}
          >
            Generate Speech
          </button>
          <div
            className={`flex justify-center mt-4 ${loading ? "" : "hidden"}`}
            id="loadingIndicator"
          >
            <div className="loader"></div>
          </div>
          {audioUrl && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Current Audio</h3>
              <div id="audioContainer" className="w-full">
                <audio controls className="w-full">
                  <source src={audioUrl} type="audio/mp3" />
                </audio>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel (History) */}
        <div
          id="history-panel"
          className="md:w-1/3 bg-gray-800 p-6 rounded-lg shadow-lg overflow-y-auto hidden md:block"
        >
          <h3 className="text-lg font-semibold mb-3">History</h3>
          <div id="historyContainer" className="space-y-3">
            {history.map(({ text, url }, index) => (
              <div key={index} className="p-3 bg-gray-700 rounded-md">
                <p className="text-sm text-gray-300">{text}</p>
                <audio controls className="w-full mt-2">
                  <source src={url} type="audio/mp3" />
                </audio>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
