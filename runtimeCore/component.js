import { initProps } from "./componentProps.js";
import { shallowReactive } from "../reactivity/index.js";
import { emit } from "./componentEmit.js";

//组件列表
export const components = new Map();

export function registerComponent(component) {
  const currentComponent = components.get(component.name);
  //如果组件已存在则报错
  if (currentComponent) {
    new Error(`组件${component.name}已存在`);
  } else {
    components.set(component.name, component);
  }
}

//创建组件实例
export function createComponentInstance(vnode) {
  const component = {
    vnode,
    type: vnode.type,
    ctx: {},
    isMounted: false,
    subTree: {},
    emit: () => {},
  };
  component.emit = emit.bind(null, component);

  return component;
}

export function setupComponent(instance) {
  //初始化props
  initProps(instance, instance.vnode.props);
  //初始化组件
  setupStatefulComponent(instance);
}

//解析出setup对象
function setupStatefulComponent(instance) {
  const Component = instance.vnode.type;

  //ctx

  instance.proxy = new Proxy(instance.ctx, {
    get(target, key) {
      const { setupState, props } = instance;
      //如果setup没有这个属性则去props找
      if (key in setupState) {
        //如果是访问ref  则返回value值
        if (setupState[key]["__v_isRef"]) return setupState[key].value;
        else return setupState[key];
      } else if (key in props) {
        return props[key];
      }
      if (key === "$el") return instance.vnode.el;
    },
  });

  const { setup } = Component;

  if (setup) {
    const setupResult = setup(shallowReactive(instance.props), {
      emit: instance.emit,
    });
    handleSetupResult(instance, setupResult);
  }
}

//setup结果处理
function handleSetupResult(instance, setupResult) {
  if (typeof setupResult === "object") {
    instance.setupState = setupResult;
  }

  finishComponentSetup(instance);
}

function finishComponentSetup(instance) {
  const Component = instance.type;

  if (compiler && !Component.render) {
    if (Component.template) {
      Component.render = compiler(Component.template);
    }
  }
  instance.render = Component.render;
}

let compiler;
export function registerRuntimeCompiler(_compiler) {
  compiler = _compiler;
}
