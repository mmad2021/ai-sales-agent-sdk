# AI Sales Agent SDK

> Framework-agnostic conversational commerce engine for building AI-powered sales chatbots

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

**AI Sales Agent SDK** is a production-ready JavaScript SDK that enables developers to integrate intelligent conversational commerce capabilities into any e-commerce platform, POS system, or custom application.

## ✨ Features

- 🛍️ **Conversational Commerce Engine** - Browse, cart, checkout via natural language
- 🔌 **Adapter Pattern** - Plug into any backend (WooCommerce, Shopify, Odoo, custom APIs)
- 🤖 **LLM Provider Interface** - Ollama provider included; OpenAI/Claude adapters are planned; custom models supported
- 🎯 **Intent Detection** - Automatically understands user intent and extracts entities
- 💾 **Flexible Session Storage** - In-memory (dev) or Redis (production)
- 🛡️ **Production-Ready** - Rate limiting, error handling, structured logging built-in
- 🚀 **Framework-Agnostic** - No Express/Fastify/Koa dependency
- 📦 **Zero Config** - Works out of the box with SQLite reference implementation

---

## 📦 Installation

### Option 1: Clone from GitHub

```bash
git clone https://github.com/mmad2021/ai-sales-agent-sdk.git
cd ai-sales-agent-sdk
npm install
```

### Option 2: Add to your project

```bash
npm install ai-sales-agent-sdk
```

---

## 🚀 Quick Start

### Run the Example

```bash
npm run example:basic
```

This runs a complete demo showing:
- Product browsing
- Adding items to cart
- Viewing cart
- Checkout flow

### Basic Usage

```javascript
import {
  AISalesAgent,
  OllamaProvider,
  MemorySessionStore,
  SQLiteProductAdapter,
  SQLiteOrderAdapter,
  SQLiteCustomerAdapter,
  SQLitePaymentAdapter,
  SQLiteClient
} from './src/index.js';

// 1. Setup database (SQLite example)
const dbClient = new SQLiteClient({ dbPath: ':memory:' });
await dbClient.getDB();

// 2. Configure adapters
const adapters = {
  products: new SQLiteProductAdapter({ client: dbClient }),
  orders: new SQLiteOrderAdapter({ client: dbClient }),
  customers: new SQLiteCustomerAdapter({ client: dbClient }),
  payments: new SQLitePaymentAdapter({ client: dbClient })
};

// 3. Choose LLM provider
const llm = new OllamaProvider({
  baseUrl: 'http://localhost:11434',
  model: 'qwen2.5-coder:14b'
});

// 4. Setup session storage
const sessionStore = new MemorySessionStore();

// 5. Create agent
const agent = new AISalesAgent({
  llm,
  sessionStore,
  adapters
});

// 6. Process messages
const response = await agent.chat('user123', 'Show me black t-shirts under $30');

console.log(response.text);  // Natural language response
console.log(response.data);  // Structured data (products, cart, etc.)
```

---

## 🏗️ Architecture

### Core Components

| Component | Purpose |
|-----------|---------|
| **Agent** | Main orchestrator - coordinates all operations |
| **IntentDetector** | Analyzes messages, extracts intent + entities |
| **ResponseGenerator** | Creates natural language responses |
| **ActionExecutor** | Executes business actions (add_to_cart, checkout) |
| **ContextManager** | Manages conversation context and state |

### Adapters

Implement these interfaces to connect your backend:

```javascript
// Product operations
class ProductAdapter {
  async searchProducts(query, filters) { /* ... */ }
  async getProduct(productId) { /* ... */ }
  async checkAvailability(productId, quantity) { /* ... */ }
}

// Order management
class OrderAdapter {
  async createOrder(orderData) { /* ... */ }
  async getOrder(orderId) { /* ... */ }
  async getCustomerOrders(customerId) { /* ... */ }
}

// Customer data
class CustomerAdapter {
  async getCustomer(customerId) { /* ... */ }
  async getOrCreateCustomer(identifier) { /* ... */ }
}

// Payment processing
class PaymentAdapter {
  async createPayment(paymentData) { /* ... */ }
  async verifyPayment(paymentId) { /* ... */ }
  async processReceipt(orderId, receiptUrl, verification) { /* ... */ }
}
```

**Reference implementations included:**
- ✅ SQLite adapters (use as-is or as reference)
- 🔜 WooCommerce adapters (coming soon)
- 🔜 Shopify adapters (coming soon)

### LLM Providers

Current support:

```javascript
// Local models (Ollama)
const llm = new OllamaProvider({ 
  baseUrl: 'http://localhost:11434',
  model: 'qwen2.5-coder:14b' 
});

// OpenAI (planned - currently throws not implemented)
const llm = new OpenAIProvider({ 
  apiKey: 'sk-...',
  model: 'gpt-4' 
});

// Claude (planned - currently throws not implemented)
const llm = new ClaudeProvider({ 
  apiKey: 'sk-ant-...',
  model: 'claude-3-sonnet' 
});

// Or implement your own
class CustomLLMProvider extends LLMProvider {
  async complete(prompt) { /* ... */ }
  async completeJSON(prompt) { /* ... */ }
}
```

