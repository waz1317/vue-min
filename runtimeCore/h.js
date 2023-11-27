import { createVNode } from "./vnode.js";

export function h(type, props, children) {
  return createVNode(type, props, children);
}
