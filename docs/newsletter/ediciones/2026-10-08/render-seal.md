# Edition 10 canonical render seal

The human-approved previews use this fixed, synthetic unsubscribe URL:

`https://www.eventomotor.com/newsletter/unsubscribe?token=edition10-preview-token-fixture-000000000000`

It is versioned in `lib/newsletter/edition-10-render-seal.ts` and shared by the preview generator and protected test sender. It is not a subscriber token. The production renderer continues to receive each recipient's unsubscribe URL as an input.

SHA-256 is calculated over UTF-8 after replacing CRLF and CR with LF. No trimming is applied.

Reproduce the seal with `node --conditions=react-server --import tsx scripts/check-newsletter-edition-10-render-seal.ts` from the Edition 10 worktree. The checker reads local files only and does not call a provider or database.

| Variant | HTML SHA-256 | Text SHA-256 |
| --- | --- | --- |
| national | `76b6f7e4d3464c579bfcb1d38acd2a3a7bd118f46fd46d46af0fd169e6e2bb06` | `eb56edd3dc301d0f1a462c1969d1214570a83346c21996fc698bb07c13e3901d` |
| madrid | `2d4d0c989c8ddf7f4d2cdb893864c1f0e5ae1b6230cc7e20d3eba7672cc7891d` | `4387c43c4426099a3979aaddb201233bbfb8eae499198e538a80b7c946ea7289` |

The previously reported four render hashes lacked a recorded unsubscribe URL and are not reproducible seal metadata. Source HTML, source text, content manifest, asset manifest, and header hashes are unchanged. The canonical render test checks both saved QA previews against the current renderer after canonical line-ending normalization; the only transformation between sent HTML and preview HTML is replacing the public image origin with the local `assets/` prefix.
