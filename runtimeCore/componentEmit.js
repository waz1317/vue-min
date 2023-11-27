export function emit(instance, emit, ...args) {
  const { props } = instance;
  emit = "on" + emit.charAt(0).toUpperCase() + emit.slice(1);
  const handler = props[emit];
  handler && handler(...args);
}
