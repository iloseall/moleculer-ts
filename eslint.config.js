const js = require("@eslint/js");
const globals = require("globals");
const pluginSecurity = require("eslint-plugin-security");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");
const tseslint = require("typescript-eslint");

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
	{ ignores: ["test/typescript/hello-world/out/*.js", "dist", "src/**/*.d.ts"] },
	js.configs.recommended,
	pluginSecurity.configs.recommended,
	eslintPluginPrettierRecommended,
	...tseslint.configs.recommended.map(config => ({ ...config, files: ["**/*.ts"] })),
	{
		files: ["**/*.js", "**/*.mjs"],
		languageOptions: {
			parserOptions: {
				sourceType: "module",
				ecmaVersion: 2023
			},
			globals: {
				...globals.node,
				...globals.es2020,
				...globals.commonjs,
				...globals.es6,
				...globals.jquery,
				...globals.jest,
				...globals.jasmine,
				process: "readonly",
				fetch: "readonly"
			}
		},
		// plugins: ["node", "security"],
		rules: {
			"no-var": ["error"],
			"no-console": ["error"],
			"no-unused-vars": ["warn"],
			"no-trailing-spaces": ["error"],
			"security/detect-object-injection": ["off"],
			"security/detect-non-literal-require": ["off"],
			"security/detect-non-literal-fs-filename": ["off"],
			"no-process-exit": ["off"],
			"node/no-unpublished-require": 0
		},
		ignores: ["benchmark/test.js"]
	},
	{
		files: ["**/*.ts"],
		rules: {
			"no-var": ["error"],
			"no-console": ["error"],
			"no-unused-vars": ["off"],
			"@typescript-eslint/no-unused-vars": ["warn", { args: "none" }],
			"no-trailing-spaces": ["error"],
			"security/detect-object-injection": ["off"],
			"security/detect-non-literal-require": ["off"],
			"security/detect-non-literal-fs-filename": ["off"],
			"no-process-exit": ["off"],

			// The codebase is CJS-first: `import X = require("y")` / `export =` must stay allowed.
			"@typescript-eslint/no-require-imports": ["off"],
			// `any` is used extensively by design (dynamic service schemas, payloads).
			"@typescript-eslint/no-explicit-any": ["off"],
			"@typescript-eslint/no-empty-object-type": ["off"],
			"@typescript-eslint/no-wrapper-object-types": ["off"],
			"@typescript-eslint/no-unsafe-function-type": ["off"],
			"@typescript-eslint/no-unused-expressions": ["off"],

			// `declare namespace X` is the public type-surface pattern used to merge
			// extra types into an `export =` value (mirrors the original hand-written .d.ts).
			"@typescript-eslint/no-namespace": ["off"],
			// `@ts-ignore` comments were already present in the original sources.
			"@typescript-eslint/ban-ts-comment": ["off"],
			// Legacy patterns kept as-is to avoid changing runtime behaviour.
			"prefer-rest-params": ["off"],
			"prefer-spread": ["off"],
			"@typescript-eslint/no-this-alias": ["off"]
		}
	},
	// Tests, scripts & examples are CLI-ish code: console output and loose vars are expected.
	// Kept last (after the `**/*.ts` block) so that it also applies to their `.ts` files.
	{
		files: ["test/**/*.{js,ts}", "dev/**/*.{js,ts}", "benchmark/**/*.{js,ts}", "examples/**/*.{js,ts}"],
		rules: {
			"no-console": ["off"],
			// Specs keep imports/variables around on purpose (fixtures, WIP cases).
			"no-unused-vars": ["off"],
			"@typescript-eslint/no-unused-vars": ["off"]
		}
	}
];
