/**
 * Abstract interface for LLM providers
 */
export class LLMProvider {
  /**
   * Generate a completion
   * @param {string} prompt
   * @param {Object} options - { temperature, maxTokens, stopSequences }
   * @returns {Promise<string>}
   */
  async complete(prompt, options = {}) {
    throw new Error('Must implement complete()');
  }

  /**
   * Generate a structured JSON response
   * @param {string} prompt
   * @param {Object} schema - JSON schema for validation
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async completeJSON(prompt, schema, options = {}) {
    throw new Error('Must implement completeJSON()');
  }

  /**
   * Analyze an image (for vision models)
   * @param {string} imageUrl
   * @param {string} prompt
   * @param {Object} options
   * @returns {Promise<string>}
   */
  async analyzeImage(imageUrl, prompt, options = {}) {
    throw new Error('Must implement analyzeImage()');
  }
}
