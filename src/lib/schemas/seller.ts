import { z } from "zod";
import { optionalText, sellerSchema } from "./invoice";

/**
 * A saved seller: the invoice's seller fields plus a label for lists and pickers and the payment
 * details. Only the name is required; an empty label falls back to the name.
 */
export const sellerProfileSchema = sellerSchema
  .extend({
    label: optionalText,
    paymentDetails: optionalText,
  })
  .transform((seller) => ({ ...seller, label: seller.label ?? seller.name }));

export type SellerProfileInput = z.input<typeof sellerProfileSchema>;
export type SellerProfile = z.output<typeof sellerProfileSchema>;
