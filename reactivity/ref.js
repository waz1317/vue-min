import { reactive } from "./reactive.js";

// 封装ref函数
export function ref(val) {
  const wrapper = {
    value: val,
  };

  //定义一个不可枚举属性,并且值为true
  Object.defineProperty(wrapper, "__v_isRef", {
    value: true,
  });
  return reactive(wrapper);
}
