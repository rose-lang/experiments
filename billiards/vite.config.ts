import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [solid(), topLevelAwait()],
});
