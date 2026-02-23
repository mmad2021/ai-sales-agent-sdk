import { LLMProvider } from '../base/LLMProvider.js';

const CLAUDE_NOT_IMPLEMENTED_MESSAGE =
  'ClaudeProvider is not implemented yet in this release. Use OllamaProvider or implement a custom LLMProvider.';

export class ClaudeProvider extends LLMProvider {
  constructor(options = {}) {
    super();
    this.options = options;
  }

  async complete() {
    throw new Error(CLAUDE_NOT_IMPLEMENTED_MESSAGE);
  }

  async completeJSON() {
    throw new Error(CLAUDE_NOT_IMPLEMENTED_MESSAGE);
  }

  async analyzeImage() {
    throw new Error(CLAUDE_NOT_IMPLEMENTED_MESSAGE);
  }
}
