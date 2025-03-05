const express = require("express");
const gtts = require("gtts");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { cleanupOldFiles } = require("./utils/cleanupOldFiles");
const { formatTextWithGemini } = require("./utils/formatTextWithGemini");
const { createDirIfNotExists } = require("./utils/createDirIfNotExists");
const { downloadImage } = require("./utils/downloadImage");

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

// Audio and video storage directories
const audioDir = path.join(__dirname, "audio");
const videoDir = path.join(__dirname, "videos");

app.post("/slideshow", async (req, res) => {
  const { images, duration = 3, fps = 30 } = req.body;

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).send("Invalid image list");
  }

  try {
    cleanupOldFiles(videoDir);
    createDirIfNotExists(videoDir);
    const now = Date.now();
    const tempFile = path.join(videoDir, `images_${now}.txt`);
    const outputVideo = path.join(videoDir, `slideshow_${now}.mp4`);

    let fileList = "";
    for (let i = 0; i < images.length; i++) {
      let imagePath = images[i];

      // If it is a URL, download it
      if (imagePath.startsWith("http")) {
        const localPath = path.join(videoDir, `image_${now}_${i}.jpg`);
        await downloadImage(imagePath, localPath);
        imagePath = localPath;
      }

      fileList += `file '${imagePath}'\nduration ${duration}\n`;
    }

    // Ensure the image list has the correct end line format
    fileList += `file '${images[images.length - 1]}'\n`;

    await fs.promises.writeFile(tempFile, fileList);

    // FFmpeg command to create a universally playable video
    const cmd = `ffmpeg -f concat -safe 0 -i "${tempFile}" -vf "scale='trunc(iw/2)*2':'trunc(ih/2)*2',fps=${fps},format=yuv420p" -pix_fmt yuv420p -c:v libx264 -crf 23 -preset slow -movflags +faststart -y "${outputVideo}"`;

    exec(cmd, async (error) => {
      if (error) {
        console.error("FFmpeg Error:", error);
        return res.status(500).send("Error generating slideshow");
      }

      // Check if video exists before sending
      if (fs.existsSync(outputVideo)) {
        res.download(outputVideo);
      } else {
        res.status(500).send("Video creation failed.");
      }
    });
  } catch (error) {
    console.error("Error generating slideshow:", error);
    res.status(500).send("Error generating slideshow");
  }
});

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
    cleanupOldFiles(audioDir);
    createDirIfNotExists(audioDir);
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

      // If the speed is not equal to 1, adjust the audio speed
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

app.get("/clear-expired-files", (req, res) => {
  // Cleanup expired files
  cleanupOldFiles(audioDir);
  cleanupOldFiles(videoDir);
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Cleanup expired files
cleanupOldFiles(audioDir);
cleanupOldFiles(videoDir);
