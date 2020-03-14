// @flow
import type {REPLOptions} from '../components/Options.js';

import {expose} from 'comlink';
import Parcel from '@parcel/core';
// import SimplePackageInstaller from './SimplePackageInstaller';
// import {NodePackageManager} from '@parcel/package-manager';
// import {prettifyTime} from '@parcel/utils';
import fs from '../../fs.js';
import workerFarm from '../../workerFarm.js';
import {generatePackageJson} from '../utils.js';
import defaultConfig from '@parcel/config-repl';

expose({
  bundle,
  ready: new Promise(res => workerFarm.once('ready', () => res())),
});

const PathUtils = {
  APP_DIR: '/app',
  DIST_DIR: '/app/dist',
  CACHE_DIR: '/.parcel-cache/',
  APP_REGEX: /^\/app\//,
  addAppDir(v) {
    return `${PathUtils.APP_DIR}/${v}`;
  },
  removeAppDir(v) {
    return v.replace(PathUtils.APP_REGEX, '');
  },
};

async function bundle(
  assets: Array<{|name: string, content: string, isEntry?: boolean|}>,
  options: REPLOptions,
) {
  let graphs = options.showGraphs && [];
  // $FlowFixMe
  globalThis.PARCEL_DUMP_GRAPHVIZ =
    graphs && ((name, content) => graphs.push({name, content}));

  const resultFromReporter = new Promise(res => {
    globalThis.PARCEL_JSON_LOGGER_STDOUT = d => {
      switch (d.type) {
        // case 'buildStart':
        //   console.log('📦 Started');
        //   break;
        // case 'buildProgress': {
        //   let phase = d.phase.charAt(0).toUpperCase() + d.phase.slice(1);
        //   let filePath = d.filePath || d.bundleFilePath;
        //   console.log(`🕓 ${phase} ${filePath ? filePath : ''}`);
        //   break;
        // }
        case 'buildSuccess':
          // console.log(`✅ Succeded in ${/* prettifyTime */ d.buildTime}`);
          // console.group('Output');
          // for (let {filePath} of d.bundles) {
          //   console.log(
          //     '%c%s:\n%c%s',
          //     'font-weight: bold',
          //     filePath,
          //     'font-family: monospace',
          //     await memFS.readFile(filePath, 'utf8'),
          //   );
          // }
          // console.groupEnd();
          res({success: d});
          break;
        case 'buildFailure': {
          // console.log(`❗️`, d);
          res({failure: d.message});
          break;
        }
      }
    };
    globalThis.PARCEL_JSON_LOGGER_STDERR = globalThis.PARCEL_JSON_LOGGER_STDOUT;
  });

  // $FlowFixMe
  globalThis.fs = fs;

  // TODO only create new instance if options/entries changed
  let entries = assets
    .filter(v => v.isEntry)
    .map(v => PathUtils.addAppDir(v.name));
  const b = new Parcel({
    entries,
    disableCache: true,
    cacheDir: PathUtils.CACHE_DIR,
    distDir: PathUtils.DIST_DIR,
    mode: 'production',
    hot: false,
    logLevel: 'verbose',
    patchConsole: false,
    workerFarm,
    defaultConfig: {
      ...defaultConfig,
      filePath: '<noop>',
    },
    inputFS: fs,
    outputFS: fs,
    minify: options.minify,
    publicUrl: options.publicUrl || undefined,
    scopeHoist: options.scopeHoist,
    // packageManager: new NodePackageManager(
    //   memFS,
    //   new SimplePackageInstaller(memFS),
    // ),
  });

  await fs.rimraf(PathUtils.APP_DIR);
  await fs.mkdirp(PathUtils.APP_DIR);
  await fs.writeFile(
    PathUtils.addAppDir('package.json'),
    generatePackageJson(options),
  );
  await fs.writeFile(PathUtils.addAppDir('yarn.lock'), '');

  await fs.mkdirp(PathUtils.addAppDir('src'));
  for (let {name, content} of assets) {
    await fs.writeFile(PathUtils.addAppDir(name), content);
  }

  try {
    await b.run();

    let output = await resultFromReporter;
    if (output.success) {
      let bundleContents = [];
      for (let {filePath, size, time} of output.success.bundles) {
        bundleContents.push({
          name: PathUtils.removeAppDir(filePath),
          content: await fs.readFile(filePath, 'utf8'),
          size,
          time,
        });
      }

      return {
        type: 'success',
        bundles: bundleContents,
        buildTime: output.success.buildTime,
        graphs,
      };
    } else {
      for (let diagnostic of output.failure) {
        diagnostic.filePath = PathUtils.removeAppDir(diagnostic.filePath);
      }
      return {type: 'failure', diagnostics: output.failure};
    }
  } catch (error) {
    for (let diagnostic of error.diagnostics) {
      if (diagnostic.filePath)
        diagnostic.filePath = PathUtils.removeAppDir(diagnostic.filePath);
    }
    return {type: 'failure', error: error, diagnostics: error.diagnostics};
  }
}
