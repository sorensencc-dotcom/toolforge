import { MEMORY_KIND_NAMES } from '../../memory/entry.js';
import { memoryDbPath, openMemoryStore } from '../../memory/store.js';

function withStore(argv, action, work) {
  let store;
  try {
    store = openMemoryStore({ dbPath: memoryDbPath(argv.workspace) });
    work(store);
  } catch (error) {
    console.error(`✗ Failed to ${action} memory: ${error.message}`);
    process.exitCode = 1;
  } finally {
    store?.close();
  }
}

function formatEntry(entry) {
  const tags = entry.tags.map((tag) => ` #${tag}`).join('');
  return `${entry.id}  ${entry.updatedAt.slice(0, 10)}  [${entry.kind}] ${entry.text.replace(/\s+/g, ' ')}${tags}`;
}

const listCommand = {
  command: 'list',
  describe: 'List stored memory entries',
  builder: (yargs) =>
    yargs
      .option('kind', {
        describe: 'Only show entries of this kind',
        type: 'string',
        choices: MEMORY_KIND_NAMES,
      })
      .option('tag', {
        describe: 'Only show entries with this tag',
        type: 'string',
      })
      .option('json', {
        describe: 'Print entries as JSON',
        type: 'boolean',
        default: false,
      }),

  handler: (argv) =>
    withStore(argv, 'list', (store) => {
      const entries = store.list({ kind: argv.kind, tag: argv.tag });
      if (argv.json) {
        console.log(JSON.stringify(entries, null, 2));
        return;
      }
      if (entries.length === 0) {
        console.log('No memory entries found.');
        return;
      }
      entries.forEach((entry) => console.log(formatEntry(entry)));
    }),
};

const addCommand = {
  command: 'add <text>',
  describe: 'Store a memory entry',
  builder: (yargs) =>
    yargs
      .positional('text', {
        describe: 'Entry text',
        type: 'string',
      })
      .option('kind', {
        describe: 'Entry kind',
        type: 'string',
        choices: MEMORY_KIND_NAMES,
        default: 'fact',
      })
      .option('tag', {
        describe: 'Tag the entry (repeat for several tags)',
        type: 'string',
      })
      .option('source', {
        describe: 'Where the entry came from',
        type: 'string',
        default: 'cli',
      }),

  handler: (argv) =>
    withStore(argv, 'add', (store) => {
      const entry = store.add({ kind: argv.kind, text: argv.text, tags: [argv.tag ?? []].flat(), source: argv.source });
      console.log(`Stored ${entry.kind} ${entry.id}`);
    }),
};

const pruneCommand = {
  command: 'prune',
  describe: 'Remove memory entries by id, age, or kind',
  builder: (yargs) =>
    yargs
      .option('id', {
        describe: 'Remove the entry with this id',
        type: 'string',
      })
      .option('older-than', {
        describe: 'Remove entries not updated in this many days',
        type: 'number',
      })
      .option('kind', {
        describe: 'Remove entries of this kind',
        type: 'string',
        choices: MEMORY_KIND_NAMES,
      })
      .option('all', {
        describe: 'Remove every entry',
        type: 'boolean',
        default: false,
      })
      .option('dry-run', {
        describe: 'Show what would be removed without removing it',
        type: 'boolean',
        default: false,
      }),

  handler: (argv) =>
    withStore(argv, 'prune', (store) => {
      const removed = store.prune({
        id: argv.id,
        olderThanDays: argv.olderThan,
        kind: argv.kind,
        all: argv.all,
        dryRun: argv.dryRun,
      });
      const noun = removed.length === 1 ? 'entry' : 'entries';
      console.log(`${argv.dryRun ? 'Would remove' : 'Removed'} ${removed.length} memory ${noun}.`);
      removed.forEach((entry) => console.log(formatEntry(entry)));
    }),
};

export default {
  command: 'memory',
  describe: 'Manage the persistent cross-session memory store',
  builder: (yargs) =>
    yargs
      .option('workspace', {
        describe: 'Workspace root that holds .toolforge/memory.db',
        type: 'string',
        default: process.cwd(),
        defaultDescription: 'current directory',
      })
      .command(listCommand)
      .command(addCommand)
      .command(pruneCommand)
      .demandCommand(1, 'Choose a memory command: list, add, or prune.')
      .strictCommands(),

  handler: () => {},
};
