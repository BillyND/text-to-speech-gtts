const fs = require("fs");
const path = require("path");
const { createDirIfNotExists } = require("./createDirIfNotExists");

// Function to delete audio files older than 1 hour
function cleanupOldFiles(audioDir) {
  if (!audioDir) {
    console.error("Error: audioDir is undefined.");
    return;
  }

  createDirIfNotExists(audioDir);

  const now = Date.now();

  fs.readdir(audioDir, (err, files) => {
    if (err) {
      console.error("Error reading audio directory:", err);
      return;
    }

    files.forEach((file) => {
      const filePath = path.join(audioDir, file);

      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error("Error getting file information:", err);
          return;
        }

        // Check if the file is older than 10 seconds
        if (now - stats.mtimeMs > 10000) {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error("Error deleting file:", err);
            } else {
              console.log(`Deleted old file: ${file}`);
            }
          });
        }
      });
    });
  });
}

module.exports = { cleanupOldFiles };
