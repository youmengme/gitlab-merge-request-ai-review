<script>
export default {
  name: 'FindingRow',
  props: {
    label: {
      type: String,
      required: true,
    },
  },
};
</script>

<template>
  <div>
    <h3>{{ label }}</h3>
    <span><slot></slot></span>
  </div>
</template>
