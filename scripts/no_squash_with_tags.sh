#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

[ "${CI_MERGE_REQUEST_SQUASH_ON_MERGE:-false}" != "true" ] && exit 0

TARGET=${CI_MERGE_REQUEST_TARGET_BRANCH_SHA:-main}
SOURCE=${CI_MERGE_REQUEST_SOURCE_BRANCH_SHA:-@}

for hash in $(git log "${TARGET}..${SOURCE}" --format='%H'); do
  tag=$(git tag --points-at "$hash")
  if [ -n "$tag" ]; then
    echo "Failure: refusing to squash commit $hash with tag $tag"
    echo 'To fix this error, disable "Squash commits when merging" in the merge request, then re-run this job or start a new pipeline.'
    exit 1
  fi
done
