# frozen_string_literal: trueo

require 'gitlab-dangerfiles'

Gitlab::Dangerfiles.for_project(self, 'gitlab-vscode-extension') do |dangerfiles|
  dangerfiles.import_plugins
  dangerfiles.import_dangerfiles(only: %w[
    simple_roulette
    graphql_compatibility
    z_add_labels
    z_retry_link
  ])
end
