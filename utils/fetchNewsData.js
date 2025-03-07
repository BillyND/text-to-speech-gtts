const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");

let cache = {
  data: null,
  timestamp: null,
};
const CACHE_DURATION = 3600 * 1000; // 1 hour in milliseconds

const fetchNewsData = async () => {
  const baseUrl = "https://kenh14.vn";
  const results = [];

  const fetchHtml = async (url) => {
    const res = await fetch(url);
    return res.text();
  };

  const cleanText = (text) => text.replace(/\n/g, " ").trim();

  try {
    const now = Date.now();
    if (
      cache.data &&
      cache.timestamp &&
      now - cache.timestamp < CACHE_DURATION
    ) {
      console.log("Returning cached data");
      return cache.data;
    }

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

    await Promise.all(
      Array.from(articleUrls).map(async (href) => {
        if (!href) return;

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

          const title = contentDoc.querySelector("h1.kbwc-title");
          const imageEls = contentDoc.querySelectorAll(".klw-new-content img");

          if (scriptTag) {
            const scriptContent = scriptTag.textContent;

            const domainStorage =
              scriptContent.match(/domainStorage:\s*'([^']+)'/)?.[1] ||
              "Not found";

            const newsId =
              scriptContent.match(/newsId:\s*'([^']+)'/)?.[1] || "Not found";

            const distributionDate =
              scriptContent.match(/distributionDate:\s*'([^']+)'/)?.[1] ||
              "Not found";

            const nameSpace =
              scriptContent.match(/nameSpace:\s*'([^']+)'/)?.[1] || "Not found";

            const ext = scriptContent.match(/ext:\s*'([^']+)'/)?.[1] || "m4a";

            const defaultVoice =
              scriptContent.match(/defaultVoice:\s*'([^']+)'/)?.[1] || "nu";

            const audioUrl = `${domainStorage}/${distributionDate}/${nameSpace}-${defaultVoice}-${newsId}.${ext}`;
            try {
              const audioResponse = await fetch(audioUrl);
              if (audioResponse.ok) {
                const contentLength =
                  audioResponse.headers.get("content-length");
                if (contentLength && parseInt(contentLength) > 320000) {
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
        } catch (error) {
          console.error(`Error fetching ${href}:`, error.message);
        }
      })
    );

    console.log(`Number of results: ${results.length}`);
    cache = {
      data: results,
      timestamp: now,
    };
    return results;
  } catch (error) {
    console.error("Error fetching news:", error);
    throw error;
  }
};

module.exports = { fetchNewsData };
