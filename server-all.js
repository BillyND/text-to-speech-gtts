const express = require("express");
const gtts = require("gtts");
const dotenv = require("dotenv");
const path = require("path");
const { exec } = require("child_process");
const fs = require("fs");
const fetch = require("node-fetch");
const { createSlideshow } = require("slideshow-video");
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

async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function formatTextWithGemini(text) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Làm phẳng văn bản để dễ đọc hơn.
                        - Loại bỏ các từ giải thích khi dùng mở ngoặc. Cụm liên quan đến "text to speech" thì giữ nguyên.
                             VD1: "Bảng xếp hạng (BXH)" => "bảng xếp hạng"
                             VD2: "trí tuệ nhân tạo (AI)" => "AI".
                        - Các số dạng nghìn như là 4.000 thì loại bỏ dấu chấm ngắn cách giữa các số thành 4000.
                        - Hãy review thật kỹ các ký tự, số học mà khó đọc thì hãy biến đổi nó thành chữ dễ đọc.
                        - Các ký tự đặc biệt không thuộc bảng chữ cái tiếng Việt sẽ được diễn giải dựa vào ngữ cảnh (ví dụ: salim => sa lim).
                        - Xoá toàn bộ dấu ngoặc kép.
                        - Rút gọn một số câu để tóm gọn ý hơn.
                        - Xoá tên người viết bài, nguồn bài ở cuối bài.
                        - Các yêu cầu của tôi bên trên, hãy review kỹ như một người viết báo chuyên nghiệp, làm theo yêu cầu lần lượt một.
                        - Đây là nội dung của tôi cần làm phẳng "${text}".
                        - Trả về kết quả đã xử lý mà không kèm bất kỳ câu trả lời phụ nào.`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    return data?.candidates?.[0]?.content?.parts?.[0]?.text || text;
  } catch (error) {
    console.error("Error formatting text with Gemini:", error);
    return text; // Return original text if API fails
  }
}

// Create a directory if it doesn't exist
const createDirIfNotExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

function cleanupOldFiles(dir) {
  if (!dir) return console.error("Error: directory is undefined.");
  fs.readdir(dir, (err, files) => {
    if (err) return console.error("Error reading directory:", err);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return console.error("Error getting file information:", err);
        if (Date.now() - stats.mtimeMs > 10000) {
          fs.unlink(filePath, (err) => {
            if (err) console.error("Error deleting file:", err);
          });
        }
      });
    });
  });
}

app.post("/slideshow", async (req, res) => {
  const { images, duration = 1, fps = 60 } = req.body;

  if (!images?.length) return res.status(400).send("Invalid image list");

  try {
    await Promise.all([
      createDirIfNotExists(videoDir),
      cleanupOldFiles(videoDir),
      cleanupOldFiles(audioDir),
    ]);

    const now = Date.now();
    const outputVideo = path.join(videoDir, `slideshow_${now}.mp4`);
    const localImages = await Promise.all(
      images.map(async (imagePath, i) => {
        if (!imagePath.startsWith("http")) return;
        const localPath = path.join(videoDir, `${i}.png`);
        try {
          const downloadedBuffer = await downloadImage(imagePath);
          const colors = await getColors(
            await sharp(downloadedBuffer).jpeg().toBuffer(),
            "image/jpeg"
          );
          const [color1, color2] = colors.map((c) => c.hex());
          const gradientBackground = `<svg width="1080" height="1920"><defs><linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${color1}" /><stop offset="100%" stop-color="${color2}" /></linearGradient></defs><rect width="1080" height="1920" fill="url(#bgGrad)" /></svg>`;
          const resizedImageBuffer = await sharp(downloadedBuffer)
            .resize({ width: 1080, height: 1080, fit: "cover" })
            .png()
            .toBuffer();
          let image = sharp(Buffer.from(gradientBackground)).composite([
            { input: resizedImageBuffer, gravity: "center" },
          ]);
          const svgOverlay = `<svg width="1080" height="1920">${
            i === 0
              ? `<defs><linearGradient id="fadeGrad" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="rgba(255,0,0,0.3)" /><stop offset="100%" stop-color="rgba(255,0,0,0)" /></linearGradient></defs>`
              : ""
          }<rect width="1080" height="1920" fill="url(#fadeGrad)" />${
            i === 0
              ? `<text x="20" y="1600" font-size="60px" fill="white" font-family="sans-serif" font-weight="900">ẢNH MỘT ĐÂY NÀY</text>`
              : ""
          }<g transform="rotate(15 925,185)"><text x="900" y="170" font-size="70px" fill="white" font-family="sans-serif" font-weight="900">HOT</text><text x="950" y="200" font-size="30px" fill="white" font-family="sans-serif" font-weight="900">NEWS</text></g><text x="20" y="160" font-size="30px" fill="white" font-family="sans-serif" font-weight="900">NGUỒN: TỔNG HỢP</text><text x="20" y="200" font-size="30px" fill="white" font-family="sans-serif" font-weight="900">HÌNH ẢNH VIDEO: MINH HỌA</text></svg>`;
          image = image.composite([
            { input: resizedImageBuffer, gravity: "center" },
            { input: Buffer.from(svgOverlay), gravity: "south" },
          ]);
          const finalBuffer = await image.png().toBuffer();
          await fs.promises.writeFile(localPath, finalBuffer);
          return localPath;
        } catch (err) {
          console.error(`Error processing image ${imagePath}:`, err);
        }
      })
    );

    const options = {
      imageOptions: { imageDuration: duration * 1000 },
      transitionOptions: {
        transitionDuration: 250,
        imageTransition: "smoothleft",
        loopTransition: "fadeslow",
      },
      ffmpegOptions: { fps },
    };

    try {
      const result = await createSlideshow(
        localImages.filter(Boolean),
        "",
        options
      );
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

  console.log(text);

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

    for (const url of TRIGGER_URLS) {
      try {
        await sleep(5000);
        await fetch(url);
      } catch (err) {
        console.error(`❌ Request to ${url} failed:`, err);
      }
    }

    res.status(200).send("✅ Cleanup and requests completed");
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
