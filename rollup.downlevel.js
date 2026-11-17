import { transform } from 'esbuild';

// Lowest syntax level the shipped bundle may use. Lit 3 and the card source are
// ES2022; older WebViews (e.g. Fire OS tablets running the HA Companion app or
// Fully Kiosk) fail to parse `?.`, `??=`, and class `static {}` blocks, so the
// whole card never registers. Lowering the final chunk covers node_modules too.
export const BUNDLE_TARGET = 'es2017';

export const downlevel = (target = BUNDLE_TARGET) => ({
  name: 'downlevel',
  async renderChunk(code) {
    const result = await transform(code, {
      loader: 'js',
      format: 'esm',
      target,
      sourcemap: true,
    });

    for (const warning of result.warnings) {
      this.warn(warning.text);
    }

    return { code: result.code, map: result.map || null };
  },
});
