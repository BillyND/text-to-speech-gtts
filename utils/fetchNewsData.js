const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
};

const NewsSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  images: [String],
  audio: String,
  createdAt: { type: Date, default: Date.now },
  isPosted: { type: Boolean, default: false },
  expireAt: {
    type: Date,
    default: Date.now,
    expires: 2 * 24 * 3600, // 2 days in seconds
  },
});

const News = mongoose.model("News", NewsSchema);

const CACHE_DURATION = 3600 * 1000; // 1 hour

const fetchHtml = async (url) => {
  const res = await fetch(url);
  return res.text();
};

const cleanText = (text) => text.replace(/\n/g, " ").trim();

const processAndSaveNewsData = async () => {
  const baseUrl = "https://kenh14.vn";
  const results = [];

  try {
    const response = await fetch(`${baseUrl}/doi-song.chn`);
    const text = await response.text();
    const dom = new JSDOM(text);
    const document = dom.window.document;
    const links = document.querySelectorAll("a:has(img), a:has(video)");

    const articleUrls = new Set(
      Array.from(links)
        .map((link) => link.href)
        .filter((href) => !href.startsWith("http"))
    );

    for (const href of articleUrls) {
      if (!href) continue;

      try {
        const url = `${baseUrl}${href}`;
        const contentHtml = await fetchHtml(url);

        const contentDom = new JSDOM(contentHtml, { url });
        const contentDoc = contentDom.window.document;
        let audioLink = "";

        const scriptTag = Array.from(
          contentDoc.querySelectorAll("script")
        ).find((script) =>
          script.textContent.includes(
            "https://static.mediacdn.vn/common/js/embedTTSv13min.js"
          )
        );

        if (scriptTag) {
          try {
            const scriptContent = scriptTag.textContent;

            const match = scriptContent.match(/domainStorage:\s*'([^']+)'/);
            const domainStorage = match && match[1] ? match[1] : "Not found";

            const matchNewsId = scriptContent.match(/newsId:\s*'([^']+)'/);
            const newsId =
              matchNewsId && matchNewsId[1] ? matchNewsId[1] : "Not found";

            const matchDistributionDate = scriptContent.match(
              /distributionDate:\s*'([^']+)'/
            );
            const distributionDate =
              matchDistributionDate && matchDistributionDate[1]
                ? matchDistributionDate[1]
                : "Not found";

            const matchNameSpace = scriptContent.match(
              /nameSpace:\s*'([^']+)'/
            );
            const nameSpace =
              matchNameSpace && matchNameSpace[1]
                ? matchNameSpace[1]
                : "Not found";

            const matchExt = scriptContent.match(/ext:\s*'([^']+)'/);
            const ext = matchExt && matchExt[1] ? matchExt[1] : "m4a";

            const matchDefaultVoice = scriptContent.match(
              /defaultVoice:\s*'([^']+)'/
            );
            const defaultVoice =
              matchDefaultVoice && matchDefaultVoice[1]
                ? matchDefaultVoice[1]
                : "nu";

            const audioUrl = `${domainStorage}/${distributionDate}/${nameSpace}-${defaultVoice}-${newsId}.${ext}`;
            const audioResponse = await fetch(audioUrl);
            if (audioResponse.ok) {
              const contentLength = audioResponse.headers.get("content-length");
              if (contentLength && parseInt(contentLength) > 320000) {
                audioLink = audioUrl;
              }
            }
          } catch (audioError) {
            console.error(
              `Audio not found or insufficient length at ${audioUrl}:`,
              audioError.message
            );
          }

          const title = contentDoc.querySelector("h1.kbwc-title");
          const imageEls = contentDoc.querySelectorAll(".klw-new-content img");

          const item = {
            url,
            title: title ? cleanText(title.textContent) : "",
            images: Array.from(imageEls)
              .map((img) => img.src)
              .filter(Boolean),
            audio: audioLink || "",
          };

          if (item.title && item.audio) {
            results.push(item);
          }

          // Save to MongoDB
          try {
            await News.findOneAndUpdate({ url: item.url }, item, {
              upsert: true,
            });
          } catch (mongoError) {
            console.error(
              `Error saving ${item.title} to MongoDB:`,
              mongoError.message
            );
          }
        }
      } catch (error) {
        console.error(`Error fetching ${href}:`, error.message);
      }
    }

    return results;
  } catch (error) {
    console.error("Error fetching news:", error);
    throw error;
  }
};

const fetchNewsData = async () => {
  try {
    // Check MongoDB for cached data
    const cachedNews = await News.find({
      createdAt: { $gt: new Date(Date.now() - CACHE_DURATION) },
    }).sort({ createdAt: -1 });

    if (cachedNews.length > 0) {
      // Update database in background
      processAndSaveNewsData();
      return cachedNews;
    }

    return await processAndSaveNewsData();
  } catch (error) {
    console.error("Error fetching news:", error);
    throw error;
  }
};

module.exports = { fetchNewsData, connectDB };
