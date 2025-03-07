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
