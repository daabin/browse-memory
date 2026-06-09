import { describe, expect, it, vi } from "vitest";

import { OpenAIRequestError } from "@/ai/openai-client";
import { createMessageHandler } from "@/background/message-handler";
import type { BrowseMemoryApplication } from "@/background/application";

describe("createMessageHandler", () => {
  it("delegates successful requests to the application", async () => {
    const application = {
      handle: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as BrowseMemoryApplication;
    const handler = createMessageHandler(application);

    const response = await handler({ type: "CLEAR_ALL_DATA" });

    expect(response).toEqual({ ok: true });
    expect(application.handle).toHaveBeenCalledWith({ type: "CLEAR_ALL_DATA" });
  });

  it("maps OpenAIRequestError to an error response", async () => {
    const application = {
      handle: vi.fn().mockRejectedValue(
        new OpenAIRequestError("authentication", "API Key 无效。"),
      ),
    } as unknown as BrowseMemoryApplication;
    const handler = createMessageHandler(application);

    const response = await handler({ type: "ASK", question: "test", online: true });

    expect(response).toEqual({
      ok: false,
      code: "authentication",
      message: "API Key 无效。",
    });
  });

  it("maps unexpected errors to a generic error response", async () => {
    const application = {
      handle: vi.fn().mockRejectedValue(new Error("boom")),
    } as unknown as BrowseMemoryApplication;
    const handler = createMessageHandler(application);

    const response = await handler({ type: "GET_SETTINGS" });

    expect(response).toEqual({
      ok: false,
      code: "unexpected",
      message: "BrowseMemory 暂时无法完成该操作。",
    });
  });
});
