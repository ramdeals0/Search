export const CHUNK_LINE_COUNT = 2_000;
export const LARGE_FILE_BYTES = 512 * 1024;

export function countLines(content: string): number {
  if (!content) return 0;
  let count = 1;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") count++;
  }
  return count;
}

export function extractLineRange(
  content: string,
  startLine: number,
  endLine: number,
): { lines: string[]; rawText: string } {
  const lines: string[] = [];
  let currentLine = 1;
  let start = 0;

  for (let i = 0; i <= content.length; i++) {
    const atEnd = i === content.length;
    if (atEnd || content[i] === "\n") {
      if (currentLine >= startLine && currentLine <= endLine) {
        let lineEnd = i;
        if (lineEnd > start && content[lineEnd - 1] === "\r") lineEnd--;
        lines.push(content.slice(start, lineEnd));
      }
      if (currentLine >= endLine) break;
      start = i + 1;
      currentLine++;
    }
  }

  return { lines, rawText: lines.join("\n") };
}

export function* iterateLines(
  content: string,
  fromLine = 1,
  maxLines = Infinity,
): Generator<{ line: string; lineNumber: number }> {
  let start = 0;
  let lineNumber = 1;

  for (let i = 0; i <= content.length; i++) {
    const atEnd = i === content.length;
    if (atEnd || content[i] === "\n") {
      if (lineNumber >= fromLine) {
        let lineEnd = i;
        if (lineEnd > start && content[lineEnd - 1] === "\r") lineEnd--;
        yield { line: content.slice(start, lineEnd), lineNumber };
        if (lineNumber >= fromLine + maxLines - 1) return;
      }
      start = i + 1;
      lineNumber++;
    }
  }
}

export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
