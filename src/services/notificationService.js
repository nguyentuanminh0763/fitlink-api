// src/services/notificationService.js
import Notification from '../models/Notification.js'

export const createNotification = async ({ user, title, message, type = 'system', meta = {} }) => {
  const notification = await Notification.create({ user, title, message, type, meta, read: false })
  return notification
}

export const getUserNotifications = async (userId, limit = 20) => {
  const [items, totalUnread] = await Promise.all([
    Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ user: userId, read: false })
  ])
  return { items, totalUnread }
}

export const markNotificationAsRead = async (notificationId) => {
  return Notification.findByIdAndUpdate(notificationId, { read: true }, { new: true })
}

export const markAllNotificationsAsRead = async (userId) => {
  await Notification.updateMany({ user: userId, read: false }, { read: true })
  const totalUnread = await Notification.countDocuments({ user: userId, read: false })
  return { ok: true, totalUnread }
}
