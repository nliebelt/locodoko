import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['src/**/*.ts'],
    rules: {
      'complexity': ['error', 1]
    }
  }
);
