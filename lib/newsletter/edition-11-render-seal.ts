// Fixed QA input used by the human-approved previews and canonical render hashes.
// Production delivery supplies its own recipient-specific unsubscribe URL.
export const NEWSLETTER_EDITION_11_CANONICAL_SYNTHETIC_UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition11-preview-token-fixture-000000000000";

export const NEWSLETTER_EDITION_11_CANONICAL_RENDER_SHA256 = {
  national: {
    html: "d74435732160188bf26933f8c08b7559cda0d5b4ca2c4c9e0805b8d0d55c01b7",
    text: "90caa7eda320621bd88aeb4b6041868680932e31891cbeed3140a2e4973bfc37",
  },
  madrid: {
    html: "98de86540ee2b9e3dc7ebc0344b8da929501483d87a6fba7a2337ff9239b337a",
    text: "0361b002164f95fc9877f3caae553ab5b724e15276765567b957e8d74caac476",
  },
} as const;
