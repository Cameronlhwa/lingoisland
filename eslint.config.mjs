import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

// Keep compiler diagnostics visible while adopting React 19. The app does not
// enable React Compiler; the existing Hooks correctness rules remain errors.
const compilerWarnings = Object.fromEntries(
  nextVitals.flatMap((config) => Object.keys(config.rules ?? {}))
    .filter((rule) => rule.startsWith('react-hooks/') && !['react-hooks/rules-of-hooks', 'react-hooks/exhaustive-deps'].includes(rule))
    .map((rule) => [rule, 'warn']),
);

export default defineConfig([
  ...nextVitals,
  { rules: compilerWarnings },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
