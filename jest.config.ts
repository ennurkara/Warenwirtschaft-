import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

// nextJest prepends '/node_modules/' which shadows any per-package exceptions.
// We resolve the config and then replace transformIgnorePatterns so that
// pdf-to-img (ESM-only) and pdfjs-dist are transformed by Babel/SWC.
async function jestConfig(): Promise<Config> {
  const resolved = await createJestConfig(config)()
  return {
    ...resolved,
    transformIgnorePatterns: [
      '/node_modules/(?!(pdf-to-img|pdfjs-dist)/)',
      '^.+\\.module\\.(css|sass|scss)$',
    ],
  }
}

export default jestConfig