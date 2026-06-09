import { OpenAICompatibleClient } from "@/ai/openai-client";
import { RagService } from "@/ai/rag-service";
import { SecretStore } from "@/security/secret-store";
import type {
  RuntimeRequest,
  RuntimeResponse,
} from "@/shared/messages";
import type { AppSettings } from "@/shared/types";
import type { BrowseMemoryDatabase } from "@/storage/database";
import { PageRepository } from "@/storage/page-repository";
import { SearchRepository } from "@/storage/search-repository";
import { SettingsRepository } from "@/storage/settings-repository";

type Fetcher = typeof fetch;

export class BrowseMemoryApplication {
  private readonly pages: PageRepository;
  private readonly search: SearchRepository;
  private readonly settings: SettingsRepository;
  private readonly secrets: SecretStore;
  private readonly client: OpenAICompatibleClient;
  private readonly rag: RagService;

  constructor(database: BrowseMemoryDatabase, fetcher: Fetcher = fetch) {
    this.pages = new PageRepository(database);
    this.search = new SearchRepository(database);
    this.settings = new SettingsRepository(database);
    this.secrets = new SecretStore(database);
    this.client = new OpenAICompatibleClient(fetcher);
    this.rag = new RagService(this.client);
  }

  async handle(request: RuntimeRequest): Promise<RuntimeResponse> {
    switch (request.type) {
      case "PAGE_CHANGED":
        return { ok: true };
      case "STORE_CAPTURE":
        await this.pages.upsertCapture(request.capture);
        return { ok: true };
      case "SEARCH":
        return { ok: true, results: await this.search.search(request.query) };
      case "GET_TODAY_SNAPSHOT":
        return { ok: true, snapshot: await this.pages.getTodaySnapshot() };
      case "GET_SETTINGS": {
        const settings = await this.settings.get();
        return {
          ok: true,
          settings: { ...settings, encryptedApiKey: undefined },
          hasApiKey: settings.encryptedApiKey !== undefined,
        };
      }
      case "SAVE_SETTINGS": {
        const updates: Partial<AppSettings> = { ...request.settings };
        if (request.apiKey?.trim()) {
          updates.encryptedApiKey = await this.secrets.encrypt(
            request.apiKey.trim(),
          );
        }
        await this.settings.save(updates);
        return { ok: true };
      }
      case "TEST_CONNECTION": {
        const settings = { ...(await this.settings.get()), ...request.settings };
        const apiKey =
          request.apiKey?.trim() ||
          (settings.encryptedApiKey
            ? await this.secrets.decrypt(settings.encryptedApiKey)
            : "");
        if (!apiKey) {
          return {
            ok: false,
            code: "missing_api_key",
            message: "请先填写 API Key。",
          };
        }
        await this.client.chat({
          baseUrl: settings.chatBaseUrl,
          apiKey,
          model: settings.chatModel,
          messages: [{ role: "user", content: "Reply with OK." }],
        });
        return { ok: true };
      }
      case "ASK": {
        const results = await this.search.search(request.question, 5);
        const settings = await this.settings.get();
        const apiKey = settings.encryptedApiKey
          ? await this.secrets.decrypt(settings.encryptedApiKey)
          : undefined;
        return {
          ok: true,
          answer: await this.rag.answer(
            request.question,
            results,
            apiKey
              ? {
                  baseUrl: settings.chatBaseUrl,
                  apiKey,
                  model: settings.chatModel,
                }
              : undefined,
            request.online,
          ),
        };
      }
      case "GET_STORAGE_USAGE": {
        const estimate = await navigator.storage?.estimate?.();
        return { ok: true, bytes: estimate?.usage ?? 0 };
      }
      case "CLEAR_ALL_DATA":
        await this.settings.clearAll();
        return { ok: true };
    }
  }
}
