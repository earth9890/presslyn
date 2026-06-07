import { ValidationError } from "../errors.js";

export interface ParsedTemplateBlock {
  blockName: string;
  attrs: Record<string, unknown>;
  innerBlocks: ParsedTemplateBlock[];
  innerHtml: string;
  selfClosing: boolean;
}

const OPEN_RE = /<!--\s+wp:([a-z0-9-]+\/[a-z0-9-]+|[a-z0-9-]+)(?:\s+({[\s\S]*?}))?\s*(\/)?\s*-->/g;
const CLOSE_RE = /<!--\s+\/wp:([a-z0-9-]+\/[a-z0-9-]+|[a-z0-9-]+)\s+-->/g;

interface StackFrame {
  blockName: string;
  attrs: Record<string, unknown>;
  start: number;
  contentStart: number;
  children: ParsedTemplateBlock[];
}

function parseAttrs(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    throw new ValidationError(
      `Invalid block template attributes: ${(error as Error).message}`
    );
  }
}

export function parseBlockTemplate(template: string): ParsedTemplateBlock[] {
  const root: ParsedTemplateBlock[] = [];
  const stack: StackFrame[] = [];
  let index = 0;

  while (index < template.length) {
    OPEN_RE.lastIndex = index;
    CLOSE_RE.lastIndex = index;

    const open = OPEN_RE.exec(template);
    const close = CLOSE_RE.exec(template);

    const nextOpen = open ? open.index : Number.POSITIVE_INFINITY;
    const nextClose = close ? close.index : Number.POSITIVE_INFINITY;

    if (!open && !close) {
      break;
    }

    if (nextClose < nextOpen) {
      if (stack.length === 0) {
        throw new ValidationError(`Unexpected closing block "${close![1]}"`);
      }

      const frame = stack.pop()!;
      if (frame.blockName !== close![1]) {
        throw new ValidationError(
          `Mismatched closing block. Expected "${frame.blockName}", received "${close![1]}"`
        );
      }

      const endIndex = close!.index;
      const innerHtml = template.slice(frame.contentStart, endIndex);
      const parsed: ParsedTemplateBlock = {
        blockName: frame.blockName,
        attrs: frame.attrs,
        innerBlocks: frame.children,
        innerHtml,
        selfClosing: false,
      };

      if (stack.length > 0) {
        stack[stack.length - 1]!.children.push(parsed);
      } else {
        root.push(parsed);
      }

      index = close!.index + close![0].length;
      continue;
    }

    const openMatch = open!;
    const blockName = openMatch[1]!;
    const attrs = parseAttrs(openMatch[2]);
    const selfClosing = openMatch[3] === "/";

    if (selfClosing) {
      const parsed: ParsedTemplateBlock = {
        blockName,
        attrs,
        innerBlocks: [],
        innerHtml: "",
        selfClosing: true,
      };

      if (stack.length > 0) {
        stack[stack.length - 1]!.children.push(parsed);
      } else {
        root.push(parsed);
      }
      index = openMatch.index + openMatch[0].length;
      continue;
    }

    stack.push({
      blockName,
      attrs,
      start: openMatch.index,
      contentStart: openMatch.index + openMatch[0].length,
      children: [],
    });
    index = openMatch.index + openMatch[0].length;
  }

  if (stack.length > 0) {
    throw new ValidationError(
      `Unclosed block "${stack[stack.length - 1]!.blockName}" in template`
    );
  }

  return root;
}
