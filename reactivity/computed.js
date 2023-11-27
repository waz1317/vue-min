import { effect } from "./effect.js";
//computed实现
export function coumputed(getter) {
  let value;
  let dirty = true;

  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true;
      // trigger(obj,'value')
    },
  });

  const obj = {
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      // tarck(obj,'value')
      return value;
    },
  };
  return obj;
}
