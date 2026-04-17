const test = require("node:test");
const assert = require("node:assert/strict");
const { TOKEN_TYPES, getDiagnostics, getSemanticTokens } = require("../src/phelAnalysis");

function tokenTypesForLine(tokens, line) {
  return tokens
    .filter((token) => token.line === line)
    .map((token) => TOKEN_TYPES[token.type]);
}

test("getSemanticTokens marks keywords, numbers, definitions, comments, and strings", () => {
  const source = `(defn add [x y]
  ; sum values
  (let [label "sum"]
    (+ x y 42)))`;

  const tokens = getSemanticTokens(source);
  const line0Types = tokenTypesForLine(tokens, 0);
  const line1Types = tokenTypesForLine(tokens, 1);
  const line2Types = tokenTypesForLine(tokens, 2);

  assert.ok(line0Types.includes("keyword"));
  assert.ok(line0Types.includes("function"));
  assert.ok(line1Types.includes("comment"));
  assert.ok(line2Types.includes("string"));
  assert.ok(tokens.some((token) => TOKEN_TYPES[token.type] === "number"));
});

test("getDiagnostics reports unbalanced parentheses", () => {
  const diagnostics = getDiagnostics(`(defn broken [x]\n  (+ x 1)\n`);
  assert.ok(diagnostics.some((diagnostic) => diagnostic.message === "Unclosed opening parenthesis."));
});

test("getDiagnostics reports unterminated string", () => {
  const diagnostics = getDiagnostics(`(defn broken []\n  "oops\n)`);
  assert.ok(diagnostics.some((diagnostic) => diagnostic.message === "Unterminated string literal."));
});
