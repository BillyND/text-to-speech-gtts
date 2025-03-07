const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

// Xác định đường dẫn gốc của ứng dụng
const ROOT_DIR = process.cwd();
const CACHE_DURATION = 3600 * 1000; // 1 hour in milliseconds
const CACHE_DIR = path.join(ROOT_DIR, "cache");
const CACHE_FILE = path.join(CACHE_DIR, "news-data.json");

// Đảm bảo thư mục cache tồn tại
const ensureCacheDir = () => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
};

// Đọc dữ liệu cache từ file
const readCache = () => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading cache file:", error);
  }
  return null;
};

// Ghi dữ liệu cache vào file
const writeCache = (data) => {
  try {
    ensureCacheDir();
    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      }),
      "utf8"
    );
  } catch (error) {
    console.error("Error writing cache file:", error);
  }
};

// Kiểm tra cache có hợp lệ không
const isCacheValid = (cache) => {
  return (
    cache &&
    cache.data &&
    cache.timestamp &&
    Date.now() - cache.timestamp < CACHE_DURATION
  );
};

const fetchNewsData = async () => {
  const baseUrl = "https://kenh14.vn";
  const results = [];

  const fetchHtml = async (url) => {
    const res = await fetch(url);
    return res.text();
  };

  const cleanText = (text) => text.replace(/\n/g, " ").trim();

  try {
    // Đọc cache từ file
    const cache = readCache();

    // Nếu có cache hợp lệ, trả về cache và cập nhật cache mới trong nền
    if (isCacheValid(cache)) {
      if (Date.now() - cache.timestamp < 10 * 60 * 1000) {
        // Cập nhật cache trong nền mà không chờ đợi nếu cache chưa quá 10 phút
        fetchAndUpdateCache().catch((error) =>
          console.error("Background cache update failed:", error)
        );
      }

      // Trả về cache hiện tại ngay lập tức
      return cache.data;
    }

    // Không có cache hợp lệ, fetch dữ liệu mới
    return await fetchAndUpdateCache();

    // Function nội bộ để fetch và cập nhật cache
    async function fetchAndUpdateCache() {
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
            const imageEls = contentDoc.querySelectorAll(
              ".klw-new-content img"
            );

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

      // Lưu kết quả vào file cache
      writeCache(results);

      return results;
    }
  } catch (error) {
    console.error("Error fetching news:", error);
    throw error;
  }
};

module.exports = { fetchNewsData };