---

## 📚 Detailed Usage

### 1. Using with WooCommerce (custom adapter)

```javascript
import axios from 'axios';
import { ProductAdapter } from './src/adapters/base/index.js';

class WooCommerceProductAdapter extends ProductAdapter {
  constructor({ siteUrl, consumerKey, consumerSecret }) {
    super();
    this.api = axios.create({
      baseURL: `${siteUrl}/wp-json/wc/v3`,
      auth: { username: consumerKey, password: consumerSecret }
    });
  }

  async searchProducts(query, filters = {}) {
    const params = {};
    if (filters.category) params.category = filters.category;
    if (filters.maxPrice) params.max_price = filters.maxPrice;
    if (query) params.search = query;

    const response = await this.api.get('/products', { params });
    return response.data.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: parseFloat(p.price),
      stock: p.stock_quantity,
      category: p.categories[0]?.name,
      image: p.images[0]?.src
    }));
  }

  async getProduct(id) {
    const response = await this.api.get(`/products/${id}`);
    const p = response.data;
    return {
      id: p.id,
      name: p.name,
      price: parseFloat(p.price),
      stock: p.stock_quantity
    };
  }

  async checkAvailability(productId, quantity) {
    const product = await this.getProduct(productId);
    const stock = product.stock || 0;
    return { available: stock >= quantity, stock };
  }
}

// Use it
const products = new WooCommerceProductAdapter({
  siteUrl: 'https://your-store.com',
  consumerKey: 'ck_...',
  consumerSecret: 'cs_...'
});

const agent = new AISalesAgent({ llm, adapters: { products }, /* ... */ });
```

### 2. Using with Redis Sessions (production)

```javascript
import { RedisSessionStore } from './src/session/index.js';

const sessionStore = new RedisSessionStore({
  url: 'redis://localhost:6379',
  prefix: 'sales-agent:session:',
  defaultTTL: 3600
});

const agent = new AISalesAgent({
  sessionStore,
  // ... other config
});
```

### 3. Using Middleware

```javascript
import { RateLimiter, Logger, ErrorHandler } from './src/middleware/index.js';

// Rate limiting (10 requests per minute per user)
const rateLimiter = new RateLimiter({ 
  maxRequests: 10, 
  windowMs: 60000 
});

// Structured logging
const logger = new Logger({ level: 'info' });

// Error recovery
const errorHandler = new ErrorHandler({ 
  onError: async (error, ctx) => {
    console.error('Agent error:', error.message, { sessionId: ctx.sessionId });
  }
});

// Apply to agent
const agent = new AISalesAgent({
  middleware: [rateLimiter, logger, errorHandler],
  // ... other config
});
```

### 4. Handling Responses

```javascript
const response = await agent.chat('user123', 'Add black t-shirt to cart');

console.log(response);
// {
//   text: "I've added the black t-shirt to your cart.",
//   intent: 'add_to_cart',
//   confidence: 0.93,
//   entities: { product_type: 't-shirt', color: 'black' },
//   actions: {
//     addedToCart: true,
//     removedFromCart: false,
//     proceedToCheckout: false
//   }
//   data: { ... },
//   session: { cart: { items: [...] }, customer: null, context: {} }
// }
```

---

## 🎯 Use Cases

### E-commerce Chatbots
- WhatsApp Shopping for online stores
- Telegram product catalog bot
- Web chat widget for product discovery

### Point of Sale (POS)
- In-store kiosk with voice/chat interface
- Mobile sales assistant app
- Inventory lookup tool

### Custom Integrations
- Internal sales tools
- B2B order management
- Multi-channel commerce (web + messaging apps)

### Rapid Prototyping
- Build conversational commerce MVP in hours
- Test AI sales flows before full integration
- Demo to stakeholders

---

## 📁 Project Structure

```
ai-sales-agent-sdk/
├── src/
│   ├── core/                    # Core engine
│   │   ├── Agent.js             # Main orchestrator
│   │   ├── IntentDetector.js    # Intent classification
│   │   ├── ResponseGenerator.js # Natural language generation
│   │   ├── ActionExecutor.js    # Business logic executor
│   │   └── ContextManager.js    # Conversation context
│   │
│   ├── adapters/
│   │   ├── base/                # Base interfaces
│   │   │   ├── ProductAdapter.js
│   │   │   ├── OrderAdapter.js
│   │   │   ├── CustomerAdapter.js
│   │   │   └── PaymentAdapter.js
│   │   └── implementations/     # SQLite reference
│   │       ├── SQLiteProductAdapter.js
│   │       ├── SQLiteOrderAdapter.js
│   │       ├── SQLiteCustomerAdapter.js
│   │       ├── SQLitePaymentAdapter.js
│   │       └── SQLiteClient.js
│   │
│   ├── llm/
│   │   ├── base/
│   │   │   └── LLMProvider.js   # Base LLM interface
│   │   └── providers/
│   │       ├── OllamaProvider.js
│   │       ├── OpenAIProvider.js
│   │       └── ClaudeProvider.js
│   │
│   ├── session/
│   │   ├── SessionStore.js      # Base interface
│   │   ├── MemorySessionStore.js
│   │   └── RedisSessionStore.js
│   │
│   └── middleware/
│       ├── RateLimiter.js
│       ├── Logger.js
│       └── ErrorHandler.js
│
├── examples/
│   └── 01-basic-usage/
│       └── index.js             # Working demo
│
├── package.json
├── LICENSE
└── README.md
```

