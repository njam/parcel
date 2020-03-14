// @flow
import {expose} from 'comlink';
import Parcel from '@parcel/core';
// import SimplePackageInstaller from './SimplePackageInstaller';
// import {NodePackageManager} from '@parcel/package-manager';
// import {prettifyTime} from '@parcel/utils';
import fs from '../../fs.js';
import workerFarm from '../../workerFarm.js';
import {getDefaultTargetEnv} from '../utils.js';
import defaultConfig from '@parcel/config-repl';

expose({
  bundle,
  ready: new Promise(res => workerFarm.once('ready', () => res())),
});

const PathUtils = {
  SRC_DIR: '/app/src',
  SRC_REGEX: /^\/app\/src\//,
  DIST_DIR: '/app/dist',
  DIST_REGEX: /^\/app\/dist\//,
  CACHE_DIR: '/.parcel-cache',
  addSrc(v) {
    return `${PathUtils.SRC_DIR}/${v}`;
  },
  removeSrc(v) {
    return v.replace(PathUtils.SRC_REGEX, '');
  },
  removeDist(v) {
    return v.replace(PathUtils.DIST_REGEX, '');
  },
};

async function bundle(
  assets: Array<{|name: string, content: string, isEntry?: boolean|}>,
  options: {|
    minify: boolean,
    scopeHoist: boolean,
    sourceMaps: boolean,
    publicUrl: string,
    targetType: string,
    targetEnv: ?string,
    showGraphs: boolean,
  |},
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
    .map(v => PathUtils.addSrc(v.name));
  const b = new Parcel({
    entries,
    disableCache: true,
    cacheDir: PathUtils.CACHE_DIR,
    mode: 'production',
    minify: options.minify,
    logLevel: 'verbose',
    defaultConfig: {
      ...defaultConfig,
      filePath: '<noop>',
    },
    hot: false,
    inputFS: fs,
    outputFS: fs,
    patchConsole: false,
    publicUrl: options.publicUrl || undefined,
    scopeHoist: options.scopeHoist,
    workerFarm,
    // packageManager: new NodePackageManager(
    //   memFS,
    //   new SimplePackageInstaller(memFS),
    // ),
    defaultEngines: {
      browsers: ['>= 0.25%'],
      node: '8',
    },
  });

  await fs.mkdirp(PathUtils.SRC_DIR);
  let packageJson = {
    engines: {
      [options.targetType]:
        options.targetEnv || getDefaultTargetEnv(options.targetType),
    },
  };
  await fs.writeFile(
    PathUtils.addSrc('package.json'),
    JSON.stringify(packageJson),
  );

  for (let {name, content} of assets) {
    await fs.writeFile(PathUtils.addSrc(name), content);
  }
  await fs.rimraf(PathUtils.DIST_DIR);

  try {
    await b.run();

    let output = await resultFromReporter;
    if (output.success) {
      let bundleContents = [];
      for (let {filePath, size, time} of output.success.bundles) {
        bundleContents.push({
          name: PathUtils.removeDist(filePath),
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
        diagnostic.filePath = PathUtils.removeSrc(diagnostic.filePath);
      }
      return {type: 'failure', diagnostics: output.failure};
    }
  } catch (error) {
    console.error(error);
    console.error(error.diagnostics);
    for (let diagnostic of error.diagnostics) {
      if (diagnostic.filePath)
        diagnostic.filePath = PathUtils.removeSrc(diagnostic.filePath);
    }
    return {type: 'failure', error: error, diagnostics: error.diagnostics};
  }
}
