const n8nService = require('../services/n8nService');
const { Conversation, Message } = require('../models/whatsappModels');
const User = require('../models/user');
const { Op } = require('sequelize');

/**
 * Trigger sentiment analysis workflow
 */
const analyzeSentiment = async (req, res) => {
  try {
    const { conversationId, content } = req.body;

    // Validate required fields
    if (!conversationId && !content) {
      return res.status(400).json({
        success: false,
        message: 'Either conversationId or content is required',
        data: null
      });
    }

    console.log('Sentiment analysis request:', { conversationId, content: content ? 'provided' : 'not provided' });

    // Trigger n8n workflow
    const result = await n8nService.analyzeSentiment(conversationId, content);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error in analyzeSentiment controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Trigger sentiment analysis with custom data
 */
const triggerWorkflow = async (req, res) => {
  try {
    const workflowData = req.body;

    console.log('Custom workflow trigger request:', workflowData);

    // Trigger n8n workflow with custom data
    const result = await n8nService.triggerSentimentAnalysis(workflowData);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error in triggerWorkflow controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Check n8n service health
 */
const healthCheck = async (req, res) => {
  try {
    const result = await n8nService.healthCheck();

    const statusCode = result.success ? 200 : 503;

    return res.status(statusCode).json({
      success: result.success,
      status: result.status,
      message: result.message,
      timestamp: new Date().toISOString(),
      ...(result.error && { error: result.error })
    });
  } catch (error) {
    console.error('Error in healthCheck controller:', error);
    return res.status(500).json({
      success: false,
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Analyze sentiment between two phone numbers
 */
const analyzeMessagesBetween = async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to } = req.body;

    // Validate required fields
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: 'Both from and to phone numbers are required',
        data: null
      });
    }

    console.log(`Sentiment analysis request between ${from} and ${to} for user ${userId}`);

    // Helper function to normalize phone numbers
    const normalizePhoneNumber = (phoneNumber) => {
      return phoneNumber.replace(/^\+/, '').replace(/\s/g, '');
    };

    // Normalize the phone numbers
    const normalizedFromNumber = normalizePhoneNumber(from);
    const normalizedToNumber = normalizePhoneNumber(to);

    // Create WhatsApp JIDs
    const fromJid = normalizedFromNumber + '@s.whatsapp.net';
    const toJid = normalizedToNumber + '@s.whatsapp.net';

    // Find conversations between these numbers for this user
    const conversations = await Conversation.findAll({
      where: {
        ownerId: userId,
        whatsappChatId: {
          [Op.in]: [fromJid, toJid]
        }
      },
      include: [{
        model: Message,
        include: [{
          model: User,
          attributes: ['id', 'name', 'mobileNo', 'email']
        }],
        order: [['createdAt', 'DESC']] // Get most recent messages first
      }]
    });

    // Collect all messages from both directions
    let allMessages = [];
    
    for (const conversation of conversations) {
      if (conversation.Messages) {
        allMessages = allMessages.concat(conversation.Messages);
      }
    }

    // Sort messages by creation time (most recent first)
    allMessages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Get the last 50 messages
    const last50Messages = allMessages.slice(0, 50);

    if (last50Messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No messages found between these phone numbers',
        data: null
      });
    }

    // Prepare data for n8n workflow
    const messagesForAnalysis = last50Messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      isOutgoing: msg.isOutgoing,
      createdAt: msg.createdAt,
      senderId: msg.senderId,
      conversationId: msg.conversationId
    }));

    // Combine all message content for sentiment analysis
    const combinedContent = last50Messages
      .filter(msg => msg.content && msg.content.trim() !== '')
      .map(msg => msg.content)
      .join(' ');

    // Prepare payload for n8n
    const n8nPayload = {
      from: from,
      to: to,
      messageCount: last50Messages.length,
      messages: messagesForAnalysis,
      combinedContent: combinedContent,
      timestamp: new Date().toISOString(),
      userId: userId
    };

    console.log(`Sending ${last50Messages.length} messages to n8n for sentiment analysis`);

    // Trigger n8n workflow
    const result = await n8nService.triggerSentimentAnalysis(n8nPayload);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `Sentiment analysis completed for ${last50Messages.length} messages between ${from} and ${to}`,
        data: {
          sentimentResult: result.data,
          messageCount: last50Messages.length,
          phoneNumbers: { from, to },
          analysisTimestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
        error: result.error,
        data: {
          messageCount: last50Messages.length,
          phoneNumbers: { from, to }
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error in analyzeMessagesBetween controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get workflow information
 */
const getWorkflowInfo = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'n8n Sentiment Analysis Workflow Information',
      data: {
        workflowName: 'Sentiment team 2',
        webhookId: '152a82cd-717b-4e5c-b8b6-d8ef71f82c1c',
        description: 'Analyzes sentiment of conversation messages using Google Gemini',
        endpoints: {
          analyze: 'POST /api/sentiment/analyze',
          trigger: 'POST /api/sentiment/trigger',
          analyzeBetween: 'POST /api/sentiment/analyze-between',
          health: 'GET /api/sentiment/health',
          info: 'GET /api/sentiment/info'
        },
        workflow: {
          inputFields: ['from', 'to', 'conversationId', 'content'],
          processing: 'Fetches last 50 messages between phone numbers, processes with Google Gemini sentiment analysis',
          outputs: 'Sentiment analysis results with multiple output paths'
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in getWorkflowInfo controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get workflow information',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  analyzeSentiment,
  triggerWorkflow,
  analyzeMessagesBetween,
  healthCheck,
  getWorkflowInfo
}; 