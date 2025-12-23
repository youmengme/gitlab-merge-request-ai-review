---
stage: AI-powered
group: Editor Extensions
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://about.gitlab.com/handbook/product/ux/technical-writing/#assignments
---

# Testing SSL issues

Here are the steps that could help to set up the environment.

> [!note]
> The instructions were tested on MacOS only, and might not be similar for other OSs.

1. Generate the self-signed certificate using

   ```shell
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout key.key -out cert.crt
   ```

   When the prompt asks for `Common Name` set it `localhost`.

1. Add the certificate to the Keychain Access and trust it.
   - Open Keychain Access: **Application > Utilities > Keychain Access**.
   - Go to **File** in the menu bar, select **Import Item** and select your generated certificate file.
   - After importing the certificate click **System** on the left panel and **Certificates** in the tabs.
   - Double-click on the imported certificate, expand the **Trust** section.
   - Set the trust settings. You can set **Always Trust** for the testing purposes.
1. Set the path to the certificate and its key in the VSCode extension settings.
1. Run the local Express server. Make sure to update path to your certificate and its key in the code. [Here is the snippet](https://gitlab.com/gitlab-org/editor-extensions/gitlab-lsp/-/snippets/3678524). What it does, it mocks [2 first requests](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/src/desktop/accounts/get_user_for_credentials_or_fail.ts#L12) that the VSCode extension does when the user setups the account and the first request that the LS does.
1. Start the extension and try adding the account with the host `https://localhost:8443` and any token. The extension should be able to set up the account and will show a notification if the secure connection with the mock server could be established.
