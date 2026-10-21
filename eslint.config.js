import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'playwright-report', 'test-results', 'lighthouse/reports', 'public/mockServiceWorker.js', 'src/routeTree.gen.ts', '.dev'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
  {
    // Componentes gerados pelo shadcn/ui e rotas exportam utilitários junto dos componentes.
    files: ['src/components/ui/**', 'src/routes/**', 'src/components/forms/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Fixtures do Playwright usam `use()`, que não é o hook do React.
    files: ['e2e/**', 'playwright.config.ts', 'lighthouse/**', 'scripts/**'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
)
