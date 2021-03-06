/**
 * Load a users config, if no userConfig is given then the default AMPLIFY CLI config will be loaded.
 *
 * @param {Object} [opts] - An object with various options.
 * @param {String} [opts.configFile] - Path to the config file to load as the reference.
 * @param {String} [opts.userConfigFile=~/.axway/amplify-cli.json] - Path to the user defined config file.
 * If the file does not exist, an empty object will be written
 * @returns {Config} An appcd-config instance
 */
export default function loadConfig({ configFile, userConfigFile } = {}) {
	const { existsSync, outputJSONSync } = require('fs-extra');
	const Config = require('appcd-config').default;
	const amplifyConfigFile = require('./locations').configFile;

	if (!userConfigFile) {
		userConfigFile = amplifyConfigFile;
	}

	if (!existsSync(userConfigFile)) {
		outputJSONSync(userConfigFile, {});
	}

	const cfg = new Config({ configFile });
	cfg.userConfigFile = userConfigFile;
	cfg.loadUserConfig(userConfigFile);

	return cfg;
}
