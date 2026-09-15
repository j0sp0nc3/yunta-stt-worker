export interface Env {
  AI: any;
  API_SECRET?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handling CORS Pre-flight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "yunta-stt-worker",
          stt_model: "@cf/openai/whisper",
          tts_model: "@cf/meta/mms-tts-spa",
          version: "1.1.0",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Optional Bearer Token Authentication
    if (env.API_SECRET) {
      const auth = request.headers.get("Authorization");
      if (!auth || auth !== `Bearer ${env.API_SECRET}`) {
        return new Response(
          JSON.stringify({ error: { message: "Unauthorized", type: "authentication_error" } }),
          { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
    }

    // 1. OpenAI-compatible Audio Text-to-Speech (TTS) Endpoint
    if (url.pathname === "/v1/audio/speech" && request.method === "POST") {
      try {
        const body = (await request.json()) as any;
        const text = body.input || body.text || "";
        const model = body.model || "@cf/meta/mms-tts-spa";

        if (!text || !text.trim()) {
          return new Response(
            JSON.stringify({ error: { message: "No text provided in 'input' parameter", type: "invalid_request_error" } }),
            { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
          );
        }

        const audioResponse = await env.AI.run(model, { text: text.trim() });
        return new Response(audioResponse, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: { message: err?.message || "TTS generation failed", type: "api_error" } }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
    }

    // 2. OpenAI-compatible Audio Speech-to-Text (STT) Endpoint
    if (url.pathname === "/v1/audio/transcriptions" && request.method === "POST") {
      try {
        const contentType = request.headers.get("Content-Type") || "";
        let audioArray: number[] | null = null;

        if (contentType.includes("multipart/form-data")) {
          const formData = await request.formData();
          const file = formData.get("file") as File | null;

          if (!file) {
            return new Response(
              JSON.stringify({ error: { message: "No audio file found in 'file' parameter", type: "invalid_request_error" } }),
              { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
          }

          const buffer = await file.arrayBuffer();
          audioArray = [...new Uint8Array(buffer)];
        } else {
          // Direct raw binary stream fallback
          const buffer = await request.arrayBuffer();
          audioArray = [...new Uint8Array(buffer)];
        }

        if (!audioArray || audioArray.length === 0) {
          return new Response(
            JSON.stringify({ error: { message: "Empty audio payload received", type: "invalid_request_error" } }),
            { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
          );
        }

        // Execute Cloudflare Workers AI OpenAI Whisper Large V3
        const input = { audio: audioArray };
        const response = await env.AI.run("@cf/openai/whisper", input);

        return new Response(
          JSON.stringify({
            text: response.text || "",
            vtt: response.vtt || null,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      } catch (err: any) {
        const msg: string = err?.message || "Internal server error";
        const tooLarge = msg.includes("3006") || msg.toLowerCase().includes("too large");
        return new Response(
          JSON.stringify({
            error: {
              message: tooLarge
                ? "Audio payload too large for Workers AI (input array inflates ~4-5x). Split the audio into smaller chunks (~1-2 MB) and retry."
                : msg,
              code: tooLarge ? 3006 : undefined,
              type: tooLarge ? "request_too_large" : "api_error",
            },
          }),
          {
            status: tooLarge ? 413 : 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: { message: "Endpoint not found or invalid method", type: "invalid_request_error" } }),
      { status: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  },
};
