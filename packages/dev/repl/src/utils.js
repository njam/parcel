// @flow
import type {PackageJSON} from '@parcel/types';
import type {REPLOptions} from './components/Options.js';
import type {Assets} from './';

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

export function nthIndex(str: string, pat: string, n: number) {
  var length = str.length,
    i = -1;
  while (n-- && i++ < length) {
    i = str.indexOf(pat, i);
    if (i < 0) break;
  }
  return i;
}

// export function hasBrowserslist(assets) {
//   const configExists = assets.some(
//     v => v.name === 'browserslist' || v.name === '.browserslistrc',
//   );
//   if (configExists) return true;

//   const pkg = assets.find(v => v.name.endsWith('package.json'));
//   try {
//     const configInPackage =
//       pkg && Boolean(JSON.parse(pkg.content).browserslist);
//     return configInPackage;
//   } catch (e) {
//     return false;
//   }
// }

// export function downloadBuffer(name, buf, mime = 'application/zip') {
//   const blob = new Blob([buf], {type: mime});
//   const el = document.createElement('a');
//   el.href = URL.createObjectURL(blob);
//   el.download = name;
//   el.click();
//   setTimeout(() => URL.revokeObjectURL(el.href), 1000);
// }

export const ctrlKey = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';

export function saveState(
  curPreset: string,
  options: REPLOptions,
  assets: Assets,
) {
  let data = {
    currentPreset: curPreset,
    options,
    assets: assets.map(({name, content, isEntry = false}) =>
      isEntry ? [name, content, 1] : [name, content],
    ),
  };

  window.location.hash = btoa(encodeURIComponent(JSON.stringify(data)));
}

export function loadState(): ?{|
  assets: Assets,
  options: REPLOptions,
  currentPreset: ?string,
|} {
  const hash = window.location.hash.replace(/^#/, '');

  try {
    const data = JSON.parse(decodeURIComponent(atob(hash)));
    data.assets = data.assets.map(([name, content, isEntry = false]) => ({
      name,
      content,
      isEntry: Boolean(isEntry),
    }));
    return data;
  } catch (e) {
    // eslint-disable-next-line no-console
    window.location.hash = '';
    return null;
  }
}

export const PRESETS = {
  Javascript: [
    {
      name: 'src/index.js',
      content: `import {Thing, x} from "./other.js";\nnew Thing().run();`,
      isEntry: true,
    },
    {
      name: 'src/other.js',
      content: `class Thing {\n  run() {\n    console.log("Test");\n  } \n}\n\nconst x = 123;\nexport {Thing, x};`,
    },
  ],
  Babel: [
    {
      name: 'src/index.js',
      content: `class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    toString() {
        return \`(\${this.x}, \${this.y})\`;
    }
}

console.log(new Point(1,2).toString());
`,
      isEntry: true,
    },
    {
      name: '.babelrc',
      content: `{ "presets": [["@babel/env", {"loose": true}]] }`,
    },
    // {
    //   name: 'src/package.json',
    //   content: `{\n "devDependencies": {\n  "@babel/core": "^7.3.4",\n  "@babel/preset-env": "^7.3.4"\n  }\n}`,
    // },
  ],
  'Basic Page': [
    {
      name: 'src/index.html',
      content: `<head>
  <link rel="stylesheet" type="text/css" href="./style.css">
</head>
<body>
  <a href="./other.html">Link</a>
  <script src="./index.js"></script>
</body>`,
      isEntry: true,
    },
    {
      name: 'src/index.js',
      content: `function func(){
 return "Hello World!";
}
document.body.append(document.createTextNode(func()))`,
    },
    {
      name: 'src/style.css',
      content: `body {\n  color: red;\n}`,
    },
    {
      name: 'src/other.html',
      content: 'This is a different page',
    },
    {
      name: '.htmlnanorc',
      content: `{\n  minifySvg: false\n}`,
    },
    {
      name: 'cssnano.config.js',
      content: `module.exports = {\n  preset: [\n    'default',\n    {\n      svgo: false\n    }\n  ]\n}`,
    },
  ],
  JSON: [
    {
      name: 'src/index.js',
      content: "import x from './test.json';\nconsole.log(x);",
      isEntry: true,
    },
    {name: 'src/test.json', content: '{a: 2, b: 3}'},
  ],
  Envfile: [
    {
      name: 'src/index.js',
      content: 'console.log(process.env.SOMETHING);',
      isEntry: true,
    },
    {name: '.env', content: 'SOMETHING=124'},
  ],
  Typescript: [
    {
      name: 'src/index.ts',
      content: `function greeter(person: string) {
    return "Hello, " + person;
}

let user = "Jane User";

document.body.innerHTML = greeter(user);`,
      isEntry: true,
    },
  ],
  //   Markdown: [
  //     {
  //       name: 'src/Article.md',
  //       content: '# My Title\n\nHello, ...\n\n```js\nconsole.log("test");\n```\n',
  //       isEntry: true,
  //     },
  //     {
  //       name: '.htmlnanorc',
  //       content: `{\n  minifySvg: false\n}`,
  //     },
  //   ],
  //   SCSS: [
  //     {
  //       name: 'src/style.scss',
  //       content: `$colorRed: red;
  // #header {
  //   margin: 0;
  //   border: 1px solid $colorRed;
  //   p {
  //     color: $colorRed;
  //     font: {
  //       size: 12px;
  //       weight: bold;
  //     }
  //   }
  //   a {
  //     text-decoration: none;
  //   }
  // }`,
  //       isEntry: true,
  //     },
  //     {
  //       name: 'cssnano.config.js',
  //       content: `module.exports = {\n  preset: [\n    'default',\n    {\n      svgo: false\n    }\n  ]\n}`,
  //     },
  //   ],
  //   LESS: [
  //     {
  //       name: 'src/style.less',
  //       content: `@some-color: #143352;

  // #header {
  //   background-color: @some-color;
  // }
  // h2 {
  //   color: @some-color;
  // }`,
  //       isEntry: true,
  //     },
  //     {
  //       name: 'cssnano.config.js',
  //       content: `module.exports = {\n  preset: [\n    'default',\n    {\n      svgo: false\n    }\n  ]\n}`,
  //     },
  //   ],
};
