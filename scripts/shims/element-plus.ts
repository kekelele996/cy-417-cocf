// 仅用于 Node 测试环境：element-plus 消息打桩，避免访问 DOM
export const ElMessage = {
  success: () => {},
  warning: () => {},
  error: () => {},
  info: () => {},
};
export default { ElMessage };
