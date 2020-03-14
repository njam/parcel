// @flow

import type {RawParcelConfig, InitialParcelOptions} from '@parcel/types';
import {BuildError} from '@parcel/core';
import {NodePackageManager} from '@parcel/package-manager';
import {NodeFS} from '@parcel/fs';
import ThrowableDiagnostic from '@parcel/diagnostic';
import {prettyDiagnostic} from '@parcel/utils';

require('v8-compile-cache');

function logUncaughtError(e: mixed) {
  if (e instanceof ThrowableDiagnostic) {
    for (let diagnostic of e.diagnostics) {
      let out = prettyDiagnostic(diagnostic);
      console.error(out.message);
      console.error(out.codeframe || out.stack);
      for (let h of out.hints) {
        console.error(h);
      }
    }
  } else {
    console.error(e);
  }
}

process.on('unhandledRejection', (reason: mixed) => {
  logUncaughtError(reason);
  process.exit(1);
});

const chalk = require('chalk');
const program = require('commander');
const path = require('path');
const getPort = require('get-port');
const version = require('../package.json').version;

// Capture the NODE_ENV this process was launched with, so that it can be
// used in Parcel (such as in process.env inlining).
const initialNodeEnv = process.env.NODE_ENV;
// Then, override NODE_ENV to be PARCEL_BUILD_ENV (replaced with `production` in builds)
// so that dependencies of Parcel run in the appropriate mode.
if (typeof process.env.PARCEL_BUILD_ENV === 'string') {
  process.env.NODE_ENV = process.env.PARCEL_BUILD_ENV;
}

program.version(version);

// --no-cache, --cache-dir, --no-source-maps, --no-autoinstall, --global?, --public-url, --log-level
// --no-content-hash, --experimental-scope-hoisting, --detailed-report

const commonOptions = {
  '--no-cache': 'disable the filesystem cache',
  '--cache-dir <path>': 'set the cache directory. defaults to ".parcel-cache"',
  '--no-source-maps': 'disable sourcemaps',
  '--no-autoinstall': 'disable autoinstall',
  '--target [name]': [
    'only build given target(s)',
    (val, list) => list.concat([val]),
    [],
  ],
  '--log-level <level>': [
    'set the log level, either "none", "error", "warn", "info", or "verbose".',
    /^(none|error|warn|info|verbose)$/,
  ],
  '--profile': 'enable build profiling',
  '-V, --version': 'output the version number',
};

var hmrOptions = {
  '--no-hmr': 'disable hot module replacement',
  '--https': 'serves files over HTTPS',
  '--cert <path>': 'path to certificate to use with HTTPS',
  '--key <path>': 'path to private key to use with HTTPS',
};

function applyOptions(cmd, options) {
  for (let opt in options) {
    cmd.option(
      opt,
      ...(Array.isArray(options[opt]) ? options[opt] : [options[opt]]),
    );
  }
}

let serve = program
  .command('serve [input...]')
  .description('starts a development server')
  .option(
    '-p, --port <port>',
    'set the port to serve on. defaults to 1234',
    parseInt,
  )
  .option('--public-url <url>', 'the path prefix for absolute urls')
  .option(
    '--host <host>',
    'set the host to listen on, defaults to listening on all interfaces',
  )
  .option(
    '--open [browser]',
    'automatically open in specified browser, defaults to default browser',
  )
  .option('--watch-for-stdin', 'exit when stdin closes')
  .action(run);

applyOptions(serve, hmrOptions);
applyOptions(serve, commonOptions);

let watch = program
  .command('watch [input...]')
  .description('starts the bundler in watch mode')
  .option(
    '--dist-dir <dir>',
    'output directory to write to when unspecified by targets',
  )
  .option('--public-url <url>', 'the path prefix for absolute urls')
  .option('--watch-for-stdin', 'exit when stdin closes')
  .action(run);

applyOptions(watch, hmrOptions);
applyOptions(watch, commonOptions);

let build = program
  .command('build [input...]')
  .description('bundles for production')
  .option('--no-minify', 'disable minification')
  .option('--no-scope-hoist', 'disable scope-hoisting')
  .option('--public-url <url>', 'the path prefix for absolute urls')
  .option(
    '--dist-dir <dir>',
    'Output directory to write to when unspecified by targets',
  )
  .action(run);

applyOptions(build, commonOptions);

program
  .command('help [command]')
  .description('display help information for a command')
  .action(function(command) {
    let cmd = program.commands.find(c => c.name() === command) || program;
    cmd.help();
  });

