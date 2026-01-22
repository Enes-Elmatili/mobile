// metro.config.js CORRIGÉ
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..'); 

const config = getDefaultConfig(projectRoot);

// 1. On surveille le workspace
config.watchFolders = [workspaceRoot];

// 2. IMPORTANT : On dit à Metro où chercher les node_modules.
// L'ordre est crucial : d'abord le projet local, puis le workspace (si monorepo), puis les dossiers node_modules classiques.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. On exclut 'react-native' du workspace pour éviter les doublons si jamais il y en a un au niveau racine
// (C'est souvent la cause de plantages étranges dans les monorepos)
// Mais d'abord, essayons juste avec l'installation de semver.

module.exports = config;
