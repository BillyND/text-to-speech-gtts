const express = require("express");
const gtts = require("gtts");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { cleanupOldFiles } = require("./utils/cleanupOldFiles");
const { formatTextWithGemini } = require("./utils/formatTextWithGemini");
const { fetchNewsData } = require("./utils/fetchNewsData");

dotenv.config();
const app = express();
const port = process.env.PORT || 4000;

const cors = require("cors");

app.use(cors());

app.use(express.json());
app.use(express.static("public"));

app.post("/tts", async (req, res) => {
  const {
    text,
    speed = 1,
    language = "vi",
    isOptimizeWithAI = false,
  } = req.body;

  if (!text) {
    return res.status(400).send("Text is required");
  }

  try {
    // Audio and video storage directories
    const audioDir = path.join(__dirname, "audio");

    await cleanupOldFiles(audioDir);
    let formattedText = text.trim();

    if (isOptimizeWithAI && language === "vi") {
      formattedText = await formatTextWithGemini(formattedText);
    }

    const now = Date.now();
    const fileName = `audio_${now}.mp3`;
    const filePath = path.join(audioDir, fileName);
    const tempFile = path.join(audioDir, `temp_audio_${now}.mp3`);
    const speech = new gtts(formattedText, language);

    speech.save(tempFile, function (err) {
      if (err) {
        return res.status(500).send("Error generating speech");
      }

      const processAudio = (pathFrom, pathTo) => {
        fs.renameSync(pathFrom, pathTo);
        res.sendFile(pathTo);
      };

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
        processAudio(tempFile, filePath);
      }
    });
  } catch (error) {
    console.error("Error generating speech:", error);
    res.status(500).send("Error generating speech");
  }
});

app.get("/news", async (req, res) => {
  try {
    const results = await fetchNewsData();
    res.status(200).json(results);
  } catch (error) {
    res.status(500).send("Error fetching news");
  }
});

function renderNewsTable(results) {
  let htmlResponse = `<html><body>
    <h1>News</h1>
    <table border='1'>
    <tr><th>Title</th><th>Actions</th></tr>
    <script>
    function copyTitle(title) {
      navigator.clipboard.writeText(title).then(function() {
        alert('Title copied to clipboard');
      }, function(err) {
        console.error('Error copying text: ', err);
      });
    }

    function downloadFile(url, filename) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    function downloadMultipleFiles(urls, title) {
      urls.forEach((url, index) => {
        const filename = title + '_image_' + (index + 1) + '.jpg';
        downloadFile(url, filename);
      });
    }
    </script>`;

  results.forEach((newsItem) => {
    htmlResponse += `<tr><td><strong>${newsItem.title}</strong></td><td>`;
    htmlResponse += `<button onclick="copyTitle('${newsItem.title.replace(
      /'/g,
      "\\'"
    )}')">Copy Title</button>`;

    if (newsItem.images && newsItem.images.length > 0) {
      const images = newsItem.images.map((image) => `'${image}'`).join(", ");
      htmlResponse += `<button onclick="downloadMultipleFiles([${images}], '${newsItem.title.replace(
        /'/g,
        "\\'"
      )}')">Download Images</button>`;
    }

    if (newsItem.audio) {
      htmlResponse += `<button onclick="downloadFile('${
        newsItem.audio
      }', '${newsItem.title.replace(
        /'/g,
        "\\'"
      )}.mp3')">Download Audio</button>`;
    }
    htmlResponse += `</td></tr>`;
  });
  htmlResponse += "</table></body></html>";
  return htmlResponse;
}

app.get("/news-view", async (req, res) => {
  try {
    const results = await fetchNewsData();
    const htmlResponse = renderNewsTable(results);
    res.status(200).send(htmlResponse);
  } catch (error) {
    res.status(500).send("Error fetching news");
  }
});

app.get("/", (req, res) => {
  res.status(200).send("Hello, world!");
});

app.listen(port, () =>
  console.log(`Server is running on http://localhost:${port}`)
);
