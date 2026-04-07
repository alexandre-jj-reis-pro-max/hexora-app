/**
 * GitHub Delivery Engine — Hexora
 *
 * Fluxo:
 *  1. prepareBranch()   — cria a branch uma única vez
 *  2. commitToBranch()  — cada agente commita seus arquivos na mesma branch
 *  3. openPR()          — abre o PR ao final com todo o contexto da equipe
 *
 * Autenticação via Personal Access Token (PAT) — scopes: repo, workflow
 */

const GH = 'https://api.github.com';

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function ghFetch<T = unknown>(
  token: string,
  path: string,
  method: 'GET' | 'POST' | 'PUT' = 'GET',
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${GH}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface BranchContext {
  token: string;
  repo: string;
  branch: string;  // feature branch (hexora/...)
  base: string;    // base branch (main/master)
}

// ── Repo code context ─────────────────────────────────────────────────────────

/** Arquivos e pastas a ignorar ao buscar contexto de código */
const IGNORE_PATHS = /node_modules|\.git|dist\/|build\/|\.next\/|\.cache|coverage|__pycache__|\.venv|vendor\//i;

/** Extensões que representam código-fonte legível */
const CODE_EXTS = /\.(ts|tsx|js|jsx|py|go|java|kt|cs|rs|rb|php|swift|c|cpp|h|sql|sh|yaml|yml|json|toml|env\.example|gradle|xml|html|css|scss)$/i;

/** Arquivos de alta prioridade (sempre úteis para dar contexto) */
const HIGH_PRIORITY = /package\.json$|requirements\.txt$|go\.mod$|pom\.xml$|build\.gradle$|Cargo\.toml$|README\.md$|\.env\.example$|tsconfig\.json$/i;

interface TreeEntry { path: string; type: 'blob' | 'tree'; size?: number }

async function fetchRepoTree(token: string, repo: string, branch: string): Promise<string[]> {
  const data = await ghFetch<{ tree: TreeEntry[] }>(
    token, `/repos/${repo}/git/trees/${branch}?recursive=1`
  );
  return (data.tree ?? [])
    .filter((e) => e.type === 'blob' && !IGNORE_PATHS.test(e.path) && (CODE_EXTS.test(e.path) || HIGH_PRIORITY.test(e.path)) && (e.size ?? 0) < 80_000)
    .map((e) => e.path);
}

export async function fetchFileContent(token: string, repo: string, path: string, branch: string): Promise<string> {
  const data = await ghFetch<{ content: string; encoding: string }>(
    token, `/repos/${repo}/contents/${path}?ref=${branch}`
  );
  if (data.encoding === 'base64') {
    try { return atob(data.content.replace(/\n/g, '')); } catch { return ''; }
  }
  return data.content ?? '';
}

/** Pontua a relevância de um arquivo para a história de usuário */
function scoreFile(filePath: string, story: string): number {
  const s = story.toLowerCase();
  const f = filePath.toLowerCase();
  let score = 0;

  if (HIGH_PRIORITY.test(filePath)) score += 10;

  // Palavras da história que aparecem no caminho do arquivo (min 3 chars)
  const words = s.match(/\b\w{3,}\b/g) ?? [];
  for (const w of words) {
    if (f.includes(w)) score += 3;
  }

  // Extensões mais relevantes para código
  if (/\.(ts|tsx|py|go|java|kt|rs)$/.test(f)) score += 2;
  if (/\.(json|yaml|yml|toml)$/.test(f)) score += 1;

  // Arquivos de entrada / estruturais são sempre úteis
  if (/\b(index|main|app|server|router|routes|models?|schema|migration|controller|service|middleware|handler|utils?|config|types?|interface)\b/i.test(f)) score += 4;

  // Profundidade: arquivos mais rasos (src/foo.ts) tendem a ser mais importantes que src/a/b/c/d/foo.ts
  const depth = f.split('/').length;
  if (depth <= 2) score += 3;
  else if (depth <= 3) score += 1;

  // Penaliza arquivos de teste/mock/fixture (úteis pro QA, não pro dev)
  if (/\b(test|spec|mock|fixture|__tests__|__mocks__|stories)\b/i.test(f)) score -= 2;

  return score;
}

/**
 * Busca a árvore do repositório, seleciona os arquivos mais relevantes para a história
 * e retorna um bloco de texto pronto para injetar no contexto do LLM.
 *
 * @param maxFiles   Máximo de arquivos a incluir (padrão: 20)
 * @param maxLines   Máximo de linhas por arquivo (padrão: 150)
 * @param maxTotalChars  Limite total de caracteres do contexto montado (padrão: 60_000 ≈ 15k tokens)
 */
export async function buildCodeContext(
  token: string,
  repo: string,
  branch: string,
  story: string,
  maxFiles = 20,
  maxLines = 150,
  maxTotalChars = 60_000,
): Promise<string> {
  let tree: string[];
  try {
    tree = await fetchRepoTree(token, repo, branch);
  } catch {
    return '';
  }
  if (!tree.length) return '';

  // Ordena por relevância, pega os top N
  const ranked = tree
    .map((p) => ({ path: p, score: scoreFile(p, story) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles);

  // Busca arquivos em paralelo (batches de 5 pra não estourar rate limit)
  const BATCH = 5;
  const sections: string[] = [];
  let totalChars = 0;

  for (let i = 0; i < ranked.length; i += BATCH) {
    const batch = ranked.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((x) => fetchFileContent(token, repo, x.path, branch).then((raw) => ({ path: x.path, raw })))
    );

    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const { path: filePath, raw } = r.value;
      const lines = raw.split('\n');
      const truncated = lines.length > maxLines
        ? lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} linhas omitidas)`
        : raw;

      const section = `### ${filePath}\n\`\`\`\n${truncated}\n\`\`\``;

      // Respeita limite total de caracteres
      if (totalChars + section.length > maxTotalChars) break;
      totalChars += section.length;
      sections.push(section);
    }

    if (totalChars >= maxTotalChars) break;
  }

  if (!sections.length) return '';

  return [
    `Código existente no repositório (${repo}, branch: ${branch}) — ${sections.length} arquivos:`,
    '',
    ...sections,
  ].join('\n');
}

