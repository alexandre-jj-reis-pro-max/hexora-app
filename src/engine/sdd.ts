/**
 * SDD Engine — builds squad summaries, validates SDD output, renders markdown.
 */

import { TEAM } from '../constants';
import type { AgentConfigs } from '../types';
import {
  SDD_REQUIRED_SECTIONS,
  SDD_SECTION_LABELS,
  CODE_AGENTS,
  type SDDDocument,
  type SDDSectionKey,
  type POResponse,
} from './llm';

// ── Squad summary for PO prompt ─────────────────────────────────────────────

/**
 * Builds a compact textual summary of the squad's capabilities
 * to inject into the PO refinement prompt.
 */
export function buildSquadSummary(
  squadAgentIds: string[],
  agentConfigs: AgentConfigs,
  activeWsId: string | null,
  workspaceNames: Record<string, string>,
): string {
  const lines: string[] = [];

  for (const agentId of squadAgentIds) {
    if (agentId === 'coord') continue; // Coord is internal, PO doesn't need it

    const def = TEAM.find((t) => t.id === agentId);
    if (!def) continue;

    const cfgKey = `${activeWsId}_${agentId}`;
    const cfg = agentConfigs[cfgKey];

    const parts: string[] = [`${agentId} (${def.name}, ${def.role})`];

    if (cfg?.tools?.length) {
      parts.push(`skills=[${cfg.tools.join(', ')}]`);
    }

    if (cfg?.mcpServers?.length) {
      parts.push(`mcp=[${cfg.mcpServers.map((s) => s.name).join(', ')}]`);
    }

    if (cfg?.workspaceIds?.length) {
      const wsNames = cfg.workspaceIds
        .map((id) => workspaceNames[id] || id)
        .join(', ');
      parts.push(`knowledge=[${wsNames}]`);
    }

    if (cfg?.prompt?.trim()) {
      parts.push('prompt=customizado');
    }

    // Skills sources
    const skillSources: string[] = [];
    if (cfg?.skills?.text) skillSources.push('instruções');
    if (cfg?.skills?.fileContent) skillSources.push(`doc:${cfg.skills.fileName}`);
    if (cfg?.skills?.githubContent) skillSources.push('github-doc');
    if (skillSources.length) {
      parts.push(`skills=[${skillSources.join(', ')}]`);
    }

    lines.push(`- ${parts.join(': ' + (parts.length > 1 ? '' : ''))}`);
  }

  if (lines.length === 0) {
    return 'Squad vazia — nenhum agente configurado.';
  }

  return `Squad disponível:\n${lines.join('\n')}`;
}

// ── Parse PO response ───────────────────────────────────────────────────────

/**
 * Parses the PO LLM response into a typed POResponse.
 * Returns null if JSON is completely unparseable.
 */
export function parsePOResponse(text: string): POResponse | null {
  // Strategy 1: Direct parse
  try {
    const parsed = JSON.parse(text);
    if (parsed.status) return parsed as POResponse;
  } catch { /* continue */ }

  // Strategy 2: Extract JSON from markdown code block
  const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlock) {
    try {
      const parsed = JSON.parse(codeBlock[1].trim());
      if (parsed.status) return parsed as POResponse;
    } catch { /* continue */ }
  }

  // Strategy 3: Find outermost { ... } with balanced braces
  const jsonStr = extractBalancedJson(text);
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.status) return parsed as POResponse;
    } catch {
      // Strategy 4: Clean common LLM JSON mistakes and retry
      const cleaned = cleanLlmJson(jsonStr);
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.status) return parsed as POResponse;
      } catch { /* complete failure */ }
    }
  }

  return null;
}

/** Extract balanced JSON object from text (handles nested braces) */
function extractBalancedJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }

    if (ch === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  // Return best effort even if unbalanced
  return text.slice(start);
}

/** Fix common LLM JSON mistakes */
function cleanLlmJson(json: string): string {
  let cleaned = json;
  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  // Fix unquoted keys
  cleaned = cleaned.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
  // Fix single quotes to double quotes (careful with apostrophes in text)
  cleaned = cleaned.replace(/:\s*'([^']*)'/g, ': "$1"');
  // Remove control characters
  cleaned = cleaned.replace(/[\x00-\x1f\x7f]/g, (c) => c === '\n' || c === '\t' ? c : '');
  return cleaned;
}

