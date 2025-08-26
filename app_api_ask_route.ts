import { NextResponse } from 'next/server';

// API endpoint URLs
const HF_API_URL = "https://api-inference.huggingface.co/models/google/flan-t5-small";
const HF_API_KEY = "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";
const NASA_APOD_URL = "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY";
const WIKI_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/";

async function getWikipediaSummary(topic: string) {
  try {
    const response = await fetch(WIKI_SUMMARY_URL + encodeURIComponent(topic));
    if (response.ok) {
      const data = await response.json();
      return { summary: data.extract, source: response.url };
    }
    return { summary: "", source: "" };
  } catch (error) {
    return { summary: "", source: "" };
  }
}

async function getNasaApod() {
  try {
    const response = await fetch(NASA_APOD_URL);
    if (response.ok) {
      const data = await response.json();
      return { explanation: data.explanation, imageUrl: data.url };
    }
    return { explanation: "", imageUrl: "" };
  } catch (error) {
    return { explanation: "", imageUrl: "" };
  }
}

async function queryHuggingFace(prompt: string) {
  try {
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (response.ok) {
      const result = await response.json();
      if (Array.isArray(result) && result.length > 0) {
        return result[0].generated_text;
      }
      return result.generated_text || "";
    }
    return "";
  } catch (error) {
    return "";
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const question = searchParams.get('question');

  if (!question) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 });
  }

  // Step 1: Get Wikipedia summary
  const topic = question.trim().replace(/\s+/g, '_');
  const { summary, source } = await getWikipediaSummary(topic);
  let imageUrl = null;

  // Step 2: If space-related, get NASA APOD
  if (question.toLowerCase().includes('space')) {
    const nasaData = await getNasaApod();
    if (nasaData.imageUrl) {
      imageUrl = nasaData.imageUrl;
    }
    if (nasaData.explanation) {
      const { explanation } = nasaData;
      const prompt = `Q: ${question}\nContext: ${explanation}\nA:`;
      const answer = await queryHuggingFace(prompt);

      return NextResponse.json({
        question,
        answer: answer || "Sorry, I couldn't generate an answer.",
        source: NASA_APOD_URL,
        image_url: imageUrl
      });
    }
  }

  // Step 3: Generate answer using HuggingFace
  const prompt = summary
    ? `Q: ${question}\nContext: ${summary}\nA:`
    : `Q: ${question}\nA:`;

  const answer = await queryHuggingFace(prompt);

  return NextResponse.json({
    question,
    answer: answer || "Sorry, I couldn't generate an answer.",
    source,
    image_url: imageUrl
  });
}