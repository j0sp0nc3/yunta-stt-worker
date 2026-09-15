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
          model: "@cf/openai/whisper",
          version: "1.0.0",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // OpenAI-compatible audio transcription endpoint
    if (url.pathname !== "/v1/audio/transcriptions" || request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: { message: "Endpoint not found or invalid method", type: "invalid_request_error" } }),
        { status: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
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
      // 3006 = Workers AI "Request is too large": el formato de entrada
      // audio:[...Uint8Array] (array JSON de números) infla el payload ~4-5x
      // y Workers AI lo rechaza. El cliente debe fragmentar el audio y
      // reintentar (ver https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-workers-ai-whisper-with-chunking/).
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
  },
};
