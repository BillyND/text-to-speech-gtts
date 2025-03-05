const dotenv = require("dotenv");
dotenv.config();

async function formatTextWithGemini(text) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Làm phẳng văn bản để dễ đọc hơn.
                        - Loại bỏ các từ giải thích khi dùng mở ngoặc. Cụm liên quan đến "text to speech" thì giữ nguyên.
                             VD1: "Bảng xếp hạng (BXH)" => "bảng xếp hạng"
                             VD2: "trí tuệ nhân tạo (AI)" => "AI".
                        - Các số dạng nghìn như là 4.000 thì loại bỏ dấu chấm ngắn cách giữa các số thành 4000.
                        - Hãy review thật kỹ các ký tự, số học mà khó đọc thì hãy biến đổi nó thành chữ dễ đọc.

                        - Các ký tự đặc biệt không thuộc bảng chữ cái tiếng Việt sẽ được diễn giải dựa vào ngữ cảnh.
                        - Xoá toàn bộ dấu ngoặc kép.
                        - Rút gọn một số câu để tóm gọn ý hơn.
                        - Xoá tên người viết bài, nguồn bài ở cuối bài.
                        - Các dấu câu đều được chuyển thành dấu 3 chấm ....
                        - Các yêu cầu của tôi bên trên, hãy review kỹ như một người viết báo chuyên nghiệp, làm theo yêu cầu lần lượt một.
                        - Đây là nội dung của tôi cần làm phẳng "${text}".
                        - Trả về kết quả đã xử lý mà không kèm bất kỳ câu trả lời phụ nào.`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    console.log(
      "===> text",
      data &&
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] &&
        data.candidates[0].content.parts[0].text
    );

    return data?.candidates?.[0]?.content?.parts?.[0]?.text || text;
  } catch (error) {
    console.error("Error formatting text with Gemini:", error);
    return text; // Return original text if API fails
  }
}

module.exports = { formatTextWithGemini };
