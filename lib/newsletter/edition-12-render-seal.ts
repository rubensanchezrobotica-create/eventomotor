// Fixed QA input used by the human-approved previews and canonical render hashes.
// Production delivery supplies its own recipient-specific unsubscribe URL.
export const NEWSLETTER_EDITION_12_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition12-preview-token-fixture-000000000000";

export const NEWSLETTER_EDITION_12_CANONICAL_RENDER_SHA256 = {
  national: {
    html: "dfadbdffb6fc17d47eae32e2b50f2275bf5b9cdc2741935c1172693eafbc9f66",
    text: "56f5f89e3cb9c1f893b1c1b3df3f6e0ea8d8271c1df02c45413b60e1346577fb",
  },
  madrid: {
    html: "884c8d3cb8f949d3e6c1a15b23f802f2ad510fd0418108f78818f3000a10a5e2",
    text: "9009bbc2395a9eba3c22a300323cce11afe7b3187f743c0fc2e5a3b404555138",
  },
} as const;
