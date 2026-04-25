export const queryKeys = {
  // Legacy wallet-keyed keys (kept during the migration window).
  wallet: (walletId: number) => ['wallet', walletId] as const,
  wallets: () => ['wallets'] as const,
  myWallet: () => ['my-wallet'] as const,
  walletCurrencies: (walletId: number | null) => ['wallet-currencies', walletId] as const,
  walletSpendItems: (walletId: number | null) =>
    ['wallet-spend-items', walletId] as const,
  roadmap: (walletId: number) => ['roadmap', walletId] as const,
  walletLatestResults: (walletId: number | null) =>
    ['wallet-latest-results', walletId] as const,
  walletCardCredits: (walletId: number | null, cardId: number | null) =>
    ['wallet-card-credits', walletId, cardId] as const,
  walletCategoryPriorities: (walletId: number | null) =>
    ['wallet-category-priorities', walletId] as const,
  walletPortalShares: (walletId: number | null) =>
    ['wallet-portal-shares', walletId] as const,

  // New canonical keys.
  myWalletWithScenarios: () => ['wallet-with-scenarios'] as const,
  ownedCardInstances: () => ['wallet-card-instances'] as const,
  walletSpendItemsSingular: () => ['wallet-spend-items-singular'] as const,
  scenarios: () => ['scenarios'] as const,
  scenario: (scenarioId: number | null) => ['scenario', scenarioId] as const,
  scenarioFutureCards: (scenarioId: number | null) =>
    ['scenario-future-cards', scenarioId] as const,
  scenarioOverlays: (scenarioId: number | null) =>
    ['scenario-overlays', scenarioId] as const,
  scenarioResults: (scenarioId: number | null) =>
    ['scenario-results', scenarioId] as const,
  scenarioLatestResults: (scenarioId: number | null) =>
    ['scenario-latest-results', scenarioId] as const,
  scenarioRoadmap: (scenarioId: number | null) =>
    ['scenario-roadmap', scenarioId] as const,
  scenarioCurrencies: (scenarioId: number | null) =>
    ['scenario-currencies', scenarioId] as const,
  scenarioCategoryPriorities: (scenarioId: number | null) =>
    ['scenario-category-priorities', scenarioId] as const,
  scenarioPortalShares: (scenarioId: number | null) =>
    ['scenario-portal-shares', scenarioId] as const,
  scenarioCardCredits: (scenarioId: number | null, instanceId: number | null) =>
    ['scenario-card-credits', scenarioId, instanceId] as const,

  // Reference data (unchanged).
  cards: () => ['cards'] as const,
  credits: () => ['credits'] as const,
  currencies: () => ['currencies'] as const,
  travelPortals: ['travel-portals'] as const,
  issuerApplicationRules: () => ['issuer-application-rules'] as const,
} as const