/**
 * Busca SDDs anteriores (docs/sdd-*.md) do repositório.
 * Retorna o conteúdo concatenado dos SDDs encontrados (max 3, mais recentes).
 */
export async function fetchExistingSDDs(
  token: string,
  repo: string,
  branch: string,
  maxFiles = 3,
): Promise<string> {
  let tree: string[];
  try {
    tree = await fetchRepoTree(token, repo, branch);
  } catch {
    return '';
  }

  const sddPaths = tree
    .filter((p) => /^docs\/sdd-.*\.md$/i.test(p))
    .slice(-maxFiles); // last N = most recent

  if (!sddPaths.length) return '';

  const sections: string[] = [];
  for (const path of sddPaths) {
    try {
      const content = await fetchFileContent(token, repo, path, branch);
      // Truncate long SDDs
      const truncated = content.length > 6000
        ? content.slice(0, 6000) + '\n... (truncado)'
        : content;
      sections.push(`### ${path}\n${truncated}`);
    } catch { /* skip */ }
  }

  if (!sections.length) return '';
  return `SDDs anteriores no repositorio:\n\n${sections.join('\n\n')}`;
}

// ── Path helpers ──────────────────────────────────────────────────────────────

export function slugifyBranch(story: string): string {
  return (
    'hexora/' +
    story
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40)
      .replace(/-+$/, '')
  );
}

export function guessFilePath(story: string, lang: string): string {
  const s = story.toLowerCase();
  const l = lang.toLowerCase();
  if (l === 'java'       || s.includes('java'))              return 'src/Main.java';
  if (l === 'python'     || l === 'py' || s.includes('python')) return 'src/main.py';
  if (l === 'tsx'        || l === 'jsx')                     return 'src/App.tsx';
  if (l === 'typescript' || l === 'ts')                      return 'src/index.ts';
  if (l === 'javascript' || l === 'js')                      return 'src/index.js';
  if (l === 'go'         || / go\b/.test(s))                 return 'src/main.go';
  if (l === 'rust'       || s.includes('rust'))              return 'src/main.rs';
  if (l === 'kotlin'     || s.includes('kotlin'))            return 'src/Main.kt';
  if (l === 'csharp'     || l === 'cs'  || s.includes('c#')) return 'src/Program.cs';
  if (l === 'sql')                                           return 'db/migration.sql';
  if (l === 'bash'       || l === 'sh')                      return 'scripts/run.sh';
  return `src/implementation.${l || 'txt'}`;
}

export function guessInfraFilePath(): string {
  return 'infra/main.tf';
}

/**
 * Verifica se um arquivo já existe na branch.
 * Retorna true se existir, false se não existir.
 */
export async function fileExistsInBranch(
  token: string,
  repo: string,
  path: string,
  branch: string,
): Promise<boolean> {
  try {
    await ghFetch(token, `/repos/${repo}/contents/${path}?ref=${branch}`);
    return true;
  } catch {
    return false;
  }
}

export function guessTestFilePath(story: string, lang: string): string {
  const s = story.toLowerCase();
  const l = lang.toLowerCase();
  if (l === 'java'       || s.includes('java'))              return 'src/test/MainTest.java';
  if (l === 'python'     || l === 'py' || s.includes('python')) return 'tests/test_main.py';
  if (l === 'tsx'        || l === 'ts' || l === 'typescript') return 'src/__tests__/index.test.ts';
  if (l === 'javascript' || l === 'js')                      return 'src/__tests__/index.test.js';
  if (l === 'go'         || / go\b/.test(s))                 return 'src/main_test.go';
  if (l === 'kotlin'     || s.includes('kotlin'))            return 'src/test/MainTest.kt';
  return `tests/test.${l || 'txt'}`;
}

