function generateHomeHTML(languageOptions) {
  return ` <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Text to Speech</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          /* Custom Scrollbar */
          ::-webkit-scrollbar {
            width: 8px;
          }
          ::-webkit-scrollbar-thumb {
            background: #4a5568;
            border-radius: 10px;
          }
          ::-webkit-scrollbar-track {
            background: #2d3748;
          }
  
          /* Dynamic Height */
          .content-wrapper {
            height: calc(100vh - 72px); /* Trừ header */
          }
  
          /* Loader */
          .loader {
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid #ffffff;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
          }
  
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }


          .checkbox {
            appearance: none;
            background-color: #2d3748;
            border: 2px solid #4a5568;
            padding: 9px;
            border-radius: 4px;
            display: inline-block;
            position: relative;
            vertical-align: middle; /* Align checkbox vertically */
          }
          .checkbox:checked {
            background-color: #667eea;
            border-color: #667eea;
          }
          .checkbox:checked::after {
            content: '';
            position: absolute;
            width: 6px;
            height: 12px;
            border: solid white;
            border-width: 0 2px 2px 0;
            top: 50%; /* Center vertically */
            left: 50%; /* Center horizontally */
            transform: translate(-50%, -50%) rotate(45deg); /* Adjust center and rotate */
          }

        </style>
      </head>
      <body class="bg-gray-900 text-white font-sans">
        <div class="max-w-5xl mx-auto p-6">
          <h2 class="text-3xl font-bold text-center mb-4">Text to Speech</h2>
  
          <!-- Mobile Tabs -->
          <div class="md:hidden flex gap-4 mb-4">
            <button class="tab-btn flex-1 py-2 text-center rounded-md bg-gray-700 active" data-tab="tts">TTS</button>
            <button class="tab-btn flex-1 py-2 text-center rounded-md bg-gray-700" data-tab="history">History</button>
          </div>
  
          <div class="flex flex-col md:flex-row gap-6 content-wrapper">
            <!-- Left Panel (TTS) -->
            <div id="tts-panel" class="md:w-2/3 bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col overflow-y-auto">
              <div class="mb-2">
                <label class="block text-gray-300 mb-2">Enter Text:</label>
                <textarea id="textInput" class="w-full p-3 bg-gray-700 text-white rounded-md focus:ring focus:ring-blue-500 transition resize-none h-24" placeholder="Type your text here..."></textarea>
              </div>
              <div class="mt-4">
                <label class="block text-gray-300 mb-2">Select Language:</label>
                <select id="languageSelect" class="w-full p-3 bg-gray-700 text-white rounded-md">
                  ${languageOptions}
                </select>
              </div>
              <div class="mt-4 flex items-center">
                <label for="optimizeWithAI" class="block text-gray-300 cursor-pointer">Optimize with AI:</label>
                <input type="checkbox" id="optimizeWithAI" class="checkbox mt-1 mx-4">
              </div>
              <div class="mt-4">
                <label class="block text-gray-300 mb-2">Speed: <span id="speedValue">1</span>x</label>
                <input type="range" id="speedSlider" class="w-full" min="0.5" max="2" step="0.1" value="1">
              </div>
              <button id="generateButton" class="mt-4 w-full p-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition flex items-center justify-center" onclick="generateSpeech()">
                Generate Speech
              </button>
              <div class="flex justify-center mt-4 hidden" id="loadingIndicator">
                <div class="loader"></div>
              </div>
              <div class="mt-4">
                <h3 class="text-lg font-semibold mb-2">Current Audio</h3>
                <div id="audioContainer" class="w-full"></div>
              </div>
            </div>
  
            <!-- Right Panel (History) -->
            <div id="history-panel" class="md:w-1/3 bg-gray-800 p-6 rounded-lg shadow-lg overflow-y-auto hidden md:block">
              <h3 class="text-lg font-semibold mb-3">History</h3>
              <div id="historyContainer" class="space-y-3"></div>
            </div>
          </div>
        </div>
  
        <script>
          document.addEventListener("DOMContentLoaded", function () {
            // Xóa lịch sử mỗi lần reload
            sessionStorage.removeItem("ttsHistory");
            document.getElementById("historyContainer").innerHTML = "";
  
            // Load language & speed from localStorage
            const savedLanguage = localStorage.getItem("selectedLanguage");
            if (savedLanguage) {
              document.getElementById("languageSelect").value = savedLanguage;
            }
  
            const savedSpeed = localStorage.getItem("selectedSpeed");
            if (savedSpeed) {
              document.getElementById("speedSlider").value = savedSpeed;
              document.getElementById("speedValue").innerText = savedSpeed;
            }
  
            // Tab switching for mobile
            const tabs = document.querySelectorAll(".tab-btn");
            tabs.forEach(tab => {
              tab.addEventListener("click", function () {
                document.getElementById("tts-panel").classList.toggle("hidden", this.dataset.tab !== "tts");
                document.getElementById("history-panel").classList.toggle("hidden", this.dataset.tab !== "history");
                tabs.forEach(t => t.classList.remove("active"));
                this.classList.add("active");
              });
            });
          });
  
          document.getElementById("languageSelect").addEventListener("change", function () {
            localStorage.setItem("selectedLanguage", this.value);
          });
  
          document.getElementById("speedSlider").addEventListener("input", function() {
            document.getElementById("speedValue").innerText = this.value;
            localStorage.setItem("selectedSpeed", this.value);
          });
  
          function generateSpeech() {
            const text = document.getElementById("textInput").value;
            const language = document.getElementById("languageSelect").value;
            const speed = document.getElementById("speedSlider").value;
  
            if (!text.trim()) {
              alert("Please enter some text!");
              return;
            }
  
            // Show loading indicator & disable button
            document.getElementById("loadingIndicator").classList.remove("hidden");
            document.getElementById("generateButton").disabled = true;
            document.getElementById("generateButton").classList.add("opacity-50", "cursor-not-allowed");
            document.getElementById("audioContainer").innerHTML = "";
            const isOptimizeWithAI = document.getElementById("optimizeWithAI")?.checked

  
            fetch("/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text, speed, language, isOptimizeWithAI })
            })
            .then(response => response.blob())
            .then(blob => {
              const audioUrl = URL.createObjectURL(blob);
              document.getElementById("audioContainer").innerHTML = \`
                <audio controls class="w-full">
                  <source src="\${audioUrl}" type="audio/mp3">
                </audio>
              \`;
  
              addHistoryItem(text, audioUrl);
            })
            .catch(error => console.error("Error:", error))
            .finally(() => {
              // Hide loading indicator & enable button
              document.getElementById("loadingIndicator").classList.add("hidden");
              document.getElementById("generateButton").disabled = false;
              document.getElementById("generateButton").classList.remove("opacity-50", "cursor-not-allowed");
            });
          }
  
          function addHistoryItem(text, audioUrl) {
            const historyContainer = document.getElementById("historyContainer");
            const truncatedText = text.length > 20 ? text.substring(0, 20) + "..." : text;
            const historyItem = document.createElement("div");
            historyItem.classList.add("p-3", "bg-gray-700", "rounded-md");
            historyItem.innerHTML = \`
              <p class="text-sm text-gray-300">\${truncatedText}</p>
              <audio controls class="w-full mt-2">
                <source src="\${audioUrl}" type="audio/mp3">
              </audio>
            \`;
            historyContainer.prepend(historyItem);
          }
        </script>
      </body>
      </html>`;
}

module.exports = { generateHomeHTML };
