/**
 * Shared agent-picker grouping: the built-in vs custom split and the
 * preferred display order, used by both the new-session picker
 * (NewChatDialog) and the fork/switch picker (ForkSessionDialog) so the
 * two surfaces group and order agents identically.
 */
import type { AvailableAgent } from "@/hooks/useAvailableAgents";
import { nativeCodingAgentForAvailableAgent } from "@/lib/nativeCodingAgents";

// Built-in agents (by name slug) — the long-lived agents the server ships
// out of the box. Pickers group these first, then a divider, then custom
// (user-registered) agents. GET /v1/agents doesn't yet distinguish the
// two, so this is a frontend allowlist for now.
export const BUILTIN_AGENTS = new Set([
  "claude-native-ui", // Claude Code
  "codex-native-ui", // Codex
  "opencode-native-ui", // OpenCode
  "pi-native-ui", // Pi
  "cursor-native-ui", // Cursor
  "kiro-native-ui", // Kiro
  "antigravity-native-ui", // Antigravity
  "goose-native-ui", // Goose
  "qwen-native-ui", // Qwen Code
  "kimi-native-ui", // Kimi
  "polly",
  "debby",
]);

// Preferred display order for the built-in group. The server returns
// agents newest-registered first (agent_store.list sorts by created_at
// desc), so pin the order users expect; any agent not listed here falls
// after, in server order.
export const AGENT_DISPLAY_ORDER = [
  "Claude Code",
  "Codex",
  "OpenCode",
  "Cursor",
  "Pi",
  "Kiro",
  "Antigravity",
  "Qwen Code",
  "Kimi",
  "Polly",
  "Debby",
];

function displayRank(name: string): number {
  const i = AGENT_DISPLAY_ORDER.indexOf(name);
  return i === -1 ? AGENT_DISPLAY_ORDER.length : i;
}

/**
 * Whether a harness is configured on a host, given the host's readiness map.
 * `true`/non-empty-string means ready; `false`/known-failure-string means not.
 * Unknown harnesses (absent from the map) are treated as configured so they
 * sort with the available group rather than falsely demoted.
 */
function isHarnessConfigured(
  harness: string | null | undefined,
  configuredHarnesses: Record<string, boolean | string> | null | undefined,
): boolean {
  if (!harness || !configuredHarnesses) return true;
  const v = configuredHarnesses[harness];
  if (v === undefined) return true;
  if (v === false) return false;
  if (v === "binary-missing" || v === "needs-auth" || v === "unconfigured") return false;
  return true;
}

/**
 * Sort agents into the picker's canonical order. When a host's
 * `configured_harnesses` map is provided, configured harnesses sort before
 * unconfigured ones; within each group agents sort alphabetically by
 * display name. Non-native agents (which have no harness readiness) keep
 * their {@link AGENT_DISPLAY_ORDER} position.
 *
 * @param agents - Agents to sort (not mutated; a copy is returned).
 * @param configuredHarnesses - The selected host's readiness map, if any.
 */
export function sortAgentsForDisplay<T extends AvailableAgent>(
  agents: readonly T[],
  configuredHarnesses?: Record<string, boolean | string> | null,
): T[] {
  return [...agents].sort((a, b) => {
    const aNative = nativeCodingAgentForAvailableAgent(a);
    const bNative = nativeCodingAgentForAvailableAgent(b);

    // Non-native agents sort after native ones, in display-order.
    if (!aNative && !bNative) return displayRank(a.display_name) - displayRank(b.display_name);
    if (!aNative) return 1;
    if (!bNative) return -1;

    // Both native: configured before unconfigured, then alphabetical.
    const aConfigured = isHarnessConfigured(a.harness, configuredHarnesses);
    const bConfigured = isHarnessConfigured(b.harness, configuredHarnesses);
    if (aConfigured !== bConfigured) return aConfigured ? -1 : 1;
    return a.display_name.localeCompare(b.display_name);
  });
}

/**
 * Sort then split agents into the built-in group and the custom group,
 * for rendering with a divider between. Built-ins are the
 * {@link BUILTIN_AGENTS} slugs; everything else is custom.
 *
 * @param agents - Agents to group (e.g. the picker's full candidate list).
 * @returns ``{ builtins, customs }``, each sorted via
 *   {@link sortAgentsForDisplay}.
 */
export function partitionAgentsByKind<T extends AvailableAgent>(
  agents: readonly T[],
  configuredHarnesses?: Record<string, boolean | string> | null,
): { builtins: T[]; customs: T[] } {
  const sorted = sortAgentsForDisplay(agents, configuredHarnesses);
  return {
    builtins: sorted.filter((a) => BUILTIN_AGENTS.has(a.name)),
    customs: sorted.filter((a) => !BUILTIN_AGENTS.has(a.name)),
  };
}
