# aiCommerce: A Voice-First E-commerce Experience

YouTube Ref: https://www.youtube.com/watch?v=68K4A1zP8TM

This project is a proof-of-concept web application that demonstrates a voice-driven, conversational e-commerce experience. Users can interact with the application entirely through natural speech to find products, add them to a shopping cart, and check out.

The application is built with React and TypeScript and uses the AWS SDK for JavaScript to communicate with Amazon Bedrock and the Nova Sonic system for a real-time, speech-to-speech interaction.

## Features

- **Conversational AI:** Engage in a natural, spoken dialogue to navigate the application.
- **Voice-Powered Actions:** Use voice commands to perform key e-commerce actions:
  - Find products by category.
  - Add items to the shopping cart.
  - Complete the checkout process.
- **Tool-Enabled AI:** The AI model uses a "tool use" approach to interact with the application's features, making the architecture scalable and robust.
- **Real-time Audio Streaming:** A bidirectional stream handles audio input and output for a fluid, low-latency conversation.

## Getting Started

### Prerequisites

- Node.js and npm installed on your system.
- An AWS account with access to Amazon Bedrock.

### Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/ai-commerce.git
    cd ai-commerce
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure AWS Credentials:**
    Create a file named `.env` in the root of the project directory and add your AWS credentials. This file is ignored by Git and will not be checked into the repository.

    ```
    VITE_AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
    VITE_AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY
    # VITE_AWS_SESSION_TOKEN=YOUR_SESSION_TOKEN # <-- Optional: only if using temporary credentials
    ```

### Running the Application

-   **For development (with hot-reloading):**
    ```bash
    npm run dev
    ```
    This will start the Vite development server, typically at `http://localhost:5173`.

-   **To create a production build:**
    ```bash
    npm run build
    ```
    This will create an optimized version of the application in the `dist/` directory, which is ready for deployment.

-   **To preview the production build locally:**
    ```bash
    npm run preview
    ```

---
