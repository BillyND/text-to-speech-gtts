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
const fetch = require("node-fetch");
const { createSlideshow } = require("slideshow-video");
const { TRIGGER_URLS } = require("./constant");
const { sleep } = require("./utils/sleep");

dotenv.config();
const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());
app.use(express.static("public"));

// Audio and video storage directories
const audioDir = path.join(__dirname, "audio");
const videoDir = path.join(__dirname, "videos");

app.post("/slideshow", async (req, res) => {
  const { images, duration = 1, fps = 60 } = req.body;

  // Validate images array
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).send("Invalid image list");
  }

  try {
    // Ensure video directory exists and cleanup old files
    await Promise.all([
      createDirIfNotExists(videoDir),
      cleanupOldFiles(videoDir),
      cleanupOldFiles(audioDir),
    ]);

    await Promise.all([cleanupOldFiles(audioDir), cleanupOldFiles(videoDir)]);
    const now = Date.now();
    const outputVideo = path.join(videoDir, `slideshow_${now}.mp4`);
    const localImages = [];

    // Download images and store locally
    await Promise.all(
      images.map(async (imagePath, i) => {
        if (imagePath.startsWith("http")) {
          const localPath = path.join(videoDir, `${i}.png`);
          try {
            await downloadImage(imagePath, localPath);
            localImages.push({ filePath: localPath });
          } catch (downloadError) {
            console.error(
              `Failed to download image ${imagePath}:`,
              downloadError
            );
            // Consider how to handle a failed download.  For example, skip the image or return an error.
            // For now, we'll skip it.
          }
        }
      })
    );

    // Slideshow options
    const options = {
      imageOptions: { imageDuration: duration * 1000 },
      transitionOptions: { transitionDuration: 250 },
      ffmpegOptions: {
        fps,
        showFfmpegOutput: false,
        showFfmpegCommand: false, // It's better to hide this in production
        streamCopyAudio: true,
        videoCodec: "libx264",
        x264Preset: "ultrafast",
      },
    };

    // Generate slideshow video
    try {
      const result = await createSlideshow([...localImages], "", options);
      fs.writeFileSync(outputVideo, result.buffer);
      res.sendFile(
        outputVideo,
        {
          headers: {
            "Content-Type": "video/mp4",
          },
        },
        (err) => {
          if (err) {
            console.error("Error sending file:", err);
            res.status(500).send("Error sending slideshow video");
          }
        }
      );
    } catch (slideshowError) {
      console.error("Error generating slideshow:", slideshowError);
      res.status(500).send("Error generating slideshow");
    }
  } catch (error) {
    console.error("Unexpected error during slideshow generation:", error);
    res.status(500).send("Unexpected error during slideshow generation");
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
    await Promise.all([cleanupOldFiles(audioDir), cleanupOldFiles(videoDir)]);
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

app.get("/clear-expired-files", async (req, res) => {
  try {
    await Promise.all([cleanupOldFiles(audioDir), cleanupOldFiles(videoDir)]);
    console.log("✅ Expired files cleanup completed");

    for (const url of TRIGGER_URLS) {
      try {
        await sleep(5000);
        await fetch(url);
        console.log(`✅ Request to ${url} succeeded`);
      } catch (err) {
        console.error(`❌ Request to ${url} failed:`, err);
      }
    }

    res
      .status(200)
      .send("✅ Server is running, cleanup and requests completed");
  } catch (error) {
    console.error("❌ Error in /clear-expired-files:", error);
    res.status(500).send("❌ Server encountered an error");
  }
});

app.listen(port, () =>
  console.log(`Server is running on http://localhost:${port}`)
);

// Cleanup expired files
cleanupOldFiles(audioDir);
cleanupOldFiles(videoDir);
