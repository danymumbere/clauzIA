const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function main() {
  try {
    const models = await ai.models.list();

    const list = [];
    for await (const model of models) {
      list.push(model);
    }

    console.log(JSON.stringify(list, null, 2));
  } catch (error) {
    console.error("Erreur lors du listing des modèles Gemini:");
    console.error(error);
  }
}

main();