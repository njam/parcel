// eslint-disable-next-line no-unused-vars
import {h} from 'preact';
import {getDefaultTargetEnv} from '../utils';

export default function Options({values, onChange, hasConfig}) {
  return (
    <div class="options file">
      <label title="Sets `--no-minify`">
        <span>Minify</span>
        <input
          type="checkbox"
          checked={values.minify}
          onChange={e => onChange('minify', e.target.checked)}
        />
      </label>
      <label title="Corresponds `--no-scope-hoist`">
        <span>Enable Scope Hoisting</span>
        <input
          type="checkbox"
          checked={values.scopeHoist}
          onChange={e => onChange('scopeHoist', e.target.checked)}
        />
      </label>
      <label title="Corresponds to `--no-source-maps`">
        <span>Source Maps</span>
        <input
          type="checkbox"
          checked={values.sourceMaps}
          onChange={e => onChange('sourceMaps', e.target.checked)}
        />
      </label>
      <label title="Sets `--public-url <value>`">
        <span>Public URL</span>
        <input
          type="text"
          value={values.publicUrl}
          placeholder="/"
          onInput={e => onChange('publicUrl', e.target.value)}
        />
      </label>
      <label>
        <span>Target</span>
        <div>
          <select
            onChange={e => {
              onChange('targetType', e.target.value);
              onChange('targetEnv', null);
            }}
            value={values.targetType}
            style={{marginRight: '0.5rem'}}
          >
            <option value="browsers">Browsers</option>
            <option value="node">Node</option>
          </select>
          <input
            type="text"
            value={values.targetEnv}
            onInput={e => onChange('targetEnv', e.target.value)}
            placeholder={getDefaultTargetEnv(values.targetType)}
          />
        </div>
      </label>
      <label title="env variable PARCEL_DUMP_GRAPHVIZ">
        <span>Render Graphs</span>
        <input
          type="checkbox"
          checked={values.showGraphs}
          onChange={e => onChange('showGraphs', e.target.checked)}
        />
      </label>
    </div>
  );
}
