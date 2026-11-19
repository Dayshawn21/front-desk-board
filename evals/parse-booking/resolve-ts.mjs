// Lets the eval runner run the server's TypeScript directly in Node.
// Server files import each other with ".js" endings, which is what Vercel
// needs after it compiles each file to .js. Running the .ts sources here,
// map a missing "./x.js" to "./x.ts" when that file exists.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      const relative = specifier.startsWith('./') || specifier.startsWith('../')
      if (
        error?.code === 'ERR_MODULE_NOT_FOUND' &&
        relative &&
        specifier.endsWith('.js')
      ) {
        return nextResolve(`${specifier.slice(0, -3)}.ts`, context)
      }
      throw error
    }
  },
})
