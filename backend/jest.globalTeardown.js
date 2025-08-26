// backend/jest.globalTeardown.js
import { teardown } from './__tests__/_teardown.js'; // or inline your existing code

export default async function globalTeardown() {
  await teardown({}); // this calls endPool() once
}
