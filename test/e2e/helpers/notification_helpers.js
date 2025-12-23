import { browser } from '@wdio/globals';

/**
 * Dismisses all notifications.
 *
 * @async
 * @returns {Promise<void>}
 */
const dismissAllNotifications = async () => {
  const workbench = await browser.getWorkbench();

  //  Wrap in waitUntil to catch notifications that pop up after the initial getNotifications
  await browser.waitUntil(
    async () => {
      const notifications = await workbench.getNotifications();
      await Promise.all(notifications.map(notification => notification.dismiss()));

      return !(await workbench.hasNotifications());
    },
    {
      timeoutMsg: 'Could not dismiss all notifications',
    },
  );
};

/**
 * Checks if a given string exists in a notification.
 *
 * Does not wait for the notification to appear.
 * Used by waitForNotification().
 *
 * @async
 * @param {Object} workbench
 * @param {string} message
 * @returns {Promise<?string>}
 */
const findNotification = async (workbench, message) => {
  const notifs = await workbench.getNotifications();
  const messages = await Promise.all(notifs.map(n => n.getMessage()));

  return messages.find(m => m.includes(message));
};

/**
 * Waits for a notification to appear that contains a given string.
 *
 * Uses findNotification().
 *
 * @async
 * @param {string} message
 * @returns {Promise<void>}
 */
const waitForNotification = async message => {
  const workbench = await browser.getWorkbench();

  await browser.waitUntil(async () => findNotification(workbench, message), {
    timeoutMsg: `Could not find notification: ${message}`,
  });
};

export { dismissAllNotifications, waitForNotification };
