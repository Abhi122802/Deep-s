import { OrderPlacedTemplateData, RenderedTemplate, NotificationChannel } from '../types.js';

export function renderOrderPlacedTemplate(
  data: OrderPlacedTemplateData,
  channel: NotificationChannel = 'email'
): RenderedTemplate {
  const subject = `Order Confirmed! Your Deep's Cake Shop Order #${data.orderId}`;

  const itemsList = data.items
    .map(
      (item) =>
        `• ${item.cakeName} (${item.selectedWeight}) x${item.quantity} — ₹${item.lineTotal.toLocaleString('en-IN')}${
          item.customMessage ? ` [Msg: "${item.customMessage}"]` : ''
        }`
    )
    .join('\n');

  if (channel === 'whatsapp' || channel === 'sms') {
    const text = [
      `🍰 *Deep's Cake Shop — Order Confirmed!*`,
      ``,
      `Hello ${data.customerName},`,
      `Thank you for ordering with Deep's Cake Shop! Your order *#${data.orderId}* has been successfully received.`,
      ``,
      `*Order Summary:*`,
      itemsList,
      ``,
      data.discountAmount && data.discountAmount > 0
        ? `*Subtotal:* ₹${data.subtotal.toLocaleString('en-IN')} (Discount: -₹${data.discountAmount.toLocaleString('en-IN')})`
        : `*Subtotal:* ₹${data.subtotal.toLocaleString('en-IN')}`,
      `*Delivery Fee:* ${data.deliveryFee === 0 ? 'FREE' : `₹${data.deliveryFee}`}`,
      `*Grand Total:* ₹${data.grandTotal.toLocaleString('en-IN')}`,
      ``,
      data.deliveryAddress ? `*Delivery Address:* ${data.deliveryAddress}` : '',
      `*Fulfillment Status:* Pending Kitchen Confirmation`,
      ``,
      `Our master bakers are preparing to craft your cake fresh with premium ingredients.`,
      `Questions? Reply to this message or contact us at +91 98765 43210.`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      subject,
      message: text,
      metadata: {
        orderId: data.orderId,
        grandTotal: data.grandTotal,
        itemCount: data.items.length,
      },
    };
  }

  // Email format
  const message = [
    `Dear ${data.customerName},`,
    ``,
    `Thank you for your order with Deep's Cake Shop! We are delighted to confirm that your order #${data.orderId} has been successfully recorded.`,
    ``,
    `========================================`,
    `ORDER RECEIPT — #${data.orderId}`,
    `========================================`,
    itemsList,
    `----------------------------------------`,
    `Subtotal:       ₹${data.subtotal.toLocaleString('en-IN')}`,
    data.discountAmount && data.discountAmount > 0
      ? `Discount (${data.couponCode || 'PROMO'}): -₹${data.discountAmount.toLocaleString('en-IN')}`
      : null,
    `Delivery Fee:   ${data.deliveryFee === 0 ? 'FREE (Eligible order)' : `₹${data.deliveryFee}`}`,
    `----------------------------------------`,
    `GRAND TOTAL:    ₹${data.grandTotal.toLocaleString('en-IN')}`,
    `========================================`,
    ``,
    data.deliveryAddress ? `Delivery Address: ${data.deliveryAddress}` : null,
    data.deliveryNotes ? `Customer Notes: "${data.deliveryNotes}"` : null,
    ``,
    `Our pastry kitchen will begin preparing your order fresh to perfection. You will receive updates as your cake progresses through baking and delivery.`,
    ``,
    `Warm regards,`,
    `Deep's Cake Shop Artisan Bakery Team`,
    `Phone: +91 98765 43210 | Email: support@deepscakeshop.in`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  return {
    subject,
    message,
    metadata: {
      orderId: data.orderId,
      grandTotal: data.grandTotal,
      itemCount: data.items.length,
    },
  };
}
