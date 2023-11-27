import { effect } from "../reactivity/effect.js";
import { createComponentInstance, setupComponent } from "./component.js";
import { Text, Comment } from "./vnode.js";
import { watch } from "../reactivity/watch.js";
import { queueJob } from "../reactivity/reactive.js";

export function render(vnode, container) {
  patch(null, vnode, container, null);
}
//n1 老虚拟节点  n2 新虚拟节点
function patch(
  n1,
  n2,
  container = null,
  anchor = null,
  parentComponent = null
) {
  const { type } = n2;
  switch (type) {
    case "Fragment":
      processFragment(n1, n2, container, parentComponent);
      break;
    case Text:
      processText(n1, n2, container);
    case Comment:
      processComment(n1, n2, container);
    default:
      if (typeof n2.type === "string") {
        processElement(n1, n2, container, anchor, parentComponent);
      } else if (typeof n2.type === "object") {
        //处理组件
        processComponent(n1, n2, container, parentComponent);
      }
  }
}

//处理注释节点
function processComment(n1, n2, container, anchor) {
  const { children } = n2;
  const textNode = (n2.el = document.createComment(children));
  hostInsert(textNode, container, anchor);
}

//只处理文本
function processText(n1, n2, container) {
  const { children } = n2;
  const textNode = (n2.el = document.createTextNode(children));
  hostInsert(textNode, container);
}

//只处理children
function processFragment(n1, n2, container, anchor, parentComponent) {
  if (n1 === null) mountChildren(n2, container, parentComponent);
  else {
    patchChildren(n1, n2, container, anchor, parentComponent);
  }
}

//处理元素
function processElement(n1, n2, container, anchor, parentComponent) {
  //如果n1为空 则无旧节点  直接挂载否则走patch更新逻辑
  if (!n1) mountElement(n2, container, anchor, parentComponent);
  else patchElement(n1, n2, container, anchor, parentComponent);
}
function patchElement(n1, n2, container, anchor, parentComponent) {
  const oldProps = n1.props || {};
  const newProps = n2.props || {};
  const el = (n2.el = n1.el);
  patchProps(el, oldProps, newProps);
  patchChildren(n1, n2, el, anchor, parentComponent);
}

function patchChildren(n1, n2, container, anchor, parentComponent) {
  const { children: oldChildren } = n1;
  const { children: newChildren } = n2;
  if (typeof newChildren === "string") {
    if (oldChildren !== newChildren) {
      setElementText(container, newChildren);
    }
  } else if (Array.isArray(newChildren)) {
    if (Array.isArray(oldChildren)) {
      patchKeyedChildren(
        oldChildren,
        newChildren,
        container,
        anchor,
        parentComponent
      );
    } else {
      setElementText(container, "");
      mountChildren(n2, container, parentComponent);
    }
  } else {
    if (Array.isArray(oldChildren)) {
      oldChildren.forEach((child) => hostRemove(child.el));
    }
  }
}

