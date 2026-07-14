const { z } = require('zod');

const orderItemSchema = z.object({
    itemId: z.string().min(1, 'Item id required'),
    name: z.string().min(1, 'Item name required'),
    variantId: z.string().optional(),
    variantName: z.string().optional(),
    variantPrice: z.number().min(0).optional(),
    price: z.number().min(0),
    quantity: z.number().int().min(1),
    isVeg: z.boolean().optional().default(true),
    image: z.string().optional(),
    notes: z.string().optional()
});

const addressSchema = z.object({
    label: z.enum(['Home', 'Office', 'Other']).optional(),
    name: z.string().optional(),
    fullName: z.string().optional(),
    street: z.string().min(1, 'Street required'),
    additionalDetails: z.string().optional(),
    city: z.string().min(1, 'City required'),
    state: z.string().min(1, 'State required'),
    zipCode: z.string().optional(),
    phone: z.string().optional(),
    location: z
        .object({
            type: z.literal('Point').optional(),
            coordinates: z.tuple([z.number(), z.number()]).optional()
        })
        .optional()
});

const pricingSchema = z.object({
    subtotal: z.number().min(0),
    tax: z.number().min(0).optional(),
    packagingFee: z.number().min(0).optional(),
    deliveryFee: z.number().min(0).optional(),
    platformFee: z.number().min(0).optional(),
    discount: z.number().min(0).optional(),
    total: z.number().min(0),
    currency: z.string().optional(),
    couponCode: z.string().nullable().optional()
});

const schema = z.object({
    items: z.array(orderItemSchema).min(1, 'At least one item required'),
    address: addressSchema,
    moduleType: z.enum(['food', 'grocery', 'accessories']).optional(),
    restaurantId: z.string().optional(),
    restaurantName: z.string().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    pricing: pricingSchema,
    deliveryFleet: z.string().optional(),
    note: z.string().optional(),
    sendCutlery: z.boolean().optional(),
    paymentMethod: z.enum(['cash', 'razorpay', 'razorpay_qr', 'card', 'wallet']),
    zoneId: z.string().nullable().optional()
});

const payload = {
    items: [{
        itemId: "item123",
        name: "Cooling Pad",
        price: 1200,
        quantity: 1,
        isVeg: true
    }],
    address: {
        street: "123 Test St",
        city: "TestCity",
        state: "TestState"
    },
    customerName: "John Doe",
    customerPhone: "1234567890",
    restaurantId: undefined,
    restaurantName: undefined,
    pricing: {
        subtotal: 1200,
        total: 1200
    },
    note: "",
    sendCutlery: true,
    paymentMethod: "cash",
    zoneId: undefined,
    moduleType: "accessories"
};

const result = schema.safeParse(payload);
if (!result.success) {
    console.log(result.error.errors);
} else {
    console.log("Validation passed");
}
