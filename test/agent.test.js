import test from 'node:test';
import assert from 'node:assert/strict';

import { AISalesAgent } from '../src/core/Agent.js';

function createStubLLM() {
  return {
    async complete() {
      return 'Stub response';
    },
    async completeJSON() {
      return {
        intent: 'greeting',
        confidence: 0.95,
        entities: {}
      };
    }
  };
}

test('AISalesAgent accepts llmProvider alias and supports processMessage compatibility API', async () => {
  const agent = new AISalesAgent({
    llmProvider: createStubLLM()
  });

  const response = await agent.processMessage({
    userId: 'user-1',
    message: 'hello'
  });

  assert.equal(typeof response.text, 'string');
  assert.equal(response.intent, 'greeting');
  assert.equal(response.confidence, 0.95);
});

test('processMessage validates required input fields', async () => {
  const agent = new AISalesAgent({
    llm: createStubLLM()
  });

  await assert.rejects(
    () => agent.processMessage({ message: 'hello' }),
    /sessionId or input\.userId/
  );

  await assert.rejects(
    () => agent.processMessage({ userId: 'user-1', message: '' }),
    /non-empty string input\.message/
  );
});