---

## 🔧 Configuration

### Agent Options

```javascript
const agent = new AISalesAgent({
  // Required
  llm: new OllamaProvider({ /* ... */ }),
  sessionStore: new MemorySessionStore(),
  adapters: {
    products: new SQLiteProductAdapter(/* ... */),
    orders: new SQLiteOrderAdapter(/* ... */),
    customers: new SQLiteCustomerAdapter(/* ... */),
    payments: new SQLitePaymentAdapter(/* ... */)
  },

  // Optional
  middleware: [rateLimiter, logger, errorHandler],
  
  // Configuration options
  config: {
    conversation: {
      maxHistoryLength: 20,
      sessionTTL: 3600,
      greetingMessage: 'Welcome!'
    },
    llm: {
      temperature: 0.7,
      maxTokens: 500,
      systemPrompt: 'You are a helpful sales assistant.'
    },
    business: {
      name: 'Store',
      description: 'Online store',
      currency: 'USD'
    },

    // Payment receipt verification (vision LLM)
    payments: {
      autoApproveThreshold: 0.85,
      autoRejectThreshold: 0.35,
      visionPrompt: 'Assess whether this image is a valid payment receipt for the provided order details.'
    }
  }
});
```

### 5. Image Upload Receipt Verification (Vision LLM)

```javascript
const response = await agent.chat(
  'session-user-001',
  'I uploaded my payment receipt',
  {
    orderId: 1,
    receiptUrl: '/absolute/path/to/receipt.jpg'
    // you can also pass imageUrl instead of receiptUrl
  }
);

console.log(response.data);
// {
//   orderId: 1,
//   receiptUrl: '/absolute/path/to/receipt.jpg',
//   decision: 'approved' | 'rejected' | 'pending',
//   confidence: 0.91,
//   paymentStatus: 'paid' | 'verification_rejected' | 'pending_verification',
//   verified: true | false,
//   reason: '...'
// }
```

Intent `submit_payment_receipt` is now supported and the SDK runs:
1. Image analysis with `llm.analyzeImage(...)`
2. Confidence scoring (0..1)
3. Automatic decision via thresholds (`approved` / `rejected` / `pending`)
4. Payment status update in `orders` + audit record in `payment_verifications`

---

## 🧪 Testing

```bash
# Current baseline checks
npm run check
npm test
npm run example:basic

# Optional: watch mode for local test development
npm run test:watch
```

---

## 🛠️ Development

### Running Examples Locally

```bash
# Basic usage example
npm run example:basic
```

### Building Custom Adapters

1. Extend the base adapter class
2. Implement required methods
3. Handle errors appropriately
4. Return data in expected format

See `src/adapters/implementations/` for reference implementations.

---

## 📋 Requirements

- **Node.js:** >= 18.0.0
- **Dependencies:** 
  - `redis` (^4.6.12) - only if using RedisSessionStore
  - `sql.js` (^1.14.0) - only if using SQLite adapters

---

## 🗺️ Roadmap

### Phase 1: Core SDK ✅ (Complete)
- [x] Core conversational engine
- [x] Adapter pattern
- [x] LLM provider interface + Ollama implementation
- [x] Session management
- [x] Middleware stack
- [x] SQLite reference implementations
- [x] Basic example

### Phase 2: Enhancements (In Progress)
- [ ] Vision support (image product search)
- [ ] Sentiment analysis
- [ ] Multi-language support
- [ ] Conversation summarization

### Phase 3: Real-World Integrations
- [ ] WooCommerce adapters
- [ ] Shopify adapters
- [ ] Odoo ERP adapters
- [ ] WhatsApp Business API connector
- [ ] Telegram Bot API connector

### Phase 4: Testing & Documentation
- [ ] Unit tests (Jest)
- [ ] Integration tests
- [ ] API documentation (JSDoc)
- [ ] Tutorial videos

### Phase 5: Distribution
- [ ] Publish to npm
- [ ] CDN version
- [ ] Docker images

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Credits

**Architecture:** Adapter pattern, Dependency Injection, Interface Segregation  
**Implementation:** Automated extraction with GPT-5.3 Codex  
**Original Project:** [ai-sales-agent](https://github.com/mmad2021/ai-sales-agent)

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/mmad2021/ai-sales-agent-sdk/issues)
- **Discussions:** [GitHub Discussions](https://github.com/mmad2021/ai-sales-agent-sdk/discussions)
- **Email:** mmad2021@users.noreply.github.com

---

## 🌟 Star History

If you find this project useful, please consider giving it a star! ⭐

---

**Built with ❤️ for the conversational commerce community**
