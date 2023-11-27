import { tarck, trigger } from "./effect.js";

//定义应该Map实例,存储原始对象到代理对象的映射
const reactiveMap = new Map();

//封装reactive函数
export function reactive(obj) {
  //  优先通过原始对象obj寻找之前的代理对象,如果找到则返回已有的代理对象
  const existionProxy = reactiveMap.get(obj);
  if (existionProxy) return existionProxy;
  //否则,创建新代理对象
  const proxy = createReactive(obj);
  //存储到Map中,从而避免重复创建
  reactiveMap.set(obj, proxy);
  return proxy;
}

//调度器,响应式数据修改多次,都只会执行一次,原理是加入微任务队列进行缓冲
const queue = new Set();
//标志是否正在刷新任务队列
let isFlushing = false;
const p = Promise.resolve();
//调度器,将一个任务添加进缓冲队列,并开始刷新队列
export function queueJob(job) {
  queue.add(job);
  //如果没有刷新队列,则刷新
  if (!isFlushing) {
    isFlushing = true;
    p.then(() => {
      try {
        queue.forEach((job) => job()); //执行队列的任务
      } finally {
        isFlushing = false;
        queue.clear = 0;
      }
    });
  }
}

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

//封装createReactive函数,接受参数isShallow,代表浅响应,默认是false,为非浅响应
//isReadonly代表只读,默认为false
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      //代理对象可以通过raw访问原始数据
      if (key === "raw") {
        return target;
      }

      //如果操作对象是数组,并且key存在arrayInstrumentations上
      //那么返回定义在arrayInstrumentations上的值
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }

      //得到原始值结果
      const res = Reflect.get(target, key, receiver);

      //typeof key !=="symbol" => for...of代理
      if (!isReadonly && typeof key !== "symbol") tarck(target, key);

      if (isShallow) return res;

      if (typeof res === "object" && res !== null) {
        //调用reactive函数包装为响应式数据返回
        //数据为只读,则调用readonly函数继续包装
        return isReadonly ? readonly(res) : reactive(res);
      }
      return res;
    },
    set(target, key, newVal, receiver) {
      //如果是只读,则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性${key}是只读的`);
        return true;
      }
      //获取旧值
      const oldVal = trigger[key];
      //如果属性不存在,则说明是添加属性,否则是已有属性
      const type = Array.isArray(target)
        ? //如果是数组,则检测设置的索引值是否小于数组长度
          //如果是,则为SET操作,否则为ADD操作
          Number[key] < target.length
          ? "SET"
          : "ADD"
        : Object.prototype.hasOwnProperty.call(target, key)
        ? "SET"
        : "ADD";
      //设置属性值
      const res = Reflect.set(target, key, newVal, receiver);
      // target===receiver.raw 说明 receiver是target的代理对象
      if (target === receiver.raw) {
        //与新值对比,只有不全等才会触发响应
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          //将type作为第三个参数传给trigger
          //增加第4个参数,功能:ex.数组长度为0,导致数组元素被删除
          trigger(target, key, type, newVal);
        }
      }

      return res;
    },
    has(target, key) {
      tarck(tarck, key);
      return Reflect.has(tarck, key);
    },
    deleteProperty(target, key) {
      //如果是只读,则打印警告信息
      if (isReadonly) {
        console.warn(`属性${key}是只读的`);
        return true;
      }
      //检查被操作属性是否为对象自己的属性
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      //使用Reflect.deleteProperty 完成属性的删除
      const res = Reflect.deleteProperty(target, key);
      if (hadKey && res) {
        //只有被删除属性是对象自己属性且删除成功时,才触发更新
        trigger(target, key, "DELETE");
      }
      return res;
    },
    ownKeys(target) {
      //如果操作对象是数组,则使用length作为key建立响应关系
      tarck(target, Array.isArray(target) ? "length" : ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
  });
}

//封装toRef函数
export function toRef(obj, key) {
  const wrapper = {
    get value() {
      return obj[key];
    },
    set value(val) {
      obj[key] = val;
    },
  };
  Object.defineProperty(wrapper, "__v_isRef", {
    value: true,
  });
  return wrapper;
}

//封装toRefs函数
export function toRefs(obj) {
  const ret = {};
  for (const key in obj) {
    ret[key] = toRef(obj, key);
  }
  return ret;
}

export function proxyRefs(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      //自动脱离ref:如果读取的值是ref则返回value
      return value.__v_isRef ? value.value : value;
    },
    set(target, key, newVal, receiver) {
      const value = target[key];
      //如果值是Ref,则设置对应value
      if (value.__v_isRef) {
        value.value = newVal;
        return true;
      }
      return Reflect.set(target, key, newVal, receiver);
    },
  });
}

//封装shallowReactive函数,浅响应数据
export function shallowReactive(obj) {
  return createReactive(obj, true);
}
//封装readonly函数,浅只读数据
export function readonly(obj) {
  return createReactive(obj, false, true);
}
//封装shallowReadonly函数,只读数据
export function shallowReadonly(obj) {
  return createReactive(obj, true, true);
}
