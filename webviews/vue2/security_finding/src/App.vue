<script>
import FindingDetails from './FindingDetails.vue';

export default {
  name: 'App',
  components: {
    FindingDetails,
  },
  data() {
    return {
      isLoading: false,
      finding: {},
    };
  },
  created() {
    this.isLoading = true;

    window.addEventListener('message', event => {
      if (event.data.type === 'findingDetails') {
        const { finding, instanceUrl } = event.data;
        this.finding = finding;
        this.instanceUrl = instanceUrl;
        this.isLoading = false;
      }
    });

    const vscode = acquireVsCodeApi();
    vscode.postMessage({
      command: 'appReady',
    });
  },
};
</script>

<template>
  <div id="app">
    <p v-if="isLoading" class="loading">Loading...</p>
    <p v-else-if="!finding">
      Something went wrong! please
      <a href="https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/new" class="hello"
        >create an issue.</a
      >
    </p>
    <finding-details v-else :finding="finding" :instance-url="instanceUrl" />
  </div>
</template>

<style>
body {
  font-family: Arial, sans-serif;
  margin: 20px;
}
h2,
h3 {
  color: #eee;
}
</style>
