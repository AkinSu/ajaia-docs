/**
 * Demo capacity limits.
 *
 * This is a hiring-exercise deployment on free infrastructure, not a product.
 * These caps keep one visitor from filling the database for everyone else, and
 * they are deliberately generous enough that nobody evaluating the app will hit
 * them. A real product would bill, quota per workspace, and expire old data.
 */
export const MAX_DOCUMENTS_PER_USER = 50;
export const MAX_IMAGES_PER_DOCUMENT = 50;
