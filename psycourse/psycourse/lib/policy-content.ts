export type PolicyContent = {
  id: string;
  en: string;
};

export function parsePolicyContent(value: string | null): PolicyContent {
  if (!value) return { id: "", en: "" };

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "id" in parsed &&
      "en" in parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.en === "string"
    ) {
      return { id: parsed.id, en: parsed.en };
    }
  } catch {
    // Older policy rows stored a single plain-text document.
  }

  return { id: value, en: "" };
}

export function readPolicyContent(value: unknown): PolicyContent | null {
  if (value === undefined) return { id: "", en: "" };
  if (
    value === null ||
    typeof value !== "object" ||
    !("id" in value) ||
    !("en" in value) ||
    typeof value.id !== "string" ||
    typeof value.en !== "string"
  ) {
    return null;
  }

  const content = { id: value.id.trim(), en: value.en.trim() };
  if (content.id.length > 100000 || content.en.length > 100000) return null;
  return content;
}

export function serializePolicyContent(content: PolicyContent): string | null {
  if (!content.id && !content.en) return null;
  return JSON.stringify(content);
}
