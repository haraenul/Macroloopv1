# Fonts

Self-hosted (previously loaded from Google Fonts' CDN via a render-blocking
`@import`, which was also unreliable under privacy-hardened mobile browsers).

All four families are licensed under the SIL Open Font License 1.1 — free to
bundle, redistribute, and modify. Files are sourced from [Fontsource](https://fontsource.org/),
which repackages Google Fonts for self-hosting.

- **Syne** — display/headline weights (600, 700, 800)
- **Manrope** — body/UI text (400, 500, 600, 700, 800)
- **Space Mono** — numeric and monospace accents (400, 700)
- **Noto Sans Arabic** — Arabic-script UI (400, 600, 700)

Only the weights actually referenced in `css/styles.css`, `js/flex-card.js`,
and `js/charts.js` are included, to keep the payload lean (~330KB total).