//快速diff算法
function patchKeyedChildren(c1, c2, container, anchor, parentComponent) {
  //新children长度
  const l2 = c2.length;

  let i = 0;
  let e1 = c1.length - 1; //旧children尾索引
  let e2 = l2 - 1; //新children尾索引

  //判断相同节点
  function isSomeVNodeType(n1, n2) {
    return n1.type === n2.type && n1.key === n2.key;
  }
  //对比头
  while (i <= e1 && i <= e2) {
    const n1 = c1[i];
    const n2 = c2[i];

    //如果节点相同,递归patch  更新内部节点
    if (isSomeVNodeType(n1, n2)) {
      patch(n1, n2, container, null, parentComponent);
    } else {
      break;
    }

    i++;
  }
  //对比尾
  while (i <= e1 && i <= e2) {
    const n1 = c1[e1];
    const n2 = c2[e2];
    if (isSomeVNodeType(n1, n2)) {
      patch(n1, n2, container, null, parentComponent);
    } else break;
    e1--;
    e2--;
  }

  //有新节点
  if (i > e1 && i <= e2) {
    //获取新增节点的下一个元素的索引
    const nextPos = e2 + 1;
    //如果下一个节点存在 则插入到下一个节点的el前  否则直接插入
    const anchor = nextPos < l2 ? c2[nextPos].el : null;
    while (i <= e2) {
      patch(null, c2[i], container, anchor, parentComponent);
      i++;
    }
  } else if (i > e2 && i <= e1) {
    while (i <= e1) {
      hostRemove(c1[i].el);
      i++;
    }
  } else {
    //复杂情况
    //中间对比
    let s1 = i;
    let s2 = i;
    const toBePatched = e2 - s2 + 1;
    let patched = 0;
    const keyToNewIndexMap = new Map();
    const newIndexToOldIndexMap = new Array(toBePatched);
    let moved = 0;
    let maxNewIndexSoFar = 0;
    // 初始化为 0 , 后面处理的时候 如果发现是 0 的话，那么就说明新值在老的里面不存在
    for (let i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;

    //遍历新children 建立新节点映射表
    for (let i = s2; i <= e2; i++) {
      const nextChild = c2[i];
      keyToNewIndexMap.set(nextChild.key, i);
    }

    for (let i = s1; i <= e1; i++) {
      const prevChild = c1[i];

      if (patched >= toBePatched) {
        hostRemove(prevChild.el);
        continue;
      }
      let newIndex;
      //如果旧children中key不为null 则直接获取新children的索引
      if (prevChild.key !== null) {
        newIndex = keyToNewIndexMap.get(prevChild.key);
      } else {
        //但key为空,对比新children中是否存在相同的节点,获取索引
        for (let j = s2; j < e2; j++) {
          if (isSomeVNodeType(prevChild, c2[j])) {
            newIndex = j;
            break;
          }
        }
      }

      if (newIndex === undefined) {
        hostRemove(prevChild.el);
      } else {
        if (newIndex >= maxNewIndexSoFar) {
          maxNewIndexSoFar = newIndex;
        } else {
          moved = true;
        }
        newIndexToOldIndexMap[newIndex - s2] = i + 1;
        //如果新children中存在该节点,则更新
        patch(prevChild, c2[newIndex], container, null, parentComponent);
        patched++;
      }
    }
    //获取索引表的最长递增子序列
    const increasingNewIndexSequence = moved
      ? getSequence(newIndexToOldIndexMap)
      : [];

    let j = increasingNewIndexSequence.length - 1;
    for (let i = toBePatched - 1; i >= 0; i--) {
      const nextIndex = i + s2;
      const nextChild = c2[nextIndex];
      const anchor = nextIndex + 1 < l2 ? c2[nextIndex + 1].el : null;

      if (newIndexToOldIndexMap[i] === 0) {
        patch(null, nextChild, container, anchor, parentComponent);
      }

      if (moved) {
        if (j < 0 || i !== increasingNewIndexSequence[j]) {
          //移动位置
          hostInsert(nextChild.el, container, anchor);
        } else j--;
      }
    }
  }
}

//获取最长递增子序列
function getSequence(arr) {
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = (u + v) >> 1;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}

//设置文本节点
function setElementText(el, text) {
  el.textContent = text;
}

//卸载元素
function hostRemove(child) {
  const parent = child.parentNode;
  if (parent) {
    parent.removeChild(child);
  }
}

//插入节点
function hostInsert(child, parent, anchor = null) {
  parent.insertBefore(child, anchor);
}

//更新props
function patchProps(el, oldProps, newProps) {
  if (oldProps !== newProps) {
    for (const key in newProps) {
      const prevProp = oldProps[key];
      const nextProp = newProps[key];
      if (prevProp !== nextProp) {
        patchProp(el, key, prevProp, nextProp);
      }
    }
  }

  for (const key in oldProps) {
    if (!key in newProps) {
      patchProp(el, key, oldProps[key], null);
    }
  }
}

//更新prop值
function patchProp(el, key, prevVal, nextVal) {
  const isOn = (key) => /^on[A-Z]/.test(key);
  if (isOn(key)) {
    const event = key.slice(2).toLowerCase();

    el[`on${event}`] = nextVal;
  } else {
    if (nextVal === undefined || nextVal === null) {
      el.removeAttribute(key);
    } else {
      el.setAttribute(key, nextVal);
    }
  }
}

//创建元素
function mountElement(vnode, container, anchor, parentComponent) {
  let el;

  if (typeof vnode.type === "string") {
    el = vnode.el = document.createElement(vnode.type);
    if (vnode.type === "input") {
      for (const key in vnode.props) {
        if (key === "modelInput") {
          const proxyObj = parentComponent.setupState[vnode.props[key]];
          watch(
            () => proxyObj.value,
            () => {
              el.value = proxyObj.value;
            }
          );
          if (proxyObj["__v_isRef"]) {
            el.setAttribute("value", proxyObj.value);
            el.addEventListener("input", (e) => {
              if (proxyObj["__v_isRef"]) {
                parentComponent.setupState[vnode.props[key]].value =
                  e.target.value;
              }
            });
          }
        }
      }
    }
    const { children } = vnode;
    if (Array.isArray(children)) {
      //子元素
      mountChildren(vnode, el, parentComponent);
    } else {
      //文本节点
      el.textContent = children;
    }
  } else if (typeof vnode.type === Comment) {
    el = vnode.el = document.createComment(vnode.children);
  }

  //props
  for (const key in vnode.props) {
    const val = vnode.props[key];
    patchProp(el, key, null, val);
  }
  hostInsert(el, container, anchor);
  // container.appendChild(el);
}

//挂载子元素
function mountChildren(vnode, container, parentComponent) {
  const { children } = vnode;
  children.forEach((child) => {
    patch(null, child, container, null, parentComponent);
  });
}

function processComponent(n1, n2, container, parentComponent) {
  if (n1 === null) mountComponent(n2, container, parentComponent);
  else patchChildren(n1, n2, container);
}

function mountComponent(vnode, container) {
  //创建组件实例
  const instance = createComponentInstance(vnode);
  setupComponent(instance);
  setupRenderEffect(instance, vnode, container);
}

function setupRenderEffect(instance, vnode, container) {
  const update = () => {
    if (!instance.isMounted) {
      const { proxy } = instance;
      //将当前节点树存在instance  更新时候与新树对比
      const subTree = (instance.subTree = instance.render.call(proxy, proxy));

      //subTree 虚拟节点树
      patch(null, subTree, container, null, instance);
      instance.isMounted = true;
      vnode.el = subTree.el;
    } else {
      const { proxy } = instance;
      const subTree = instance.render.call(proxy, proxy);
      const prevSubTree = instance.subTree;
      instance.subTree = subTree;
      patch(prevSubTree, subTree, container, null, instance);
    }
  };
  effect(update, {
    scheduler: () => {
      // 把 effect 推到微任务的时候在执行
      // queueJob(effect);
      queueJob(update);
    },
  });
}
