// eslint-disable-next-line no-unused-vars
import {h} from 'preact';
import {useState, useEffect} from 'preact/hooks';
import {memo} from 'preact/compat';
import {ctrlKey} from '../utils.js';
import renderGraph from '../graphs/index.js';

export function ParcelError({error}) {
  return (
    <Box class="error" header={<span>A build error occured:</span>}>
      {error.map(v => `${v.origin}: ${v.message}`).join('\n')}
    </Box>
  );
}

export function Box(props) {
  return (
    <div class={`file ${props.class || ''}`}>
      {props.header && <div class="header">{props.header}</div>}
      <div class="content">{props.children}</div>
    </div>
  );
}

export function Notes() {
  return (
    <Box class="notes">
      Hotkeys:
      <ul>
        <li> {ctrlKey} + (B or Enter): Bundle</li>
        <li> {ctrlKey} + S: Download ZIP of input (& output)</li>
      </ul>
      Note:
      <ul>
        <li>
          PostHTML&apos;s <code>removeUnusedCss</code> is disabled for a smaller
          bundle size
        </li>
      </ul>
      Known issues:
      <ul>
        <li>
          Bundle loaders (async import, importing CSS in JS) lock up the
          bundler, caused by Parcel&apos;s <code>require.resolve</code> handling
        </li>
        <li>
          Currently patching <code>sass</code> because of{' '}
          <a href="https://github.com/mbullington/node_preamble.dart/issues/14">
            this issue
          </a>
        </li>
        <li>
          Currently patching <code>htmlnano</code> because its{' '}
          <code>require</code> calls aren&apos;t statically analyzeable
        </li>
      </ul>
    </Box>
  );
}

function toDataURI(mime, data) {
  return `data:${mime};charset=utf-8;base64,${btoa(data)}`;
}

const Graphs = memo(function Graphs({graphs}) {
  let [rendered, setRendered] = useState();

  useEffect(async () => {
    let render = await renderGraph();
    setRendered(
      await Promise.all(
        graphs.map(async ({name, content}) => ({
          name,
          content: /*toDataURI*/ ('image/svg+xml', await render(content)),
        })),
      ),
    );
  }, [graphs]);

  return (
    <Box header="Graphs (will open in a new tab)">
      <ul>
        {rendered &&
          rendered.map(({name, content}, i) => (
            <li key={i}>
              <button
                onClick={() => {
                  var win = window.open();
                  win.document.write(content);
                  // win.document.write(
                  //   '<iframe src="' +
                  //     content +
                  //     '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>',
                  // );
                }}
              >
                {name}
              </button>
            </li>
          ))}
      </ul>
    </Box>
  );
});
export {Graphs};

export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
