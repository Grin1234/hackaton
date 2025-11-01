import Review from '../models/Review.js';
import { generateCodeReview } from '../services/ollamaService.js';
import { parseCodeFile } from '../services/codeParser.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createReview = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;

    // Parse the code file
    const codeData = await parseCodeFile(filePath, fileName);

    // Generate review using Ollama
    const reviewResult = await generateCodeReview(codeData.content, codeData.language);

    // Create review document
    const review = new Review({
      fileName: fileName,
      filePath: filePath,
      language: codeData.language,
      codeContent: codeData.content,
      review: reviewResult.review,
      findings: reviewResult.findings || [],
      status: 'completed',
      tokenUsage: reviewResult.tokenUsage || {},
      createdAt: new Date()
    });

    await review.save();

    res.status(201).json({
      success: true,
      review: review
    });
  } catch (error) {
    next(error);
  }
};

export const getReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json({ review });
  } catch (error) {
    next(error);
  }
};

export const getAllReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-codeContent'); // Exclude code content for list view

    res.json({ reviews, count: reviews.length });
  } catch (error) {
    next(error);
  }
};

export const updateReview = async (req, res, next) => {
  try {
    const { comments, status } = req.body;
    
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (comments) {
      review.comments = comments;
    }
    
    if (status) {
      review.status = status;
    }

    await review.save();

    res.json({ success: true, review });
  } catch (error) {
    next(error);
  }
};

