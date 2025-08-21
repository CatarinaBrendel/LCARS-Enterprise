import { teardown } from './_teardown.js';

// Only DB cleanup is meaningful here (no server/io/clients in this process)
export default async function () {
  await teardown();
}
