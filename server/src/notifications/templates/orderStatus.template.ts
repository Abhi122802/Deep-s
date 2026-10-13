import { OrderStatusTemplateData, RenderedTemplate, NotificationChannel } from '../types.js';

const STATUS_HEADLINES: Record<string, string> = {
  Confirmed: 'Confirmed & Scheduled for Kitchen Preparation',
  Baking: 'Now Baking Fresh in Our Kitchen!',
  'Out for Delivery': 'Out for Delivery to Your Doorstep!',
  Delivered: 'Delivered! Enjoy Your Celebration',
  Cancelled: 'Order Cancelled Notice',
};

const STATUS_MESSAGES: Record<string, string> = {
  Confirmed:
    'Great news! Our head pastry chef has accepted your order and scheduled it for fresh baking according to your required celebration time.',
  Baking:
    'Our artisan pastry team is whisking and layering your fresh handcrafted cake right now with 100% genuine ingredients.',
  'Out for Delivery':
    'Your cake is freshly finished, decorated, and securely packed in our signature chilled box. Our delivery executive is on the way!',
  Delivered:
    'Your cake has been safely handed over. We sincerely hope it brings immense joy, sweet memories, and smiles to your special occasion.',
  Cancelled:
    'Your order has been cancelled. If you did not request this cancellation or have questions regarding refunds, please contact our bakery concierge.',
};

export function renderOrderStatusTemplate(
  data: OrderStatusTemplateData,
  channel: NotificationChannel = 'email'
): RenderedTemplate {
  const headline = STATUS_HEADLINES[data.newStatus] || `Status Updated: ${data.newStatus}`;
  const statusBody = STATUS_MESSAGES[data.newStatus] || `Your order status has been updated to ${data.newStatus}.`;
  const subject = `Update on Order #${data.orderId}: ${headline}`;

  if (channel === 'whatsapp' || channel === 'sms') {
    const text = [
      `🎂 *Deep's Cake Shop — Order Status Update*`,
      ``,
      `Hello ${data.customerName},`,
      `Update for order *#${data.orderId}*:`,
      `*Status:* ${data.newStatus} (${headline})`,
      ``,
      statusBody,
      ``,
      data.deliveryAddress ? `*Delivery Destination:* ${data.deliveryAddress}` : '',
      ``,
      `Need assistance? Reach our bakery manager at +91 98765 43210.`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      subject,
      message: text,
      metadata: {
        orderId: data.orderId,
        previousStatus: data.previousStatus,
        newStatus: data.newStatus,
      },
    };
  }

  // Email format
  const message = [
    `Dear ${data.customerName},`,
    ``,
    `We have an update regarding your Deep's Cake Shop order #${data.orderId}.`,
    ``,
    `========================================`,
    `FULFILLMENT STATUS: ${data.newStatus.toUpperCase()}`,
    `========================================`,
    ``,
    statusBody,
    ``,
    data.deliveryAddress ? `Delivery Destination: ${data.deliveryAddress}` : null,
    ``,
    `You can track and manage your orders online at any time through our customer portal.`,
    ``,
    `Warm regards,`,
    `Deep's Cake Shop Kitchen & Fulfillment Team`,
    `Phone: +91 98765 43210 | Email: support@deepscakeshop.in`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  return {
    subject,
    message,
    metadata: {
      orderId: data.orderId,
      previousStatus: data.previousStatus,
      newStatus: data.newStatus,
    },
  };
}
