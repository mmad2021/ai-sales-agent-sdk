import test from 'node:test';
import assert from 'node:assert/strict';

import { OpenAIProvider } from '../src/llm/providers/OpenAIProvider.js';
import { ClaudeProvider } from '../src/llm/providers/ClaudeProvider.js';

const NOT_IMPLEMENTED_HINT = /not implemented yet in this release/i;

test('OpenAIProvider throws a clear not-implemented error', async () => {
  const provider = new OpenAIProvider();

  await assert.rejects(
    () => provider.complete('hello'),
    NOT_IMPLEMENTED_HINT
  );
});

test('ClaudeProvider throws a clear not-implemented error', async () => {
  const provider = new ClaudeProvider();

  await assert.rejects(
    () => provider.complete('hello'),
    NOT_IMPLEMENTED_HINT
  );
});
