// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// zustand's ESM build ("import" condition) uses import.meta, which Metro
// leaves untransformed — the exported web bundle is a classic script, so the
// page dies with "Cannot use 'import.meta' outside a module". Resolve zustand
// through its CJS build on web instead. Native is untouched.
const baseResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && (moduleName === 'zustand' || moduleName.startsWith('zustand/'))) {
    const sub = moduleName === 'zustand' ? 'index' : moduleName.slice('zustand/'.length);
    return {
      type: 'sourceFile',
      filePath: path.join(__dirname, 'node_modules', 'zustand', `${sub}.js`),
    };
  }
  return (baseResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
