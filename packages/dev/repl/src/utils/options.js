// @flow
import type {PackageJSON} from '@parcel/types';

export type REPLOptions = {|
  minify: boolean,
  scopeHoist: boolean,
  sourceMaps: boolean,
  publicUrl: string,
  targetType: 'node' | 'browsers',
  targetEnv: null | string,
  outputFormat: null | 'esmodule' | 'commonjs' | 'global',
  showGraphs: boolean,
|};

export function getDefaultTargetEnv(
  type: $ElementType<REPLOptions, 'targetType'>,
) {
  switch (type) {
    case 'node':
      return '10';
    case 'browsers':
      return 'since 2017';
    default:
      throw new Error(`Missing default target env for ${type}`);
  }
}

export function generatePackageJson(options: REPLOptions) {
  let app = {};
  if (options.outputFormat) {
    app.outputFormat = options.outputFormat;
  }

  let pkg: PackageJSON = {
    name: 'repl',
    version: '0.0.0',
    engines: {
      [(options.targetType: string)]:
        options.targetEnv || getDefaultTargetEnv(options.targetType),
    },
    targets: {
      app,
    },
  };

  return JSON.stringify(pkg, null, 2);
}
