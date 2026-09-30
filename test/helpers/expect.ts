/**
 * The `expect` used by every spec.
 *
 * It is jest's own matcher engine (so all 6800+ assertions behave exactly like
 * before the TypeScript migration); this module only adds the project's custom
 * matchers and re-exports it as a default export.
 */
import { expect as jestExpect } from "@jest/globals";

import { extendExpect } from "./utils";

extendExpect(jestExpect as any);

export default jestExpect;
export { jestExpect as expect };
