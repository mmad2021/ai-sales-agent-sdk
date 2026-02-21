import { LLMProvider } from '../base/LLMProvider.js';

export class ClaudeProvider extends LLMProvider {
  constructor(options = {}) {
    super();
    this.options = options;
  }

  async complete() {
    throw new Error('ClaudeProvider is not implemented in Phase 1');
  }

  async completeJSON() {
    throw new Error('ClaudeProvider is not implemented in Phase 1');
  }

  async analyzeImage() {
    throw new Error('ClaudeProvider is not implemented in Phase 1');
  }
}
