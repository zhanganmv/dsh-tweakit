/** Remove generated output so stale declarations never survive a rebuild. */
import { rm } from 'node:fs/promises'

await rm(new URL('../lib', import.meta.url), { recursive: true, force: true })
console.log('dsh-tweakit: cleaned lib/')
