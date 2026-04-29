export function extractJsonObject(text: string): unknown {
  const cleaned = stripJsonNoise(text);
  const direct = tryParse(cleaned);
  if (direct) return direct;
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    const parsed = tryParse(fenced.trim());
    if (parsed) return parsed;
  }
  const objectText = balancedObject(cleaned);
  if (objectText) {
    const parsed = tryParse(objectText);
    if (parsed) return parsed;
  }
  const recovered = attemptRecovery(cleaned);
  if (recovered) return recovered;
  return null;
}

function attemptRecovery(text: string) {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let sub = text.slice(start);
  let depth = 0;
  let inString = false;
  let escaped = false;
  let result = "";
  for (let i = 0; i < sub.length; i += 1) {
    const char = sub[i];
    result += char;
    if (inString) {
      escaped = char === "\\" && !escaped;
      if (char === "\"" && !escaped) inString = false;
      if (char !== "\\") escaped = false;
      continue;
    }
    if (char === "\"") inString = true;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return tryParse(result);
  }
  // If we reach here, it's truncated. Try closing strings and objects.
  let closing = "";
  if (inString) closing += "\"";
  // We need to close objects/arrays. This is a simplified approach.
  // Actually, let's just count open braces and brackets.
  let openBraces = 0;
  let openBrackets = 0;
  let testInString = false;
  let testEscaped = false;
  for (const c of result) {
    if (testInString) {
      testEscaped = c === "\\" && !testEscaped;
      if (c === "\"" && !testEscaped) testInString = false;
      if (c !== "\\") testEscaped = false;
      continue;
    }
    if (c === "\"") testInString = true;
    if (c === "{") openBraces += 1;
    if (c === "}") openBraces -= 1;
    if (c === "[") openBrackets += 1;
    if (c === "]") openBrackets -= 1;
  }
  let finalResult = result;
  if (testInString) finalResult += "\"";
  // Close arrays first, then objects
  while (openBrackets > 0) { finalResult += "]"; openBrackets -= 1; }
  while (openBraces > 0) { finalResult += "}"; openBraces -= 1; }
  return tryParse(finalResult);
}

function stripJsonNoise(text: string) {
  return text
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function tryParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function balancedObject(text: string) {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      escaped = char === "\\" && !escaped;
      if (char === "\"" && !escaped) inString = false;
      if (char !== "\\") escaped = false;
      continue;
    }
    if (char === "\"") inString = true;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

