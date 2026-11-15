import fs from 'node:fs';
import path from 'node:path';
import { paths } from './config/appConfig.js';

/** Version from package.json, the single source of truth for releases. */
export const appVersion = JSON.parse(fs.readFileSync(path.join(paths.projectRoot, 'package.json'), 'utf8')).version;
