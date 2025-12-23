export const DEFAULT_FETCH_RESPONSE = '# Fabulous Project\n\nThis project does fabulous things.';
const DEFAULT_JSON_RESPONSE = {
  name: 'Fabulous Project',
  description: 'This project does fabulous things.',
};

const fn = jest.fn().mockResolvedValue({
  ok: true,
  async arrayBuffer() {
    return Buffer.from(DEFAULT_FETCH_RESPONSE);
  },
  async text() {
    return DEFAULT_FETCH_RESPONSE;
  },
  async json() {
    return DEFAULT_JSON_RESPONSE;
  },
});
// eslint-disable-next-line import/no-default-export
export default fn;
