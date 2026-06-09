import { OpenAIRequestError } from "@/ai/openai-client";
import type { RuntimeRequest, RuntimeResponse } from "@/shared/messages";

import type { BrowseMemoryApplication } from "./application";

export function createMessageHandler(application: BrowseMemoryApplication) {
  return async (request: RuntimeRequest): Promise<RuntimeResponse> => {
    try {
      return await application.handle(request);
    } catch (error) {
      if (error instanceof OpenAIRequestError) {
        return { ok: false, code: error.code, message: error.message };
      }
      return {
        ok: false,
        code: "unexpected",
        message: "BrowseMemory 暂时无法完成该操作。",
      };
    }
  };
}
