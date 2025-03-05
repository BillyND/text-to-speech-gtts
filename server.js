const express = require("express");
const { exec } = require("child_process");
const dotenv = require("dotenv");
const gtts = require("gtts");
const path = require("path");
const { LANGUAGES } = require("./constant");
const { generateHomeHTML } = require("./utils/generateHomeHTML");
const { formatTextWithGemini } = require("./utils/formatTextWithGemini");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public")); // Static files (CSS, JS)

// 🚀 API TTS - Streaming không lưu file
app.post("/tts", async (req, res) => {
  let { text, speed = 1, language = "vi", isOptimizeWithAI = false } = req.body;
  if (!text) return res.status(400).send("Text is required");

  if (language === "vi" && isOptimizeWithAI) {
    text = await formatTextWithGemini(text);
  }

  try {
    const speech = new gtts(text, language);
    const speechStream = speech.stream();

    res.setHeader("Content-Type", "audio/mpeg");

    if (Number(speed) !== 1) {
      // Thay đổi tốc độ âm thanh bằng FFmpeg mà không lưu file
      const atempo = Math.max(0.5, Math.min(2.0, speed));
      const ffmpegCmd = `ffmpeg -i pipe:0 -filter:a "atempo=${atempo}" -f mp3 pipe:1`;

      const ffmpegProcess = exec(ffmpegCmd, {
        encoding: "buffer",
        maxBuffer: 10 * 1024 * 1024,
      });

      speechStream.pipe(ffmpegProcess.stdin);
      ffmpegProcess.stdout?.pipe(res);

      ffmpegProcess.on("error", (err) => {
        console.error("FFmpeg Error:", err);
        res.status(500).send("Error processing audio");
      });
    } else {
      // Stream trực tiếp nếu không cần thay đổi tốc độ
      speechStream.pipe(res);
    }
  } catch (error) {
    console.error("Error generating speech:", error);
    res.status(500).send("Error generating speech");
  }
});

// 🚀 Trang chủ UI đơn giản
app.get("/", (req, res) => {
  const languageOptions = Object.entries(LANGUAGES)
    .map(([code, name]) => `<option value="${code}">${name}</option>`)
    .join("");

  res.send(generateHomeHTML(languageOptions));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
