
const { google } = require("googleapis");
const { randomUUID } = require("crypto");

const DENOMINATIONS = [10, 20, 50, 100, 200, 500];

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (
    !spreadsheetId ||
    !process.env.GOOGLE_CLIENT_EMAIL ||
    !process.env.GOOGLE_PRIVATE_KEY
  ) {
    return res.status(500).json({
      error: "Google Sheets environment variables are missing",
    });
  }

  try {
    const sheets = getSheetsClient();

    if (req.method === "GET") {
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Notes!A2:I",
      });

      const rows = result.data.values || [];

      const notes = rows.map((row) => ({
        id: row[0] || "",
        date: row[1] || "",
        denomination: Number(row[2]) || 0,
        prefix: row[3] || "",
        alphabet: row[4] || "",
        serial: row[5] || "",
        fullSerial: row[6] || "",
        amount: Number(row[7]) || 0,
        createdAt: row[8] || "",
      }));

      return res.status(200).json({
        success: true,
        notes,
      });
    }

    const {
      denomination,
      prefix,
      alphabet,
      serial,
      date,
    } = req.body || {};

    const value = Number(denomination);
    const cleanPrefix = String(prefix ?? "").trim();
    const cleanAlphabet = String(alphabet ?? "").trim().toUpperCase();
    const cleanSerial = String(serial ?? "").trim();
    const cleanDate = String(date ?? "").trim();

    if (
      !DENOMINATIONS.includes(value) ||
      !/^\d+$/.test(cleanPrefix) ||
      !/^[A-Z]{1,3}$/.test(cleanAlphabet) ||
      !/^\d+$/.test(cleanSerial) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate) ||
      !Number.isFinite(Date.parse(cleanDate + "T00:00:00"))
    ) {
      return res.status(400).json({
        error: "Invalid currency note details",
      });
    }

    const fullSerial = `${cleanPrefix}${cleanAlphabet} ${cleanSerial}`;
    const entryId = randomUUID();
    const createdAt = new Date().toISOString();

    // Prevent duplicate serial entries.
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Notes!C2:G",
    });

    const duplicate = (existing.data.values || []).some((row) =>
      Number(row[0]) === value &&
      String(row[1] || "").trim() === cleanPrefix &&
      String(row[2] || "").trim().toUpperCase() === cleanAlphabet &&
      String(row[3] || "").trim() === cleanSerial
    );

    if (duplicate) {
      return res.status(409).json({
        error: "This currency note is already registered",
      });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Notes!A:I",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          entryId,
          cleanDate,
          value,
          cleanPrefix,
          cleanAlphabet,
          cleanSerial,
          fullSerial,
          value,
          createdAt,
        ]],
      },
    });

    return res.status(201).json({
      success: true,
      message: "Currency note saved successfully",
      note: {
        id: entryId,
        date: cleanDate,
        denomination: value,
        prefix: cleanPrefix,
        alphabet: cleanAlphabet,
        serial: cleanSerial,
        fullSerial,
        amount: value,
        createdAt,
      },
    });
  } catch (error) {
    console.error("Google Sheets API error:", error.message);

    return res.status(500).json({
      error: "Unable to process your Google Sheets request",
    });
  }
};
