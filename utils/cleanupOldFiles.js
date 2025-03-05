const { ONE_HOUR_IN_MILLISECONDS } = require("../constant");
const fs = require("fs");
const path = require("path");

// Function to delete audio files older than 1 hour
function cleanupOldFiles(audioDir) {
  if (!audioDir) {
    console.error("Error: audioDir is undefined.");
    return;
  }

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

        if (now - stats.mtimeMs > 1000) {
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
