const axios = require('axios');

class N8nService {
  constructor() {
    // Configure your n8n instance URL
    this.n8nBaseUrl = 'https://n8n.alchemytech.in';
    this.webhookId = 'n8n-webhook';
    this.webhookUrl = `https://n8n.alchemytech.in/webhook/n8n-webhook`;
  }

  /**
   * Trigger sentiment analysis workflow
   * @param {Object} data - Data to send to the workflow
   * @returns {Promise<Object>} - Workflow response
   */
  async triggerSentimentAnalysis(data) {
    try {
      console.log('Triggering n8n sentiment analysis workflow...');
      console.log('Webhook URL:', this.webhookUrl);
      console.log('Payload:', JSON.stringify(data, null, 2));

      const response = await axios.post(this.webhookUrl, data, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds timeout
      });

      console.log('n8n workflow response:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));

      return {
        success: true,
        data: response.data,
        status: response.status,
        message: 'Sentiment analysis completed successfully'
      };
    } catch (error) {
      console.error('Error triggering n8n workflow:', error.message);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        return {
          success: false,
          error: error.response.data,
          status: error.response.status,
          message: 'n8n workflow execution failed'
        };
      } else if (error.request) {
        console.error('No response received from n8n');
        return {
          success: false,
          error: 'No response from n8n server',
          message: 'Unable to connect to n8n instance'
        };
      } else {
        console.error('Error setting up request:', error.message);
        return {
          success: false,
          error: error.message,
          message: 'Failed to setup request to n8n'
        };
      }
    }
  }

  /**
   * Trigger sentiment analysis with conversation data
   * @param {number} conversationId - Conversation ID to analyze
   * @param {string} content - Text content to analyze (optional, will be fetched if not provided)
   * @returns {Promise<Object>} - Workflow response
   */
  async analyzeSentiment(conversationId, content = null) {
    try {
      const payload = {
        conversationId,
        timestamp: new Date().toISOString()
      };

      // If content is provided, add it to payload
      if (content) {
        console.log('>>>>>>>>>>>>>>>>>>>..content', content)
        payload.content = content;
      }

      return await this.triggerSentimentAnalysis(payload);
    } catch (error) {
      console.error('Error in analyzeSentiment:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to analyze sentiment'
      };
    }
  }

  /**
   * Check n8n instance health
   * @returns {Promise<Object>} - Health check response
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.n8nBaseUrl}/healthz`, {
        timeout: 5000
      });
      
      return {
        success: true,
        status: 'healthy',
        n8nStatus: response.status,
        message: 'n8n instance is accessible'
      };
    } catch (error) {
      return {
        success: false,
        status: 'unhealthy',
        error: error.message,
        message: 'n8n instance is not accessible'
      };
    }
  }
}

module.exports = new N8nService(); 