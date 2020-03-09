import {wrap} from 'comlink';

const worker = wrap(
  new Worker('./ParcelWorker.js', {name: 'Parcel Worker Main'}),
);
// const worker = {
//   ready: Promise.resolve(true),
//   bundle(assets) {
//     return {
//       assets,
//       graphs: [
//         {
//           name: "test",
//           content: `digraph graphname
// {
//     a -> b -> c;
//     b -> d;
// }`,
//         },
//       ],
//     };
//   },
// };

export const workerLoaded = worker.ready;

export function bundle(assets, options) {
  return worker.bundle(assets, options);
}
