const express = require("express");
const gtts = require("gtts");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { LANGUAGES } = require("./constant");
const { cleanupOldFiles } = require("./utils/cleanupOldFiles");
const { generateHomeHTML } = require("./utils/generateHomeHTML");
const { formatTextWithGemini } = require("./utils/formatTextWithGemini");

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public")); // Directory containing static CSS/JS files

// Audio storage directory
const audioDir = path.join(__dirname, "audio");

app.post("/tts", async (req, res) => {
  let { text, speed = 1, language = "vi" } = req.body;
  const isVietnamese = language === "vi";

  if (!text) {
    return res.status(400).send("Text is required");
  }

  if (isVietnamese) {
    text = await formatTextWithGemini(text);
  }

  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  try {
    const safeText = text.substring(0, 100).replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `${safeText}_speed_${speed}.mp3`;
    const filePath = path.join(audioDir, fileName);
    const tempFile = path.join(audioDir, `temp_${safeText}.mp3`);

    // if (fs.existsSync(filePath)) {
    //   return res.sendFile(filePath);
    // }

    const speech = new gtts(text, language);

    speech.save(tempFile, async function (err) {
      if (err) {
        return res.status(500).send("Error generating speech");
      }

      if (Number(speed) !== 1) {
        const atempo = Math.max(0.5, Math.min(2.0, speed));
        const ffmpegCmd = `ffmpeg -i "${tempFile}" -filter:a "atempo=${atempo}" -y "${filePath}"`;

        exec(ffmpegCmd, (error) => {
          if (error) {
            console.error("FFmpeg Error:", error);
            return res.status(500).send("Error processing audio speed");
          }

          fs.unlink(tempFile, (unlinkErr) => {
            if (unlinkErr) {
              console.error("Error deleting temporary file:", unlinkErr);
            }
          });

          res.sendFile(filePath);
        });
      } else {
        // If speed = 1, just rename the file and send it
        fs.renameSync(tempFile, filePath);
        res.sendFile(filePath);
      }
    });
  } catch (error) {
    console.error("Error generating speech:", error);
    return res.status(500).send("Error generating speech");
  }
});

app.get("/", (req, res) => {
  cleanupOldFiles(audioDir);

  const languageOptions = Object.entries(LANGUAGES)
    .map(([code, name]) => `<option value="${code}">${name}</option>`)
    .join("");

  res.send(generateHomeHTML(languageOptions));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
