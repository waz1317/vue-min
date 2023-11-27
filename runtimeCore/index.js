import { createVNode, createTextVNode } from "./vnode.js";
import { render } from "./renderer.js";
import { h } from "./h.js";
export {
  registerRuntimeCompiler,
  registerComponent,
  components,
} from "./component.js";

export { h, createTextVNode, render };
