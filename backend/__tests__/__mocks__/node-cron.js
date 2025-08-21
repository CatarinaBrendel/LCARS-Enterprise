// Prevents background intervals in tests
export default {
  schedule: (_expr, _fn, _opts) => ({
    start() {},
    stop() {},
  }),
};
