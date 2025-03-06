const express = require("express");
const { createCanvas, loadImage } = require("canvas");
const gtts = require("gtts");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { cleanupOldFiles } = require("./utils/cleanupOldFiles");
const { formatTextWithGemini } = require("./utils/formatTextWithGemini");
const { createDirIfNotExists } = require("./utils/createDirIfNotExists");
const { downloadImage } = require("./utils/downloadImage");
const { createSlideshow } = require("slideshow-video");
const { fetchNewsData } = require("./utils/fetchNewsData");

dotenv.config();
const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());
app.use(express.static("public"));

// Audio and video storage directories
const audioDir = path.join(__dirname, "audio");
const videoDir = path.join(__dirname, "videos");

// 🎨 Hàm lấy màu trung bình của ảnh (CẦN ĐỊNH NGHĨA TRƯỚC KHI GỌI)
async function getAverageColor(image) {
  const tempCanvas = createCanvas(image.width, image.height);
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(image, 0, 0, image.width, image.height);

  // Lấy dữ liệu pixel
  const imageData = tempCtx.getImageData(0, 0, image.width, image.height).data;

  let r = 0,
    g = 0,
    b = 0,
    count = 0;
  for (let i = 0; i < imageData.length; i += 4) {
    r += imageData[i]; // Red
    g += imageData[i + 1]; // Green
    b += imageData[i + 2]; // Blue
    count++;
  }

  return {
    r: Math.floor(r / count),
    g: Math.floor(g / count),
    b: Math.floor(b / count),
  };
}

app.post("/slideshow", async (req, res) => {
  const { images, duration = 1, fps = 60 } = req.body;

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).send("Invalid image list");
  }

  try {
    await Promise.all([
      createDirIfNotExists(videoDir),
      cleanupOldFiles(videoDir),
      cleanupOldFiles(audioDir),
    ]);

    const now = Date.now();
    const outputVideo = path.join(videoDir, `slideshow_${now}.mp4`);
    const localImages = new Array(images.length);

    await Promise.all(
      images.map(async (imagePath, i) => {
        if (imagePath.startsWith("http")) {
          const localPath = path.join(videoDir, `${i}.png`);
          try {
            const downloadedBuffer = await downloadImage(imagePath);
            const img = await loadImage(downloadedBuffer);

            // 💡 Gọi hàm getAverageColor đúng cách
            const avgColor = await getAverageColor(img);
            const lightColor = `rgb(${Math.min(
              avgColor.r + 30,
              255
            )}, ${Math.min(avgColor.g + 30, 255)}, ${Math.min(
              avgColor.b + 30,
              255
            )})`;
            const darkColor = `rgb(${Math.max(avgColor.r - 30, 0)}, ${Math.max(
              avgColor.g - 30,
              0
            )}, ${Math.max(avgColor.b - 30, 0)})`;

            // Canvas setup
            const canvasWidth = 1080;
            const canvasHeight = 1920;
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext("2d");

            // 🎨 Gradient background
            const gradient = ctx.createLinearGradient(
              0,
              0,
              canvasWidth,
              canvasHeight
            );
            gradient.addColorStop(0, lightColor);
            gradient.addColorStop(1, darkColor);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Lấy tỷ lệ scale để ảnh "contain" trong khung
            const scale = Math.min(
              canvasWidth / img.width,
              canvasHeight / img.height
            );
            const drawWidth = img.width * scale;
            const drawHeight = img.height * scale;

            // Canh giữa ảnh trên canvas
            const centerX = (canvasWidth - drawWidth) / 2;
            const centerY = (canvasHeight - drawHeight) / 2;

            // Vẽ ảnh lên canvas mà không bị crop
            ctx.drawImage(img, centerX, centerY, drawWidth, drawHeight);

            // Overlay text
            ctx.fillStyle = "white";
            ctx.font = "bold 60px sans-serif";
            ctx.fillText("HOT NEWS", 750, 150);
            ctx.font = "bold 30px sans-serif";
            ctx.fillText("NGUỒN: TỔNG HỢP", 50, 100);
            ctx.fillText("HÌNH ẢNH VIDEO: MINH HỌA", 50, 150);

            // Save image
            const buffer = canvas.toBuffer("image/png");
            await fs.promises.writeFile(localPath, buffer);
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
        imageTransition: "smoothright",
        loopTransition: "fadeslow",
      },
      ffmpegOptions: {
        fps,
      },
    };

    try {
      const result = await createSlideshow([...localImages], "", options);
      fs.writeFileSync(outputVideo, result.buffer);
      res.sendFile(
        outputVideo,
        { headers: { "Content-Type": "video/mp4" } },
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
  let htmlResponse =
    "<html><body><h1>News</h1><table border='1'><tr><th>Title</th><th>Images</th><th>Audio</th></tr>";
  results.forEach((newsItem) => {
    htmlResponse += `<tr><td><strong>${newsItem.title}</strong></td><td>`;
    if (newsItem.images && newsItem.images.length > 0) {
      newsItem.images.forEach((image) => {
        htmlResponse += `<img src="${image}" alt="${newsItem.title}" style="width:200px;" loading="lazy"><br>`;
      });
    }
    htmlResponse += `</td><td>`;
    if (newsItem.audio) {
      htmlResponse += `<audio controls><source src="${newsItem.audio}" type="audio/mpeg">Your browser does not support the audio element.</audio>`;
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

app.listen(port, () =>
  console.log(`Server is running on http://localhost:${port}`)
);

// Cleanup expired files
cleanupOldFiles(audioDir);
cleanupOldFiles(videoDir);
