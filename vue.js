export {
  reactive,
  ref,
  watch,
  coumputed,
  toRef,
  toRefs,
  shallowReactive,
  readonly,
  shallowReadonly,
} from "./reactivity/index.js";
import {
  h,
  createTextVNode,
  render,
  registerRuntimeCompiler,
  registerComponent,
  components,
} from "./runtimeCore/index.js";
import { baseComplie } from "./compiler-core/index.js";
import { createVNode, Comment, Text } from "./runtimeCore/vnode.js";
export { h, Comment, Text };

const componentList = components;
export function createApp(rootComponent) {
  return {
    mount(rootContainer) {
      //componetn=>vnoe
      //创建虚拟dom
      const vnode = createVNode(rootComponent);
      //渲染真实dom
      render(vnode, rootContainer);
    },
    registerComponent,
  };
}

const Vue = {
  toDisplayString(val) {
    return val.toString();
  },
  createElementVNode(type, props, children) {
    const component = componentList.get(type);
    if (component) type = component;
    const vnode = {
      el: null,
      component: null,
      key: props && props.key,
      type,
      props: props || {},
      children,
    };
    return vnode;
  },
  createCommentVNode(string) {
    return createVNode(Comment, {}, string);
  },
  renderList(arr, callback) {
    const nodeList = [];
    for (let i = 0; i < arr.length; i++) {
      nodeList.push(callback(arr[i], i));
    }
    return nodeList;
  },
};

function complieToFunction(template) {
  const { code } = baseComplie(template);
  console.log(code);
  const render = new Function("Vue", code)(Vue);
  return render;
}

registerRuntimeCompiler(complieToFunction);
