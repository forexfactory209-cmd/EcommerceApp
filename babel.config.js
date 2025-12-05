module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Temporarily disable NativeWind Babel plugin due to Expo/Babel incompatibility
    // plugins: ['nativewind/babel'],
  };
};
