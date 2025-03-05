const fs = require("fs");

// Function to download images from URL
async function downloadImage(url, filepath) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);

    const buffer = await response.arrayBuffer();
    await fs.promises.writeFile(filepath, Buffer.from(buffer));
  } catch (error) {
    console.error(`Error downloading image: ${url}`, error);
    throw error;
  }
}

module.exports = { downloadImage };
