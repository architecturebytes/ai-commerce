import { NovaSonicBidirectionalStreamClient } from "./client";

let sessionId: string;
let session: any; // Store session reference globally
let bedrockClient: NovaSonicBidirectionalStreamClient | null = null;

const target = new EventTarget();

// --- IMPORTANT ---
// This function uses hardcoded credentials as requested for this proof-of-concept.
// In a production environment, NEVER hardcode credentials in your frontend code.
// Use a secure authentication method like Amazon Cognito to vend temporary credentials.
const getCredentials = () => {
  const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
  const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;
  const sessionToken = import.meta.env.VITE_AWS_SESSION_TOKEN; // Optional: If using temporary credentials

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken,
  };
};

const getOrCreateClient = () => {
  const credentials = getCredentials();
  
  if (!credentials.accessKeyId || !credentials.secretAccessKey) {
    throw new Error("AWS credentials are not configured. Please add them to src/lib/sdk/events_proxy.ts");
  }
  
  // Always create a new client to ensure fresh credentials are used if they change.
  console.log("Creating new Bedrock client.");
  bedrockClient = new NovaSonicBidirectionalStreamClient({
    credentials,
    region: "us-east-1", // Or your desired region
  });
  
  return bedrockClient;
};

target.addEventListener('createSession', () => {
  try {
    const client = getOrCreateClient();
    session = client.createStreamSession();
    sessionId = session.getSessionId();

    target.dispatchEvent(new CustomEvent("sessionCreated", { detail: sessionId }));

    // Set up event handlers for the new session
    session.onEvent("contentStart", (data: any) => target.dispatchEvent(new CustomEvent("contentStart", { detail: data })));
    session.onEvent("textOutput", (data: any) => target.dispatchEvent(new CustomEvent("textOutput", { detail: data })));
    session.onEvent("audioOutput", (data: any) => target.dispatchEvent(new CustomEvent("audioOutput", { detail: data })));
    session.onEvent("error", (data: any) => target.dispatchEvent(new CustomEvent("error", { detail: data })));
    session.onEvent("modelTimedOut", (data: any) => target.dispatchEvent(new CustomEvent("modelTimedOut", { detail: data })));
    session.onEvent("toolUse", (data: any) => target.dispatchEvent(new CustomEvent("toolUse", { detail: data })));
    session.onEvent("toolResult", (data: any) => target.dispatchEvent(new CustomEvent("toolResult", { detail: data })));
    session.onEvent("contentEnd", (data: any) => target.dispatchEvent(new CustomEvent("contentEnd", { detail: data })));
    session.onEvent("streamComplete", () => target.dispatchEvent(new Event("streamComplete")));

  } catch (error) {
    console.error("Error creating session:", error);
    target.dispatchEvent(new CustomEvent("error", { detail: { message: "Error creating session", details: (error as Error).message } }));
  }
});

target.addEventListener("initiateSession", async (e: Event) => {
  try {
    const { sessionId, tools } = (e as CustomEvent).detail;
    if (!bedrockClient) throw new Error("Bedrock client not initialized");

    if (Array.isArray(tools) && tools.length > 0) {
      console.log(`Registering ${tools.length} tools...`);
      for (const tool of tools) {
        bedrockClient.setTool(tool.toolname, tool.definition, tool.action);
      }
    }

    bedrockClient.initiateSession(sessionId);
    target.dispatchEvent(new Event("sessionInitiated"));
  } catch (e) {
    console.error("Error initiating session:", e);
    target.dispatchEvent(new CustomEvent("error", { detail: { message: "Error initiating session", details: (e as Error).message } }));
  }
});

target.addEventListener("audioInput", async (e) => {
  if (!session) return;
  const audioData = (e as CustomEvent).detail;
  try {
    const audioBuffer = typeof audioData === "string" ? Uint8Array.from(atob(audioData), c => c.charCodeAt(0)) : new TextEncoder().encode(audioData);
    await session.streamAudio(audioBuffer);
  } catch (error) {
    console.error("Error processing audio:", error);
    target.dispatchEvent(new CustomEvent("error", { detail: { message: "Error processing audio", details: (error as Error).message } }));
  }
});

target.addEventListener("promptStart", async () => {
  if (session) await session.setupPromptStart();
});

target.addEventListener("systemPrompt", async (e) => {
  if (session) await session.setupSystemPrompt(undefined, (e as CustomEvent).detail);
});

target.addEventListener("audioStart", async () => {
  if (session) await session.setupStartAudio();
});

target.addEventListener("stopAudio", async (e: Event) => {
  const detail = (e as CustomEvent).detail;
  const sessionIdToClose = detail?.sessionId;

  if (!bedrockClient) {
    console.error("stopAudio called but Bedrock client is not initialized.");
    return;
  }
  if (!sessionIdToClose) {
    console.error("stopAudio event fired without a sessionId.");
    return;
  }

  try {
    // Close the specific session requested
    console.log(`[Proxy] Received stopAudio for session: ${sessionIdToClose}. Closing...`);
    await bedrockClient.closeSession(sessionIdToClose);
  } catch (error) {
    console.error(`[Proxy] Error closing session ${sessionIdToClose}:`, error);
  }
});

export { target };