// ── Validate SDD ────────────────────────────────────────────────────────────

export interface SDDValidation {
  valid: boolean;
  missingSections: SDDSectionKey[];
  agentsNeeded: string[];
  agentsOrder: string[];
}

/**
 * Validates the SDD document against the rules:
 * - Required sections must be present
 * - If any code agent is in agents_needed, QA is forced
 * - agents_needed must not be empty
 */
export function validateSDD(sdd: SDDDocument): SDDValidation {
  // Check required sections
  const missingSections: SDDSectionKey[] = [];
  for (const section of SDD_REQUIRED_SECTIONS) {
    if (section === 'agents') {
      if (!sdd.agents?.needed?.length) missingSections.push('agents');
    } else {
      const val = sdd[section];
      if (!val || (typeof val === 'string' && !val.trim())) {
        missingSections.push(section);
      }
    }
  }

  // Extract agents
  let agentsNeeded = sdd.agents?.needed ?? [];
  let agentsOrder = sdd.agents?.order ?? [...agentsNeeded];

  // Rule: if any code agent is present, force QA
  const hasCodeAgent = agentsNeeded.some((id) => CODE_AGENTS.includes(id));
  if (hasCodeAgent && !agentsNeeded.includes('qa')) {
    agentsNeeded = [...agentsNeeded, 'qa'];
    agentsOrder = [...agentsOrder, 'qa'];
  }

  return {
    valid: missingSections.length === 0,
    missingSections,
    agentsNeeded,
    agentsOrder,
  };
}

/**
 * Fills missing required sections with placeholder text.
 */
export function fillPlaceholders(sdd: SDDDocument, missing: SDDSectionKey[]): SDDDocument {
  const filled = { ...sdd };
  for (const section of missing) {
    if (section === 'agents') {
      if (!filled.agents) {
        filled.agents = { needed: [], justification: 'A ser definido', order: [] };
      }
    } else {
      if (!filled[section] || (typeof filled[section] === 'string' && !(filled[section] as string).trim())) {
        (filled as Record<string, unknown>)[section] = 'A ser definido.';
      }
    }
  }
  return filled;
}

// ── Render SDD as Markdown ──────────────────────────────────────────────────

/**
 * Converts a structured SDD JSON into readable markdown for:
 * 1. Displaying to the user for approval
 * 2. Committing to the repo as docs/sdd-*.md
 */
export function renderSddMarkdown(sdd: SDDDocument, title: string): string {
  const lines: string[] = [`# SDD: ${title}`, ''];

  // Render known sections in order
  for (const key of Object.keys(SDD_SECTION_LABELS) as SDDSectionKey[]) {
    const value = sdd[key];
    if (!value) continue;

    const label = SDD_SECTION_LABELS[key];

    if (key === 'agents' && typeof value === 'object') {
      const agents = value as { needed?: string[]; justification?: string; order?: string[] };
      lines.push(`## ${label}`, '');
      if (agents.needed?.length) {
        lines.push('**Agentes necessários:**');
        for (const agentId of agents.needed) {
          const def = TEAM.find((t) => t.id === agentId);
          lines.push(`- ${def ? `${def.name} (${def.role})` : agentId}`);
        }
        lines.push('');
      }
      if (agents.order?.length) {
        lines.push(`**Ordem de execução:** ${agents.order.join(' → ')}`, '');
      }
      if (agents.justification) {
        lines.push(`**Justificativa:** ${agents.justification}`, '');
      }
    } else if (typeof value === 'string') {
      lines.push(`## ${label}`, '', value, '');
    } else if (Array.isArray(value)) {
      lines.push(`## ${label}`, '');
      for (const item of value) {
        if (typeof item === 'string') {
          lines.push(`- ${item}`);
        } else if (typeof item === 'object' && item !== null) {
          const title = item.titulo || item.title || item.id || '';
          const desc = item.descricao || item.description || '';
          lines.push(`- **${title}**: ${desc}`);
        }
      }
      lines.push('');
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`## ${label}`, '', '```json', JSON.stringify(value, null, 2), '```', '');
    }
  }

  // Render extra sections
  if (sdd.extra && typeof sdd.extra === 'object') {
    for (const [key, value] of Object.entries(sdd.extra)) {
      if (value && typeof value === 'string') {
        lines.push(`## ${key}`, '', value, '');
      }
    }
  }

  return lines.join('\n');
}
