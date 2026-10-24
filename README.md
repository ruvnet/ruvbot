# ruvBot v0.01c

Created by [@rUv](https://github.com/ruvnet)

`ruvBot` is an advanced AI-powered chatbot based on the LlamaIndex framework, enhanced with Next.js for web application development. It's designed to interact intelligently with users, providing information and assistance across various domains.

## Key Features

- **Streaming Output**: Delivers real-time responses from the AI, enhancing user interaction.
- **Chat Memory**: Maintains conversation context across sessions, allowing for more meaningful and continuous interactions.
- **OpenAI Assistants API**: Leverages the power of OpenAI's language models for high-quality, context-aware responses.
- **Custom Knowledge Base**: Users can upload their own knowledge files to `/data` directory, allowing ruvBot to provide specialized information.
- **Versatile Applications**: Ideal for knowledge management, customer support, educational assistance, and more.

## Potential Uses

- **Knowledge Management**: Helps in organizing and retrieving information efficiently.
- **Customer Support**: Provides automated, yet personalized, responses to customer queries.
- **Educational Tool**: Assists in learning and tutoring across various subjects.
- **Content Exploration**: Aids in navigating through large documents or datasets, offering insights and summaries.

## Getting Started

### Prerequisites

- Node.js
- Access to a key-value store for chat history (e.g., Replit Database).
- OpenAI API Key (GPT-3).

### Installation

Clone the repository and install dependencies:
```bash
git clone https://github.com/ruvnet/ruvbot
cd ruvBot
npm install
```

### Configuration

1. Set up environment variables for database access and OpenAI API key.
2. Upload documents to `/data` to customize the bot's knowledge base.

### Running the Bot

Start the ruvbot
```bash
./run.sh
```

Access the bot at [http://localhost:3000](http://localhost:3000).

## Customization

Modify the welcome message and internal prompts to tailor the bot's interaction style and responses:

- **Welcome Message**: Edit `/components/ui/chat-section.tsx`.
- **Internal Prompts**: Adjust in `route.ts`.

## About LlamaIndex

LlamaIndex is an innovative framework designed to streamline the integration of AI models into applications. It simplifies the process of connecting with AI services like OpenAI, providing a seamless development experience for creating AI-powered applications.

## Contributions

We welcome your feedback and contributions. Enhance ruvBot by submitting issues and pull requests on our [GitHub repository](https://github.com/ruvnet/ruvbot).
## Proactive runtime (opt-in)

The new [`@ruvbot/proactive`](packages/proactive/README.md) package adds bounded event triage, approval-bound preparation, replay tests, MetaHarness npm connector validation and a real WASM promotion predicate. Start with `npm --prefix packages/proactive ci --ignore-scripts`, then `npm --prefix packages/proactive test` and `npm --prefix packages/proactive run demo`.

This is a single-process reference runtime in shadow mode, alongside the existing chatbot. Production hosting, durable state and authenticated approvals are separate integration work. See [ADR 001](docs/adr/001-proactive-two-loop-runtime.md) and [ADR 002](docs/adr/002-metaharness-npm-wasm-learning.md).
