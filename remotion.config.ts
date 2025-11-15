import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// Serve public directory for assets
Config.setPublicDir('public');
// High quality rendering settings
Config.setImageSequence(false);
Config.setBrowserExecutable(undefined); // Use default browser

