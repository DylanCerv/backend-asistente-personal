const OpenAI = require("openai");
const fs = require("fs");
const { env } = require("../config");
const { withRetry } = require("../utils/retry");
const { createLogger } = require("../utils/logger");
const {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserMessage,
} = require("../prompts/extraction.prompt");
const { buildChatSystemPrompt } = require("../prompts/chat.prompt");
const { buildEditExtractionPrompt } = require("../prompts/edit.prompt");

const logger = createLogger("openai");

let client = null;

function getOpenAIClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: env.openaiApiKey(),
    });
  }
  return client;
}

async function transcribeAudio(filePath) {
  const openai = getOpenAIClient();

  return withRetry(
    async () => {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: env.openaiTranscriptionModel(),
        language: "es",
        response_format: "text",
      });

      return typeof transcription === "string"
        ? transcription
        : transcription.text;
    },
    {
      maxAttempts: env.workerMaxRetries,
      label: "transcription",
    }
  );
}

async function extractStructuredData(transcription) {
  const openai = getOpenAIClient();
  const model = env.openaiExtractionModel();

  return withRetry(
    async () => {
      const response = await openai.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: buildExtractionUserMessage(transcription),
          },
        ],
      });

      if (response.usage) {
        logger.info("Extraction token usage", {
          model,
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        });
      }

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error("OpenAI returned an empty response");
      }

      try {
        return JSON.parse(content);
      } catch (parseError) {
        logger.error("Failed to parse OpenAI JSON response", {
          error: parseError.message,
        });
        throw new Error("Invalid JSON returned by OpenAI");
      }
    },
    {
      maxAttempts: env.workerMaxRetries,
      label: "structured extraction",
    }
  );
}

async function generateChatReply({ message, userName, context }) {
  const openai = getOpenAIClient();
  const model = env.openaiChatModel();

  return withRetry(
    async () => {
      const response = await openai.chat.completions.create({
        model,
        temperature: 0.6,
        max_tokens: 350,
        messages: [
          {
            role: "system",
            content: buildChatSystemPrompt({ userName, context }),
          },
          {
            role: "user",
            content: message,
          },
        ],
      });

      if (response.usage) {
        logger.info("Chat token usage", {
          model,
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        });
      }

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("OpenAI returned an empty chat response");
      }

      return content;
    },
    {
      maxAttempts: env.workerMaxRetries,
      label: "chat reply",
    }
  );
}

async function resolveEditIntent(message, context) {
  const openai = getOpenAIClient();
  const model = env.openaiExtractionModel();
  const { systemPrompt, userMessage } = buildEditExtractionPrompt(message, context);

  return withRetry(
    async () => {
      const response = await openai.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return { isEditIntent: false };

      try {
        return JSON.parse(content);
      } catch {
        return { isEditIntent: false };
      }
    },
    { maxAttempts: 2, label: "edit intent" }
  );
}

module.exports = {
  getOpenAIClient,
  transcribeAudio,
  extractStructuredData,
  generateChatReply,
  resolveEditIntent,
};
