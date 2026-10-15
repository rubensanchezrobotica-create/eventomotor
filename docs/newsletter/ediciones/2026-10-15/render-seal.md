# Edition 11 — reproducible render seal

Campaign key: `agenda_motor_2026_10_15`

The canonical synthetic unsubscribe URL is fixed and versioned for previews and QA only:

`https://www.eventomotor.com/newsletter/unsubscribe?token=edition11-preview-token-fixture-000000000000`

| Variant | HTML SHA-256 | Text SHA-256 |
| --- | --- | --- |
| national | `d74435732160188bf26933f8c08b7559cda0d5b4ca2c4c9e0805b8d0d55c01b7` | `90caa7eda320621bd88aeb4b6041868680932e31891cbeed3140a2e4973bfc37` |
| madrid | `98de86540ee2b9e3dc7ebc0344b8da929501483d87a6fba7a2337ff9239b337a` | `0361b002164f95fc9877f3caae553ab5b724e15276765567b957e8d74caac476` |

Run `node --conditions=react-server --import tsx scripts/check-newsletter-edition-11-render-seal.ts` from this worktree. Two consecutive executions yielded identical four hashes and both saved previews matched the renderer.

Production delivery must replace the synthetic fixture with a recipient-specific unsubscribe URL; this file is not send authorization.
