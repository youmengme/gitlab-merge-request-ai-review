import { defineConfig } from 'vite';
import buildConfigForWebview from '../vite.config.shared';

export default defineConfig(buildConfigForWebview('security_finding'));
