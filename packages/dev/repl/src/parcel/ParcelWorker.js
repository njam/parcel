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

  const resultFromReporter = new Promise((res, rej) => {
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
          res(d);
          break;
        case 'buildFailure': {
          // console.log(`❗️`, d);
          rej(d.message);
          break;
        }
      }
    };
    globalThis.PARCEL_JSON_LOGGER_STDERR = globalThis.PARCEL_JSON_LOGGER_STDOUT;
  });

  // $FlowFixMe
  globalThis.fs = fs;

  // TODO only create new instance if options/entries changed
  let entries = assets.filter(v => v.isEntry).map(v => `/${v.name}`);
  const b = new Parcel({
    entries,
    disableCache: true,
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

  let packageJson = {
    engines: {
      [options.targetType]:
        options.targetEnv || getDefaultTargetEnv(options.targetType),
    },
  };
  await fs.writeFile('/package.json', JSON.stringify(packageJson));

  await fs.mkdirp('/');
  for (let {name, content} of assets) {
    await fs.writeFile(`/${name}`, content);
  }
  await fs.rimraf(`/dist`);

  try {
    await b.run();
  } catch (_) {
    // we get the error from PARCEL_JSON_LOGGER_STDOUT
  }

  try {
    let {buildTime, bundles} = await resultFromReporter;
    let bundleContents = [];
    for (let {filePath, size, time} of bundles) {
      bundleContents.push({
        name: filePath.replace(/^\/dist\//, ''),
        content: await fs.readFile(filePath, 'utf8'),
        size,
        time,
      });
    }

    return {bundles: bundleContents, graphs, buildTime};
  } catch (error) {
    return {error};
  }
}
