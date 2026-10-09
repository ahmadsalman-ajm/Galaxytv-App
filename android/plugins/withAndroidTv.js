const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidTv(config) {
  return withAndroidManifest(config, (configWithManifest) => {
    const manifest = configWithManifest.modResults.manifest;
    const application = manifest.application?.[0];
    const mainActivity = application?.activity?.find((activity) =>
      activity['intent-filter']?.some((filter) =>
        filter.action?.some((action) => action.$['android:name'] === 'android.intent.action.MAIN')
      )
    );

    if (!application || !mainActivity) {
      throw new Error('Could not find the Android main activity for TV configuration.');
    }

    mainActivity.$['android:screenOrientation'] = 'landscape';

    const features = manifest['uses-feature'] ?? [];
    for (const featureName of ['android.software.leanback', 'android.hardware.touchscreen']) {
      if (!features.some((feature) => feature.$['android:name'] === featureName)) {
        features.push({
          $: { 'android:name': featureName, 'android:required': 'false' },
        });
      }
    }
    manifest['uses-feature'] = features;

    const filters = mainActivity['intent-filter'] ?? [];
    const hasLeanbackLauncher = filters.some((filter) =>
      filter.category?.some((category) => category.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER')
    );

    if (!hasLeanbackLauncher) {
      filters.push({
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' } }],
      });
    }
    mainActivity['intent-filter'] = filters;

    return configWithManifest;
  });
};