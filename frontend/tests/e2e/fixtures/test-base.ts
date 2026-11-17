import { test as baseTest, expect } from "@playwright/test";
import { MockServer } from "../helpers/mock-server";
import { MockStateStore } from "../helpers/mock-store";

export type TestFixtures = {
  mockServer: MockServer;
  mockStore: MockStateStore;
};

/**
 * Fixture base customizada para os testes E2E do Extensão Estoque (FT-23)
 * Inicializa automaticamente o mockServer com estado limpo e isolado por teste.
 */
export const test = baseTest.extend<TestFixtures>({
  mockStore: async ({}, use) => {
    const store = new MockStateStore();
    await use(store);
  },

  mockServer: async ({ page, mockStore }, use) => {
    const server = new MockServer(mockStore);
    if (process.env.PLAYWRIGHT_API_MOCK !== "false") {
      await server.setup(page);
    }
    await use(server);
  },
});

export { expect };