/** Extrai blocos de código markdown: ```lang\ncode\n``` */
export function extractCodeBlocks(text: string): { lang: string; code: string }[] {
  const blocks: { lang: string; code: string }[] = [];
  const re = /```(\w*)\n([\s\S]+?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    blocks.push({ lang: m[1] || 'text', code: m[2] });
  }
  if (blocks.length === 0 && text.trim()) {
    blocks.push({ lang: 'text', code: text.trim() });
  }
  return blocks;
}

// ── Low-level GitHub calls ────────────────────────────────────────────────────

async function getDefaultBranch(token: string, repo: string): Promise<string> {
  const data = await ghFetch<{ default_branch: string }>(token, `/repos/${repo}`);
  return data.default_branch ?? 'main';
}

async function getBranchSHA(token: string, repo: string, branch: string): Promise<string> {
  const data = await ghFetch<{ object: { sha: string } }>(token, `/repos/${repo}/git/ref/heads/${branch}`);
  return data.object.sha;
}

async function createBranch(token: string, repo: string, branch: string, sha: string): Promise<void> {
  await ghFetch(token, `/repos/${repo}/git/refs`, 'POST', {
    ref: `refs/heads/${branch}`,
    sha,
  });
}

async function upsertFile(
  token: string, repo: string, path: string,
  content: string, branch: string, message: string,
): Promise<void> {
  const b64 = btoa(unescape(encodeURIComponent(content)));
  let existingSha: string | undefined;
  try {
    const existing = await ghFetch<{ sha: string }>(token, `/repos/${repo}/contents/${path}?ref=${branch}`);
    existingSha = existing.sha;
  } catch { /* file doesn't exist yet */ }

  await ghFetch(token, `/repos/${repo}/contents/${path}`, 'PUT', {
    message,
    content: b64,
    branch,
    ...(existingSha ? { sha: existingSha } : {}),
  });
}

// ── High-level API ────────────────────────────────────────────────────────────

/**
 * Cria a branch de feature uma única vez.
 * Chamado antes do primeiro commit — os agentes seguintes reusam o mesmo contexto.
 */
export async function prepareBranch(
  token: string,
  repo: string,
  story: string,
  baseBranch?: string,
): Promise<BranchContext> {
  const base = baseBranch || await getDefaultBranch(token, repo);

  let sha: string;
  try {
    sha = await getBranchSHA(token, repo, base);
  } catch {
    // Repo is likely empty (no commits) — bootstrap with an initial commit
    await upsertFile(token, repo, 'README.md', `# ${repo.split('/').pop()}\n\nBootstrapped by Hexora.\n`, base, 'chore: initial commit [hexora]');
    sha = await getBranchSHA(token, repo, base);
  }

  const branch = slugifyBranch(story);
  try {
    await createBranch(token, repo, branch, sha);
  } catch (err) {
    const msg = (err as Error).message ?? '';
    if (!msg.includes('Reference already exists')) throw err;
    // Branch already exists from a previous run — reuse it
  }
  return { token, repo, branch, base };
}

/**
 * Commita um arquivo na branch já criada.
 * Pode ser chamado por dev-back, dev-front, qa — todos na mesma branch.
 */
export async function commitToBranch(
  ctx: BranchContext,
  filePath: string,
  code: string,
  agentRole: string,
): Promise<void> {
  const message = `feat(${agentRole.toLowerCase()}): ${filePath} [hexora]`;
  await upsertFile(ctx.token, ctx.repo, filePath, code, ctx.branch, message);
}

/**
 * Abre o PR com o contexto completo da equipe no corpo.
 * Retorna a URL do PR criado.
 */
export async function openPR(
  ctx: BranchContext,
  story: string,
  agentResults: { role: string; result: string }[],
): Promise<string> {
  // Check if a PR already exists for this branch
  try {
    const existing = await ghFetch<{ html_url: string }[]>(
      ctx.token,
      `/repos/${ctx.repo}/pulls?head=${ctx.repo.split('/')[0]}:${ctx.branch}&state=open`,
    );
    if (existing.length > 0) {
      return existing[0].html_url; // reuse existing PR
    }
  } catch { /* continue to create */ }

  const body = [
    `## História\n> ${story}`,
    '',
    '## Análise da equipe',
    ...agentResults.map((r) => `**${r.role}:** ${r.result}`),
    '',
    '---',
    '_Entregue automaticamente pelo **Hexora** — AgentOS_',
  ].join('\n');

  const data = await ghFetch<{ html_url: string }>(
    ctx.token, `/repos/${ctx.repo}/pulls`, 'POST',
    {
      title: `feat: ${story.slice(0, 72)}`,
      body,
      head: ctx.branch,
      base: ctx.base,
    },
  );
  return data.html_url;
}
