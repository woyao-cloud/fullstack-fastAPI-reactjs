## commits ae54d89..19d4565
19d4565 feat(frontend): Next.js 16 + Tailwind + shadcn/ui 项目初始化

## stat
 user-service/front-end/.gitignore               |    41 +
 user-service/front-end/AGENTS.md                |     5 +
 user-service/front-end/CLAUDE.md                |     1 +
 user-service/front-end/README.md                |    36 +
 user-service/front-end/app/favicon.ico          |   Bin 0 -> 25931 bytes
 user-service/front-end/app/globals.css          |   130 +
 user-service/front-end/app/layout.tsx           |    33 +
 user-service/front-end/app/page.tsx             |    65 +
 user-service/front-end/components.json          |    25 +
 user-service/front-end/components/ui/button.tsx |    58 +
 user-service/front-end/components/ui/card.tsx   |   103 +
 user-service/front-end/components/ui/input.tsx  |    20 +
 user-service/front-end/components/ui/label.tsx  |    20 +
 user-service/front-end/components/ui/sonner.tsx |    49 +
 user-service/front-end/eslint.config.mjs        |    18 +
 user-service/front-end/lib/utils.ts             |     6 +
 user-service/front-end/next.config.ts           |     9 +
 user-service/front-end/package-lock.json        | 11467 ++++++++++++++++++++++
 user-service/front-end/package.json             |    47 +
 user-service/front-end/postcss.config.mjs       |     7 +
 user-service/front-end/public/file.svg          |     1 +
 user-service/front-end/public/globe.svg         |     1 +
 user-service/front-end/public/next.svg          |     1 +
 user-service/front-end/public/vercel.svg        |     1 +
 user-service/front-end/public/window.svg        |     1 +
 user-service/front-end/tsconfig.json            |    34 +
 user-service/front-end/vitest.config.ts         |     9 +
 user-service/front-end/vitest.setup.ts          |     1 +
 28 files changed, 12189 insertions(+)
