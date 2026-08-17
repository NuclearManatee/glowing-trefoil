// eslint.tooling.js
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import stylistic from "@stylistic/eslint-plugin";
import unicorn from "eslint-plugin-unicorn";

export default [
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
			"@stylistic": stylistic,
			unicorn,
		},
		rules: {
			// ---------------------------------------------------------------------
			// 1. STRICT TYPING & SAFETY
			// ---------------------------------------------------------------------
			"@typescript-eslint/no-explicit-any": "error",

			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
				},
			],

			"@typescript-eslint/consistent-type-imports": [
				"error",
				{
					prefer: "type-imports",
					fixStyle: "inline-type-imports",
				},
			],

			// Ban inline string/code evaluation.
			"no-eval": "error",
			"no-implied-eval": "error",
			"no-new-func": "error",

			// ---------------------------------------------------------------------
			// 2. STYLISTIC & FORMATTING
			// ---------------------------------------------------------------------
			"@stylistic/quotes": ["error", "double", { avoidEscape: true }],
			"@stylistic/semi": ["error", "always"],
			"@stylistic/indent": ["error", "tab"],
			"@stylistic/comma-dangle": ["error", "always-multiline"],

			// ---------------------------------------------------------------------
			// 3. NAMING & FILE CONVENTIONS
			// ---------------------------------------------------------------------
			"unicorn/filename-case": [
				"error",
				{
					case: "camelCase",
					ignore: ["\\.test\\.ts$"],
				},
			],

			"@typescript-eslint/naming-convention": [
				"error",
				{
					selector: "variable",
					format: ["camelCase", "UPPER_CASE"],
					leadingUnderscore: "allow",
				},
				{
					selector: "function",
					format: ["camelCase"],
				},
				{
					selector: "typeLike",
					format: ["PascalCase"],
				},
			],

			"@typescript-eslint/array-type": [
				"error",
				{ default: "array" },
			],

			// ---------------------------------------------------------------------
			// 4. CODE STRUCTURE & MODERN JS
			// ---------------------------------------------------------------------
			"prefer-const": "error",
			"no-var": "error",

			"prefer-destructuring": [
				"error",
				{
					VariableDeclarator: {
						array: true,
						object: true,
					},
					AssignmentExpression: {
						array: false,
						object: false,
					},
				},
			],

			"no-nested-ternary": "error",
			"unicorn/prefer-node-protocol": "error",
			"unicorn/no-array-for-each": "error",

			// Top-level functions are declarations; callbacks are arrows.
			"no-restricted-syntax": [
				"error",

				{
					selector:
						"Program > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression",
					message:
						"Top-level functions must use function declarations; arrows are for callbacks.",
				},
				{
					selector:
						"Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression",
					message:
						"Top-level functions must use function declarations; arrows are for callbacks.",
				},
				{
					selector: "FunctionExpression",
					message:
						"Use arrow functions for callbacks; top-level functions must be declarations.",
				},
			],

			// ---------------------------------------------------------------------
			// 5. OPINIONATED DOMAIN BANS
			// ---------------------------------------------------------------------
			"no-restricted-imports": [
				"error",
				{
					paths: [
						{
							name: "dayjs",
							message:
								"Use native global `Temporal` API for date operations.",
						},
						{
							name: "date-fns",
							message:
								"Use native global `Temporal` API for date operations.",
						},
						{
							name: "moment",
							message:
								"Use native global `Temporal` API for date operations.",
						},
						{
							name: "luxon",
							message:
								"Use native global `Temporal` API for date operations.",
						},
					],
					patterns: [
						{
							group: [
								"dayjs/**",
								"date-fns/**",
								"moment/**",
								"luxon/**",
							],
							message:
								"External date libraries are prohibited; use native global `Temporal`.",
						},
					],
				},
			],

			"no-restricted-syntax": [
				"error",

				// Ban parseInt() and Number.parseInt().
				{
					selector: "CallExpression[callee.name='parseInt']",
					message:
						"Use `Number(val)` for parsing instead of `parseInt`.",
				},
				{
					selector:
						"CallExpression[callee.type='MemberExpression'][callee.property.name='parseInt']",
					message:
						"Use `Number(val)` for parsing instead of `Number.parseInt`.",
				},

				// Ban unary '+' parsing.
				{
					selector: "UnaryExpression[operator='+']",
					message:
						"Use `Number(val)` for parsing instead of unary `+`.",
				},

				// Ban z.any(); use z.unknown() instead.
				{
					selector:
						"CallExpression[callee.type='MemberExpression'][callee.object.name='z'][callee.property.name='any']",
					message:
						"Use `z.unknown()` instead of `z.any()`.",
				},

				// Ban direct .env file reads.
				{
					selector:
						"CallExpression[callee.name='readFile'][arguments.0.value='.env']",
					message:
						"Do not read `.env` as a file. Use `process.env`.",
				},
				{
					selector:
						"CallExpression[callee.name='readFileSync'][arguments.0.value='.env']",
					message:
						"Do not read `.env` as a file. Use `process.env`.",
				},
				{
					selector:
						"CallExpression[callee.type='MemberExpression'][callee.property.name='readFile'][arguments.0.value='.env']",
					message:
						"Do not read `.env` as a file. Use `process.env`.",
				},
				{
					selector:
						"CallExpression[callee.type='MemberExpression'][callee.property.name='readFileSync'][arguments.0.value='.env']",
					message:
						"Do not read `.env` as a file. Use `process.env`.",
				},
				{
					selector:
						"CallExpression[callee.type='MemberExpression'][callee.object.name='Bun'][callee.property.name='file'][arguments.0.value='.env']",
					message:
						"Do not read `.env` as a file. Use `process.env`.",
				},
			],
		},
	},
];
