import { readFileSync } from 'node:fs'

type JsonObject = Record<string, unknown>

type CommandLookup = {
  command: string
  path: string[]
}

type BlockMatch = {
  display: string
  executable?: string
}

const HOOK_NAME = 'block-node-modules-bin'
const HOOK_EVENT = 'PreToolUse'
const REPLACEMENT_GUIDANCE =
  'Use pnpm exec, pnpm dlx, or pnpm run so the package manager resolves project binaries.'

const NODE_MODULES_BIN = /(^|[\s;&|(<])((?:\.\/)?node_modules\/\.bin\/([^\s;&|)]+))/u
const ABSOLUTE_NODE_MODULES_BIN = /((?:[^\s;&|)]*\/)?node_modules\/\.bin\/([^\s;&|)]+))/u

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined
}

function getNested(payload: JsonObject, path: string[]): unknown {
  let current: unknown = payload

  for (const key of path) {
    const object = asObject(current)
    if (!object) {
      return undefined
    }

    current = object[key]
  }

  return current
}

function commandFromPayload(payload: JsonObject): CommandLookup | undefined {
  const candidates = [
    ['tool_input', 'command'],
    ['tool_input', 'cmd'],
    ['input', 'command'],
    ['input', 'cmd'],
    ['arguments', 'command'],
    ['arguments', 'cmd'],
  ]

  for (const path of candidates) {
    const value = getNested(payload, path)
    if (typeof value === 'string') {
      return { command: value, path }
    }
  }

  return undefined
}

function findBlockMatch(command: string): BlockMatch | undefined {
  const relativeMatch = NODE_MODULES_BIN.exec(command)
  if (relativeMatch) {
    return {
      display: relativeMatch[2],
      executable: relativeMatch[3],
    }
  }

  const absoluteMatch = ABSOLUTE_NODE_MODULES_BIN.exec(command)
  if (absoluteMatch) {
    return {
      display: absoluteMatch[1].replace(/^.*\/node_modules\//u, 'node_modules/'),
      executable: absoluteMatch[2],
    }
  }

  return undefined
}

function replacementExample(executable?: string): string {
  if (!executable) {
    return 'pnpm exec <binary> [args]'
  }

  return `pnpm exec ${executable} [args]`
}

function deny(match: BlockMatch): void {
  const reason = [
    'Blocked direct execution of a binary inside node_modules.',
    `Matched path: ${match.display}`,
    REPLACEMENT_GUIDANCE,
    `Typical replacement: ${replacementExample(match.executable)}`,
    'If this command is a package script, prefer pnpm run <script> instead.',
  ].join(' ')

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: HOOK_EVENT,
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })}\n`,
  )
}

function writeDiagnostic(message: string): void {
  process.stderr.write(`[${HOOK_NAME}] ${message}\n`)
}

function help(): void {
  process.stdout.write(
    `${JSON.stringify(
      {
        name: HOOK_NAME,
        type: 'codex-hook',
        event: HOOK_EVENT,
        runner: 'npx tsx',
        command: 'npx tsx /Users/renehernandez/.agents/hooks/block-node-modules-bin.ts',
        description:
          'Denies shell commands that execute binaries through node_modules/.bin directly.',
        purpose:
          'Keep agent shell commands package-manager mediated so pnpm controls binary resolution and dependency policy.',
        usage: [
          'npx tsx /Users/renehernandez/.agents/hooks/block-node-modules-bin.ts',
          'npx tsx /Users/renehernandez/.agents/hooks/block-node-modules-bin.ts --help',
        ],
        blocks: [
          './node_modules/.bin/<binary>',
          'node_modules/.bin/<binary>',
          '/absolute/path/to/node_modules/.bin/<binary>',
        ],
        allowInstead: ['pnpm exec <binary> [args]', 'pnpm dlx <package> [args]', 'pnpm run <script>'],
        payloadCommandPaths: [
          'tool_input.command',
          'tool_input.cmd',
          'input.command',
          'input.cmd',
          'arguments.command',
          'arguments.cmd',
        ],
      },
      null,
      2,
    )}\n`,
  )
}

function main(): void {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    help()
    return
  }

  let rawPayload = ''
  try {
    rawPayload = readFileSync(0, 'utf8')
  } catch (error) {
    writeDiagnostic(`Could not read Codex hook payload from stdin: ${(error as Error).message}`)
    return
  }

  if (!rawPayload.trim()) {
    writeDiagnostic('No stdin payload received. Codex hooks normally provide JSON on stdin.')
    return
  }

  let payload: JsonObject
  try {
    payload = JSON.parse(rawPayload) as JsonObject
  } catch (error) {
    writeDiagnostic(`Could not parse Codex hook payload as JSON: ${(error as Error).message}`)
    return
  }

  const lookup = commandFromPayload(payload)
  if (!lookup) {
    writeDiagnostic('No shell command found in supported payload fields; allowing command.')
    return
  }

  const match = findBlockMatch(lookup.command)
  if (match) {
    deny(match)
  }
}

main()
