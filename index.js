import { createApp, h, reactive, ref, Comment, Text } from "./vue.js";

const App = {
  name: "App",
  template:
    '<div class="app"><div class="one"><top :list="list" @add="add"></top><button @click="list.pop()" class="btn2">删除</button></div><middle :list="list"></middle><sum :list="list"></sum></div>',
  setup() {
    const list = reactive([
      { id: 0, value: "吃饭" },
      { id: 1, value: "睡觉" },
    ]);
    const add = (value) => {
      list.push({ id: list.length + Math.floor(Math.random() * 10000), value });
    };
    return {
      list,
      add,
    };
  },
};

const container = document.querySelector("#app");
const app = createApp(App);

//注册组件
app.registerComponent({
  name: "top",
  template:
    "<div class='top'><input v-model='chang'></input><span>v-model:{{chang}}</span><button @click='add' class='btn1'>添加</button></div>",
  setup(props, { emit }) {
    const chang = ref("aa");
    const add = () => {
      emit("add", chang.value);
      chang.value = "";
    };
    return {
      chang,
      add,
    };
  },
});

app.registerComponent({
  name: "middle",
  template:
    "<div class='middle'><p v-for='(item,index) in list' :key='item.id'><span>id:{{item.id}} {{item.value}}</span></p></div>",
  setup(props) {
    return {};
  },
});
app.registerComponent({
  name: "sum",
  template: "<div class='sum'>数组长度：{{list.length}}</div>",
  setup(props) {
    return {};
  },
});
app.mount(container);
