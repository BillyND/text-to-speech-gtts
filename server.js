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
const sharp = require("sharp");
const getColors = require("get-image-colors");

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
    const localImages = new Array(images.length);

    await Promise.all(
      images.map(async (imagePath, i) => {
        if (imagePath.startsWith("http")) {
          const localPath = path.join(videoDir, `${i}.png`);

          try {
            const downloadedBuffer = await downloadImage(imagePath);

            const colors = await getColors(
              await sharp(downloadedBuffer).jpeg().toBuffer(),
              "image/jpeg"
            );
            const [color1, color2] = colors.map((c) => c.hex());

            const gradientBackground = `
              <svg width="1080" height="1920">
                <defs>
                  <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${color1}" />
                    <stop offset="100%" stop-color="${color2}" />
                  </linearGradient>
                </defs>
                <rect width="1080" height="1920" fill="url(#bgGrad)" />
              </svg>`;

            const resizedImageBuffer = await sharp(downloadedBuffer)
              .resize({ width: 1080, height: 1080, fit: "cover" })
              .png()
              .toBuffer();

            image = sharp(Buffer.from(gradientBackground)).composite([
              { input: resizedImageBuffer, gravity: "center" },
            ]);

            let svgOverlay = `
                <svg width="1080" height="1920">
                 ${
                   i === 0
                     ? `  <defs>
                    <linearGradient id="fadeGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                      <stop offset="0%" stop-color="rgba(255,0,0,0.3)" />
                      <stop offset="100%" stop-color="rgba(255,0,0,0)" />
                    </linearGradient>
                  </defs>`
                     : ""
                 }
                
                  <rect width="1080" height="1920" fill="url(#fadeGrad)" />
                  ${
                    i === 0
                      ? `<text x="20" y="1600" font-size="60px" fill="white" font-family="sans-serif" font-weight="900">ẢNH MỘT ĐÂY NÀY</text>`
                      : ""
                  }
                  <g transform="rotate(15 925,185)">
                    <text x="900" y="170" font-size="70px" fill="white" font-family="sans-serif" font-weight="900">HOT</text>
                    <text x="950" y="200" font-size="30px" fill="white" font-family="sans-serif" font-weight="900">NEWS</text>
                  </g>
                  <text x="20" y="160" font-size="30px" fill="white" font-family="sans-serif" font-weight="900">NGUỒN: TỔNG HỢP</text>
                  <text x="20" y="200" font-size="30px" fill="white" font-family="sans-serif" font-weight="900">HÌNH ẢNH VIDEO: MINH HỌA</text>
                </svg>`;

            image = image.composite([
              { input: resizedImageBuffer, gravity: "center" },
              { input: Buffer.from(svgOverlay), gravity: "south" },
            ]);

            const finalBuffer = await image.png().toBuffer();

            await fs.promises.writeFile(localPath, finalBuffer);
            localImages[i] = localPath;
          } catch (err) {
            console.error(`Error processing image ${imagePath}:`, err);
          }
        }
      })
    );

    const options = {
      imageOptions: {
        imageDuration: duration * 1000,
      },
      transitionOptions: {
        transitionDuration: 250,
        imageTransition: "smoothleft",
        loopTransition: "fadeslow",
      },
      ffmpegOptions: {
        fps,
      },
    };

    // Generate slideshow video
    try {
      /**@see https://0x464e.github.io/slideshow-video/ */
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
