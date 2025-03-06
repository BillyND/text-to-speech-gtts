const axios = require("axios");
const { JSDOM } = require("jsdom");

const BASE_URL = "https://cafebiz.vn";

const cleanText = (text) => text.replace(/\n/g, " ").trim();

const fetchHtml = async (url) => {
  const res = await axios.get(url);
  return res.data;
};

let cache = {
  data: null,
  timestamp: 0,
  expiry: 10 * 60 * 1000, // 10 minutes
};

const updateCache = async () => {
  try {
    const results = [];
    const baseHtml = await fetchHtml(BASE_URL);
    const dom = new JSDOM(baseHtml, { url: BASE_URL });
    const document = dom.window.document;

    const anchorEls = Array.from(
      document.querySelectorAll('[type="midThumb"] a.thumb')
    );

    await Promise.all(
      anchorEls.map(async (anchor) => {
        const href = anchor.href;
        if (!href) return;

        try {
          const contentHtml = await fetchHtml(href);
          const contentDom = new JSDOM(contentHtml, { url: href });
          const contentDoc = contentDom.window.document;
          let audioLink = "";

          // Extract and log the script content
          const scriptTag = Array.from(
            contentDoc.querySelectorAll("script")
          ).find((script) => script.textContent.includes("embedTTS.init"));

          if (scriptTag) {
            const scriptContent = scriptTag.textContent;
            const domainStorageMatch = scriptContent.match(
              /domainStorage:\s*'([^']+)'/
            );
            const newsIdMatch = scriptContent.match(/newsId:\s*'([^']+)'/);
            const distributionDateMatch = scriptContent.match(
              /distributionDate:\s*'([^']+)'/
            );

            const domainStorage = domainStorageMatch
              ? domainStorageMatch[1]
              : "Not found";
            const newsId = newsIdMatch ? newsIdMatch[1] : "Not found";
            const distributionDate = distributionDateMatch
              ? distributionDateMatch[1]
              : "Not found";

            const audioUrl = `${domainStorage}/${distributionDate}/cafebiz-nu-${newsId}.m4a`;
            try {
              const audioResponse = await axios.head(audioUrl);
              if (audioResponse.status === 200) {
                const contentLength = audioResponse.headers["content-length"];

                if (contentLength && parseInt(contentLength) > 480000) {
                  // approximately 480KB (30 seconds at 128 kbps)

                  audioLink = audioUrl;
                }
              }
            } catch (error) {
              console.error(
                `Audio not found or insufficient length at ${audioUrl}:`,
                error.message
              );
            }
          }

          const title = contentDoc.querySelector('h1[data-role="title"]');
          const imageEls = contentDoc.querySelectorAll('img[rel="lightbox"]');

          const item = {
            title: title ? cleanText(title.textContent) : "",
            images: Array.from(imageEls)
              .map((img) => img.src)
              .filter(Boolean),
            audio: audioLink || "",
          };

          if (item.title && item.audio) {
            results.push(item);
          }
        } catch (error) {
          console.error(`Error fetching ${href}:`, error.message);
        }
      })
    );

    cache.data = results;
    cache.timestamp = Date.now();
  } catch (error) {
    console.error(`Error updating cache:`, error.message);
  }
};

updateCache();
