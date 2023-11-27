const bucket = new WeakMap(); //桶收集依赖

let activeEffect; //当前执行的副作用函数
const effectStack = []; //单副作用函数发生嵌套,利用副作用函数栈解决

//重写数组方法
const arrayInstrumentations = {};
["includes", "indexOf", "lastIndexOf"].forEach((method) => {
  const originMethod = Array.prototype[method];
  arrayInstrumentations[method] = function (...args) {
    //this是代理对象,先在代理对象中找,将结果存储到res中
    let res = originMethod.apply(this, args);
    if (res === false || res === -1) {
      //res为false为没找到,通过this.raw拿到原始数组,在去查找更新res值
      res = originMethod.apply(this.raw, args);
    }
    return res;
  };
});

let shouldTrack = true;
["push", "pop", "shift", "unshift", "splice"].forEach((method) => {
  const originMethod = Array.prototype[method];
  arrayInstrumentations[method] = function (...args) {
    shouldTrack = false;
    let res = originMethod.apply(this, args);
    shouldTrack = true;
    return res;
  };
});

export function effect(fn, options = {}) {
  //fn为副作用函数中的回调,执行的
  const effectFn = () => {
    //effectFn为副作用函数

    cleanup(effectFn); //每次调用副作用函数前清空依赖集合,防止第一次读取后面不读取函数依然存在并且执行
    activeEffect = effectFn; //当前执行的副作用函数

    effectStack.push(effectFn); //向副作用函数栈添加副作用函数(当副作用函数发生嵌套时)
    const res = fn();
    effectStack.pop(); //执行往副作用函数栈去除最后一个函数(当副作用函数发生嵌套时)

    activeEffect = effectStack[effectStack.length - 1]; //出栈把前一位的副作用函数赋值给当前激活的副作用函数
    return res;
  };
  effectFn.options = options;
  effectFn.deps = []; // effectFn在effectFn调用时赋值给activeEffect deps在activeEffect身上
  if (!options.lazy) effectFn();
  return effectFn;
}

function cleanup(effectFn) {
  //
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];
    deps.delete(effectFn);
  }
  effectFn.deps.length = 0;
}

const ITERATE_KEY = Symbol();
//依赖收集
export function tarck(target, key) {
  //当对象属性被读取时执行的操作
  if (!activeEffect || !shouldTrack) return target[key];
  let depsMap = bucket.get(target);
  if (!depsMap) bucket.set(target, (depsMap = new Map()));
  let deps = depsMap.get(key);
  if (!deps) depsMap.set(key, (deps = new Set()));
  deps.add(activeEffect); //当前激活的副作用函数添加到所读取值的依赖集合中

  activeEffect.deps.push(deps); //将这个依赖集合添加到effectFn.deps  为了执行副作用函数时清空这个依赖
}
//触发副作用函数
export function trigger(target, key, type, newVal) {
  const depsMap = bucket.get(target);
  if (!depsMap) return true;
  const effects = depsMap.get(key); //当值改变  从桶中取出与该属性对应的副作用函数

  const effectsToRun = new Set();
  effects &&
    effects.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  //只有当type为ADD或者DELETE时,才触发与ITERATE_KEY副作用函数执行
  if (type === "ADD" || type === "DELETE") {
    //取得与ITERATE_KEY相关联的函数
    const iterateEffects = depsMap.get(ITERATE_KEY);
    //将与ITERATE_KEY相联系的副作用函数添加到effectsToRun中
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }

  //当操作类型为ADD切target为数组时,应该取出与length相关的副作用函数
  if (type === "ADD" && Array.isArray(target)) {
    const lengthEffects = depsMap.get("length");
    lengthEffects &&
      lengthEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) effectsToRun.add(effectFn);
      });
  }

  //如果操作目标为数组,并且修改length属性
  if (Array.isArray(target) && key === "length") {
    //对于索引大于或者对于length值的元素
    //需要把全部相关联的副作用函数取出来添加到effesToRun中等待执行
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects &&
          effects.forEach((effectFn) => {
            if (effectFn !== activeEffect) effectsToRun.add(effectFn);
          });
      }
    });
  }

  effectsToRun.forEach((effectFn) => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
}