program.on('--help', function() {
  console.log('');
  console.log(
    '  Run `' +
      chalk.bold('parcel help <command>') +
      '` for more information on specific commands',
  );
  console.log('');
});

// Make serve the default command except for --help
var args = process.argv;
if (args[2] === '--help' || args[2] === '-h') args[2] = 'help';
if (!args[2] || !program.commands.some(c => c.name() === args[2])) {
  args.splice(2, 0, 'serve');
}

program.parse(args);

async function run(entries: Array<string>, command: any) {
  entries = entries.map(entry => path.resolve(entry));

  if (entries.length === 0) {
    console.log('No entries found');
    return;
  }
  let Parcel = require('@parcel/core').default;
  let packageManager = new NodePackageManager(new NodeFS());
  let defaultConfig: RawParcelConfig = await packageManager.require(
    '@parcel/config-default',
    __filename,
  );
  let parcel = new Parcel({
    entries,
    packageManager,
    defaultConfig: {
      ...defaultConfig,
      filePath: (await packageManager.resolve(
        '@parcel/config-default',
        __filename,
      )).resolved,
    },
    patchConsole: true,
    ...(await normalizeOptions(command)),
  });

  if (command.name() === 'watch' || command.name() === 'serve') {
    let {unsubscribe} = await parcel.watch(err => {
      if (err) {
        throw err;
      }
    });

    let isExiting;
    const exit = async () => {
      if (isExiting) {
        return;
      }

      isExiting = true;
      await unsubscribe();
      process.exit();
    };

    if (command.watchForStdin) {
      process.stdin.on('end', async () => {
        console.log('STDIN closed, ending');

        await exit();
      });
      process.stdin.resume();
    }

    // Detect the ctrl+c key, and gracefully exit after writing the asset graph to the cache.
    // This is mostly for tools that wrap Parcel as a child process like yarn and npm.
    //
    // Setting raw mode prevents SIGINT from being sent in response to ctrl-c:
    // https://nodejs.org/api/tty.html#tty_readstream_setrawmode_mode
    //
    // We don't use the SIGINT event for this because when run inside yarn, the parent
    // yarn process ends before Parcel and it appears that Parcel has ended while it may still
    // be cleaning up. Handling events from stdin prevents this impression.
    if (process.stdin.isTTY) {
      // $FlowFixMe
      process.stdin.setRawMode(true);
      require('readline').emitKeypressEvents(process.stdin);

      process.stdin.on('keypress', async (char, key) => {
        if (key.ctrl && key.name === 'c') {
          await exit();
        }
      });
    }

    // In non-tty cases, respond to SIGINT by cleaning up.
    process.on('SIGINT', exit);
    process.on('SIGTERM', exit);
  } else {
    try {
      await parcel.run();
    } catch (e) {
      // If an exception is thrown during Parcel.build, it is given to reporters in a
      // buildFailure event, and has been shown to the user.
      if (!(e instanceof BuildError)) {
        logUncaughtError(e);
      }
      process.exit(1);
    }
  }
}

async function normalizeOptions(command): Promise<InitialParcelOptions> {
  let nodeEnv;
  if (command.name() === 'build') {
    nodeEnv = initialNodeEnv || 'production';
  } else {
    nodeEnv = initialNodeEnv || 'development';
  }

  let https = !!command.https;
  if (command.cert && command.key) {
    https = {
      cert: command.cert,
      key: command.key,
    };
  }

  let serve = false;
  if (command.name() === 'serve') {
    let {port = 1234, host, publicUrl} = command;
    port = await getPort({port, host});

    if (command.port && port !== command.port) {
      // Parcel logger is not set up at this point, so just use native console.
      console.warn(
        chalk.bold.yellowBright(`⚠️  Port ${command.port} could not be used.`),
      );
    }

    serve = {
      https,
      port,
      host,
      publicUrl,
    };
  }

  let hmr = false;
  if (command.name() !== 'build' && command.hmr !== false) {
    hmr = true;
  }

  let mode = command.name() === 'build' ? 'production' : 'development';
  return {
    disableCache: command.cache === false,
    cacheDir: command.cacheDir,
    mode,
    minify: command.minify != null ? command.minify : mode === 'production',
    sourceMaps: command.sourceMaps ?? true,
    scopeHoist: command.scopeHoist,
    publicUrl: command.publicUrl,
    distDir: command.distDir,
    hot: hmr,
    serve,
    targets: command.target.length > 0 ? command.target : null,
    autoinstall: command.autoinstall ?? true,
    logLevel: command.logLevel,
    profile: command.profile,
    env: {
      NODE_ENV: nodeEnv,
    },
  };
}
