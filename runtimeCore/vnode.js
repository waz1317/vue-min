export const Fragment = Symbol("Fragment");
export const Text = Symbol("Text");
export const Comment = Symbol("Comment");

export function createVNode(type, props, children) {
  const vnode = {
    type,
    children,
    setupState: {},
    el: null,
    props,
    key: props && props.key,
  };

  return vnode;
}

export function createTextVNode(text) {
  return createVNode(Text, {}, text);
}
