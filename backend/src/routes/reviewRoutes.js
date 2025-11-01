import express from 'express';
import { createReview, getReview, getAllReviews, updateReview } from '../controllers/reviewController.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// POST /api/reviews - Create a new code review
router.post('/', upload.single('codeFile'), createReview);

// GET /api/reviews - Get all reviews (must come before /:id)
router.get('/', getAllReviews);

// GET /api/reviews/:id - Get a specific review
router.get('/:id', getReview);

// PUT /api/reviews/:id - Update a review (e.g., add comments)
router.put('/:id', updateReview);

export default router;

