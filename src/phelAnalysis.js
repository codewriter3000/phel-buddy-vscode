const KEYWORDS = new Set([
  "def",
  "defn",
  "do",
  "fn",
  "if",
  "let",
  "loop",
  "match",
  "ns",
  "recur",
  "require",
  "use",
  "when",
]);

const TYPES = new Set(["Any", "Bool", "Float", "Int", "List", "Map", "Nil", "Set", "String"]);
const TOKEN_TYPES = ["keyword", "function", "variable", "number", "string", "comment", "type"];
const TOKEN_TYPE_INDEX = new Map(TOKEN_TYPES.map((type, index) => [type, index]));

function createOccupancy(lines) {
  return lines.map(() => []);
}

function isRangeFree(occupancy, line, start, end) {
  const used = occupancy[line];
  return !used.some((range) => start < range.end && end > range.start);
}

function markRange(occupancy, line, start, end) {
  occupancy[line].push({ start, end });
}

function addToken(tokens, occupancy, line, start, end, type) {
  if (start >= end || !isRangeFree(occupancy, line, start, end)) {
    return;
  }

  tokens.push({
    line,
    start,
    length: end - start,
    type: TOKEN_TYPE_INDEX.get(type),
  });
  markRange(occupancy, line, start, end);
}

function collectRegexMatches(lines, tokens, occupancy, regex, type) {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const lineText = lines[lineIndex];
    regex.lastIndex = 0;
    let match = regex.exec(lineText);

    while (match) {
      const start = match.index;
      const end = start + match[0].length;
      addToken(tokens, occupancy, lineIndex, start, end, type);
      match = regex.exec(lineText);
    }
  }
}

function collectStringTokens(lines, tokens, occupancy) {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const lineText = lines[lineIndex];
    let position = 0;

    while (position < lineText.length) {
      if (lineText[position] !== "\"") {
        position += 1;
        continue;
      }

      const start = position;
      position += 1;
      let escaped = false;

      while (position < lineText.length) {
        const char = lineText[position];
        if (escaped) {
          escaped = false;
          position += 1;
          continue;
        }

        if (char === "\\") {
          escaped = true;
          position += 1;
          continue;
        }

        if (char === "\"") {
          position += 1;
          break;
        }
        position += 1;
      }

      addToken(tokens, occupancy, lineIndex, start, position, "string");
    }
  }
}

function getSemanticTokens(text) {
  const lines = text.split(/\r?\n/);
  const tokens = [];
  const occupancy = createOccupancy(lines);

  collectStringTokens(lines, tokens, occupancy);
  collectRegexMatches(lines, tokens, occupancy, /;.*$/g, "comment");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const lineText = lines[lineIndex];
    const defRegex = /\((defn|def)\s+([^\s()[\]{}]+)/g;
    let match = defRegex.exec(lineText);

    while (match) {
      const tokenText = match[2];
      const tokenStart = match.index + match[0].length - tokenText.length;
      const tokenType = match[1] === "defn" ? "function" : "variable";
      addToken(tokens, occupancy, lineIndex, tokenStart, tokenStart + tokenText.length, tokenType);
      match = defRegex.exec(lineText);
    }
  }

  collectRegexMatches(lines, tokens, occupancy, /\b\d+(?:\.\d+)?\b/g, "number");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const lineText = lines[lineIndex];
    const wordRegex = /\b[A-Za-z_][A-Za-z0-9_\-?!]*\b/g;
    let match = wordRegex.exec(lineText);

    while (match) {
      const word = match[0];
      const start = match.index;
      const end = start + word.length;

      if (KEYWORDS.has(word)) {
        addToken(tokens, occupancy, lineIndex, start, end, "keyword");
      } else if (TYPES.has(word)) {
        addToken(tokens, occupancy, lineIndex, start, end, "type");
      }
      match = wordRegex.exec(lineText);
    }
  }

  tokens.sort((a, b) => (a.line - b.line) || (a.start - b.start));
  return tokens;
}

function getDiagnostics(text) {
  const diagnostics = [];
  const stack = [];
  const lines = text.split(/\r?\n/);
  let inString = false;
  let stringStart = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const lineText = lines[lineIndex];
    let inComment = false;
    let escaped = false;

    for (let charIndex = 0; charIndex < lineText.length; charIndex += 1) {
      const char = lineText[charIndex];

      if (inComment) {
        continue;
      }

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === "\\") {
          escaped = true;
          continue;
        }

        if (char === "\"") {
          inString = false;
          stringStart = null;
        }
        continue;
      }

      if (char === ";") {
        inComment = true;
      } else if (char === "\"") {
        inString = true;
        stringStart = { line: lineIndex, start: charIndex };
      } else if (char === "(") {
        stack.push({ line: lineIndex, start: charIndex });
      } else if (char === ")") {
        if (stack.length === 0) {
          diagnostics.push({
            line: lineIndex,
            start: charIndex,
            end: charIndex + 1,
            message: "Unexpected closing parenthesis.",
            severity: "error",
          });
        } else {
          stack.pop();
        }
      }
    }
  }

  while (stack.length > 0) {
    const unclosed = stack.pop();
    diagnostics.push({
      line: unclosed.line,
      start: unclosed.start,
      end: unclosed.start + 1,
      message: "Unclosed opening parenthesis.",
      severity: "error",
    });
  }

  if (inString && stringStart) {
    diagnostics.push({
      line: stringStart.line,
      start: stringStart.start,
      end: stringStart.start + 1,
      message: "Unterminated string literal.",
      severity: "error",
    });
  }

  return diagnostics;
}

module.exports = {
  KEYWORDS,
  TOKEN_TYPES,
  getSemanticTokens,
  getDiagnostics,
};
