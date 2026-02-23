import { LLMProvider } from '../base/LLMProvider.js';

const OPENAI_NOT_IMPLEMENTED_MESSAGE =
  'OpenAIProvider is not implemented yet in this release. Use OllamaProvider or implement a custom LLMProvider.';

export class OpenAIProvider extends LLMProvider {
  constructor(options = {}) {
    super();
    this.options = options;
  }

  async complete() {
    throw new Error(OPENAI_NOT_IMPLEMENTED_MESSAGE);
  }

  async completeJSON() {
    throw new Error(OPENAI_NOT_IMPLEMENTED_MESSAGE);
  }

  async analyzeImage() {
    throw new Error(OPENAI_NOT_IMPLEMENTED_MESSAGE);
  }
}
