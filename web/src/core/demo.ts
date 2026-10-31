/**
 * Static demo build (`pnpm build:demo`): one self-contained HTML file for sandboxed hosts (e.g. a claude.ai artifact) that have
 * no backend, no service worker and no deep-link URLs. The labs, simulations, tours, quizzes and validators are the real app;
 * only the AI teacher is replaced by scripted replies. In normal builds this constant is `false` and the demo code is tree-shaken out.
 */
export const DEMO = import.meta.env.VITE_DEMO === '1';
