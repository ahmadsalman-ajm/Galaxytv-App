const fs = require('node:fs/promises');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod, withInfoPlist } = require('@expo/config-plugins');

const streamHost = 'gean4563t.xyz';

module.exports = function withIptvNetwork(config) {
  config = withInfoPlist(config, (configWithPlist) => {
    const transport = configWithPlist.modResults.NSAppTransportSecurity ?? {};
    const domains = transport.NSExceptionDomains ?? {};

    domains[streamHost] = {
      ...domains[streamHost],
      NSExceptionAllowsInsecureHTTPLoads: true,
      NSIncludesSubdomains: true,
    };
    transport.NSExceptionDomains = domains;
    configWithPlist.modResults.NSAppTransportSecurity = transport;
    return configWithPlist;
  });

  config = withAndroidManifest(config, (configWithManifest) => {
    const application = configWithManifest.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error('Could not find the Android application for IPTV network configuration.');
    }

    application.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return configWithManifest;
  });

  return withDangerousMod(config, ['android', async (configWithMod) => {
    const resourceDirectory = path.join(configWithMod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    const configFile = path.join(resourceDirectory, 'network_security_config.xml');
    const xml = `<?xml version="1.0" encoding="utf-8"?>\n<network-security-config>\n  <domain-config cleartextTrafficPermitted="true">\n    <domain includeSubdomains="true">${streamHost}</domain>\n  </domain-config>\n</network-security-config>\n`;

    await fs.mkdir(resourceDirectory, { recursive: true });
    await fs.writeFile(configFile, xml);
    return configWithMod;
  }]);
};