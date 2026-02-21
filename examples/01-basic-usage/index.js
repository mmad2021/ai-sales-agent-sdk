import { join } from 'path';
import {
  AISalesAgent,
  LLMProvider,
  MemorySessionStore,
  SQLiteClient,
  SQLiteProductAdapter,
  SQLiteOrderAdapter,
  SQLiteCustomerAdapter,
  SQLitePaymentAdapter
} from '../../src/index.js';

class DemoLLMProvider extends LLMProvider {
  async complete(prompt) {
    if (prompt.includes('Intent: checkout')) {
      return 'Your order is ready. I created your order and included payment details.';
    }
    if (prompt.includes('Intent: browse_products')) {
      return 'I found matching products for you. Tell me which one you want to add to cart.';
    }
    if (prompt.includes('Intent: add_to_cart')) {
      return 'Done. I added that item to your cart.';
    }
    if (prompt.includes('Intent: view_cart')) {
      return 'Here is your cart summary. When ready, say checkout.';
    }
    if (prompt.includes('Intent: track_order')) {
      return 'I checked your order. It is currently being processed.';
    }
    return 'I can help with products, cart, checkout, and tracking.';
  }

  async completeJSON(prompt) {
    const messageMatch = prompt.match(/Message:\s*"([\s\S]*?)"/i);
    const message = messageMatch ? messageMatch[1] : prompt;
    const lower = message.toLowerCase();

    if (lower.includes('checkout')) {
      return { intent: 'checkout', confidence: 0.94, entities: {} };
    }

    if (lower.includes('add') && lower.includes('cart')) {
      return {
        intent: 'add_to_cart',
        confidence: 0.93,
        entities: {
          product_type: 't-shirt',
          quantity: 1,
          color: 'black',
          size: 'M'
        }
      };
    }

    if (lower.includes('cart')) {
      return { intent: 'view_cart', confidence: 0.91, entities: {} };
    }

    return {
      intent: 'browse_products',
      confidence: 0.82,
      entities: {
        product_type: 't-shirt'
      }
    };
  }

  async analyzeImage() {
    return 'Vision is not used in this example.';
  }
}

async function seedProducts(client) {
  const count = await client.queryOne('SELECT COUNT(*) AS count FROM products');
  if ((count?.count || 0) > 0) {
    return;
  }

  await client.run(
    `INSERT INTO products (name, description, category, price, colors, sizes, stock, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'Classic Cotton T-Shirt',
      'Comfortable everyday cotton tee',
      'tops',
      25,
      JSON.stringify(['black', 'white', 'blue']),
      JSON.stringify(['S', 'M', 'L', 'XL']),
      50,
      'active'
    ]
  );

  await client.run(
    `INSERT INTO products (name, description, category, price, colors, sizes, stock, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'Slim Fit Jeans',
      'Modern slim fit denim jeans',
      'bottoms',
      60,
      JSON.stringify(['blue', 'black']),
      JSON.stringify(['30', '32', '34']),
      25,
      'active'
    ]
  );

  await client.save();
}

async function main() {
  const dbPath = join(process.cwd(), 'ai-sales-agent-sdk', 'examples', '01-basic-usage', 'example.db');
  const client = new SQLiteClient({ dbPath });
  await client.getDB();
  await seedProducts(client);

  const agent = new AISalesAgent({
    llm: new DemoLLMProvider(),
    adapters: {
      products: new SQLiteProductAdapter({ client }),
      orders: new SQLiteOrderAdapter({ client, taxRate: 0.08, freeShippingThreshold: 50, defaultShippingCost: 5 }),
      customers: new SQLiteCustomerAdapter({ client }),
      payments: new SQLitePaymentAdapter({ client })
    },
    sessionStore: new MemorySessionStore(),
    config: {
      business: {
        name: 'Urban Threads',
        description: 'Modern clothing boutique',
        currency: 'USD'
      }
    }
  });

  const sessionId = 'demo-session-001';

  const r1 = await agent.chat(sessionId, 'Show me t-shirts');
  const r2 = await agent.chat(sessionId, 'Add one black t-shirt size M to cart');
  const r3 = await agent.chat(sessionId, 'View cart');
  const r4 = await agent.chat(sessionId, 'Checkout', {
    customer: {
      name: 'Demo User',
      email: 'demo@example.com',
      phone: '+1-555-0100',
      address: {
        street: '123 Market St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94103',
        country: 'US'
      }
    }
  });

  console.log('\n[1] Browse:', r1.text);
  console.log('[2] Add to cart:', r2.text);
  console.log('[3] Cart:', r3.text);
  console.log('[4] Checkout:', r4.text);
  console.log('\nCheckout payload:', JSON.stringify(r4.data, null, 2));
}

main().catch((error) => {
  console.error('Example failed:', error);
  process.exitCode = 1;
});
