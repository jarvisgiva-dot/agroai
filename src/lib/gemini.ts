import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Google Generative AI client
// The API key should be stored in an environment variable
const apiKey = process.env.GOOGLE_API_KEY || "";

export const genAI = new GoogleGenerativeAI(apiKey);

export const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
