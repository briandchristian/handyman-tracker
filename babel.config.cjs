module.exports = {
  presets: [
    ['@babel/preset-env', { 
      targets: { node: 'current' },
      modules: 'auto'  // Let babel handle ES modules
    }],
    ['@babel/preset-react', { runtime: 'automatic' }]
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', {
          targets: { node: 'current' },
          modules: 'commonjs'  // Transform ESM to CommonJS for Jest
        }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }
  }
};

