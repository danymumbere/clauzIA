const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

async function generateOutfitDescription(userData) {

  const prompt = `
Tu es un styliste professionnel.

Utilisateur :
- Humeur : ${userData.mood}
- Occasion : ${userData.occasion}
- Saison : ${userData.season}

Vêtements :
${userData.garments}

Décris la tenue idéale.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt
  });

  return response.text;
}

async function generateOutfitImage(prompt) {

  const response = await ai.models.generateImages({
    model: "gemini-2.5-flash-image",
    prompt
  });

  return response.generatedImages?.[0];
}

module.exports = {
  generateOutfitDescription,
  generateOutfitImage
};