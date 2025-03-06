const fs = require("fs");

// Function to download images from URL
async function downloadImage(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
}

module.exports = { downloadImage };
