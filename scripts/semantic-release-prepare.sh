#!/bin/bash

# we have to set -e here to make sure that the script fails if any of the commands fail
set -e

# if IS_PRERELEASE is true or --prerelease flag is provided, we generate a pre-release
if [ "${IS_PRERELEASE}" == "true" ] || [ "$1" = "--prerelease" ]; then
  echo "IS_PRERELEASE=true" && echo "Preparing pre-release"
  npm run package -- --pre-release
else
  echo "IS_PRERELEASE=false" && echo "Preparing main release"
  npm run package
fi

# We have to publish an extension during the prepare phase, as git plugin commits changes in the 'prepare' phase as well
# that can lead to pushing commits if the publish action fails.
# if IS_PRERELEASE is true or --prerelease flag is provided, we generate a pre-release
if [ "${IS_PRERELEASE}" == "true" ] || [ "$1" = "--prerelease" ]; then
  echo "IS_PRERELEASE=true" && echo "Publishing pre-release"
  npx vsce publish --pre-release --packagePath dist-desktop/*.vsix -p $AZURE_ACCESS_TOKEN
else
  echo "IS_PRERELEASE=false" && echo "Publishing main release"
  npx vsce publish --packagePath dist-desktop/*.vsix -p $AZURE_ACCESS_TOKEN
  npm run publish-ovsx -- dist-desktop/*.vsix -p $OPENVSX_ACCESS_TOKEN || echo "OpenVSX publish failed, continuing with release"
fi
