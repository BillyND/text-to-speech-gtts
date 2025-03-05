const gtts = require("gtts");
const fs = require("fs");

const text = process.argv[2] || "Xin chào! Đây là giọng nói từ Google TTS.";
const speed = parseFloat(process.argv[3]) || 1;
const speech = new gtts(text, "vi", speed);

speech.save("output.mp3", function (err, result) {
  if (err) throw err;
  console.log("✅ File âm thanh đã được tạo: output.mp3");
});
