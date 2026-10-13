import { InquiryQuotationTemplateData, RenderedTemplate, NotificationChannel } from '../types.js';

export function renderInquiryQuotationTemplate(
  data: InquiryQuotationTemplateData,
  channel: NotificationChannel = 'email'
): RenderedTemplate {
  const currency = data.quoteCurrency || 'INR';
  const validityText = data.quoteValidityDays
    ? `${data.quoteValidityDays} days`
    : data.quoteValidUntil
    ? `until ${new Date(data.quoteValidUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '7 days';

  const subject = `Bespoke Cake Quotation Proposal — Deep's Cake Shop #${data.referenceId}`;

  if (channel === 'whatsapp' || channel === 'sms') {
    const text = [
      `✨ *Deep's Cake Shop — Bespoke Quotation Proposal*`,
      ``,
      `Hello ${data.customerName},`,
      `Our master pastry chef has reviewed your custom cake request *#${data.referenceId}*!`,
      ``,
      `*Custom Cake Specifications:*`,
      `• Occasion: ${data.occasion}`,
      `• Flavor: ${data.flavor}`,
      `• Structure: ${data.weight} (${data.tierCount})`,
      `• Dietary: ${data.isEggless ? '100% Pure Eggless' : 'Regular (Contains Eggs)'}`,
      `• Celebration Date: ${data.preferredDate}${data.deliveryTimeSlot ? ` (${data.deliveryTimeSlot})` : ''}`,
      ``,
      `*Official Quotation:* ₹${data.quotedAmount.toLocaleString('en-IN')} ${currency}`,
      `*Proposal Validity:* Guaranteed for ${validityText}`,
      data.quoteNotes ? `*Chef Notes:* "${data.quoteNotes}"` : '',
      ``,
      `⚠️ *Note:* This proposal does not automatically place or charge an order. To confirm and schedule your handcrafted cake, reply directly to this message or call our chef at +91 98765 43210.`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      subject,
      message: text,
      metadata: {
        referenceId: data.referenceId,
        quotedAmount: data.quotedAmount,
        currency,
        validity: validityText,
      },
    };
  }

  // Email format
  const message = [
    `Dear ${data.customerName},`,
    ``,
    `Thank you for consulting Deep's Cake Shop for your upcoming ${data.occasion} celebration.`,
    `Our pastry kitchen has thoroughly reviewed your custom design requirements and prepared an official bespoke quotation proposal:`,
    ``,
    `========================================`,
    `BESPOKE CAKE PROPOSAL — #${data.referenceId}`,
    `========================================`,
    `Occasion:             ${data.occasion}`,
    `Celebration Date:     ${data.preferredDate}${data.deliveryTimeSlot ? ` (${data.deliveryTimeSlot})` : ''}`,
    `Flavor Composition:   ${data.flavor}`,
    `Size & Structure:     ${data.weight} — ${data.tierCount}`,
    `Dietary Preference:   ${data.isEggless ? '100% Pure Eggless Vegetarian' : 'Contains Eggs'}`,
    `----------------------------------------`,
    `OFFICIAL QUOTATION:   ₹${data.quotedAmount.toLocaleString('en-IN')} ${currency}`,
    `PRICE GUARANTEE:      Valid for ${validityText}`,
    `========================================`,
    ``,
    data.quoteNotes
      ? `Chef Scope & Inclusions:\n"${data.quoteNotes}"\n`
      : null,
    `IMPORTANT NOTICE:`,
    `This quotation is an estimated custom price proposal and does not automatically confirm an order or reserve kitchen slots. To proceed with this quotation and confirm production, please contact our bakery team by replying to this email or calling +91 98765 43210.`,
    ``,
    `We would be honored to craft a centerpiece cake for your celebration!`,
    ``,
    `Warm culinary regards,`,
    `Head Pastry Chef & Concierge Team`,
    `Deep's Cake Shop Artisan Bakery`,
    `Phone: +91 98765 43210 | Email: support@deepscakeshop.in`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  return {
    subject,
    message,
    metadata: {
      referenceId: data.referenceId,
      quotedAmount: data.quotedAmount,
      currency,
      validity: validityText,
    },
  };
}
