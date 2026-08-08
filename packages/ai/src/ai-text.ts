import {
  generateTuturuuuText,
} from "./tuturuuu-client.ts";

export interface GenerateAiTextOptions {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
}

export async function generateAiText(
  options: GenerateAiTextOptions,
): Promise<string> {
  void options.temperature;
  const result = await generateTuturuuuText({
    model: options.model,
    prompt: options.prompt,
    systemPrompt: options.systemPrompt,
  });
  return result.output.trim();
}
