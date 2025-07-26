const express = require('express');
const router = express.Router();
const sentimentController = require('../controllers/sentimentController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route   GET /api/sentiment/info
 * @desc    Get n8n sentiment analysis workflow information
 * @access  Public
 */
router.get('/info', sentimentController.getWorkflowInfo);

/**
 * @route   GET /api/sentiment/health
 * @desc    Check n8n service health
 * @access  Public
 */
router.get('/health', sentimentController.healthCheck);

/**
 * @route   POST /api/sentiment/analyze
 * @desc    Analyze sentiment for a conversation or content
 * @access  Private (requires authentication)
 * @body    { conversationId?: number, content?: string }
 */
router.post('/analyze', authMiddleware, sentimentController.analyzeSentiment);

/**
 * @route   POST /api/sentiment/trigger
 * @desc    Trigger n8n workflow with custom data
 * @access  Private (requires authentication)
 * @body    { any custom data for the workflow }
 */
router.post('/trigger', authMiddleware, sentimentController.triggerWorkflow);

/**
 * @route   POST /api/sentiment/analyze-between
 * @desc    Analyze sentiment for messages between two phone numbers
 * @access  Private (requires authentication)
 * @body    { from: "+919712323801", to: "+919428123696" }
 */
router.post('/analyze-between', authMiddleware, sentimentController.analyzeMessagesBetween);

module.exports = router; 