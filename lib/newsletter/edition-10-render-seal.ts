// Fixed QA input used by the human-approved previews and canonical render hashes.
// Production delivery supplies its own recipient-specific unsubscribe URL.
export const NEWSLETTER_EDITION_10_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition10-preview-token-fixture-000000000000";

export const NEWSLETTER_EDITION_10_CANONICAL_RENDER_SHA256 = {
  national: {
    html: "76b6f7e4d3464c579bfcb1d38acd2a3a7bd118f46fd46d46af0fd169e6e2bb06",
    text: "eb56edd3dc301d0f1a462c1969d1214570a83346c21996fc698bb07c13e3901d",
  },
  madrid: {
    html: "2d4d0c989c8ddf7f4d2cdb893864c1f0e5ae1b6230cc7e20d3eba7672cc7891d",
    text: "4387c43c4426099a3979aaddb201233bbfb8eae499198e538a80b7c946ea7289",
  },
} as const;
