import { readFile } from 'fs/promises';
import { LLMProvider } from '../base/LLMProvider.js';

export class OllamaProvider extends LLMProvider {
  constructor(options = {}) {
    super();
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.model = options.model || 'qwen2.5-coder:14b';
    this.visionModel = options.visionModel || 'llava';
  }

  async complete(prompt, options = {}) {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        temperature: options.temperature ?? 0.7,
        stream: false,
        options: {
          top_p: options.topP ?? 0.9,
          num_predict: options.maxTokens
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.response || '').trim();
  }

  async completeJSON(prompt, schema, options = {}) {
    const jsonPrompt = `${prompt}\n\nRespond in valid JSON format matching this schema:\n${JSON.stringify(schema, null, 2)}`;
    const response = await this.complete(jsonPrompt, { ...options, temperature: options.temperature ?? 0.3 });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON response');
    }

    return JSON.parse(jsonMatch[0]);
  }

  async analyzeImage(imageUrl, prompt, options = {}) {
    const imageBase64 = await this._fetchImageAsBase64(imageUrl);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.visionModel,
        prompt,
        images: [imageBase64],
        temperature: options.temperature ?? 0.2,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama vision API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.response || '').trim();
  }

  async _fetchImageAsBase64(url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Unable to fetch image: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer).toString('base64');
    }

    const fileBuffer = await readFile(url);
    return Buffer.from(fileBuffer).toString('base64');
  }
}
