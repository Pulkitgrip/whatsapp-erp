# n8n Sentiment Analysis Integration

This document describes the integration between the WhatsApp ERP API and the n8n sentiment analysis workflow.

## Overview

The sentiment analysis integration allows you to trigger an n8n workflow that analyzes the sentiment of conversation messages using Google Gemini AI. The workflow processes conversation data and returns sentiment analysis results.

## Setup

### 1. Environment Configuration

Add the following environment variable to your `.env` file:

```env
N8N_BASE_URL=http://localhost:5678
```

Replace `http://localhost:5678` with your actual n8n instance URL.

### 2. n8n Workflow

The integration uses the "Sentiment team 2" workflow with webhook ID: `152a82cd-717b-4e5c-b8b6-d8ef71f82c1c`

**Workflow Components:**
- **Webhook Trigger**: Receives POST requests with conversation data
- **PostgreSQL Query**: Fetches messages from the database
- **Filter**: Processes only incoming messages (isOutgoing = false)
- **Code Node**: Aggregates messages for conversation ID 1220
- **Sentiment Analysis**: Uses Google Gemini to analyze sentiment
- **Multiple Outputs**: Returns different sentiment analysis results

## API Endpoints

### GET /api/sentiment/info
Get information about the n8n sentiment analysis workflow.

**Response:**
```json
{
  "success": true,
  "message": "n8n Sentiment Analysis Workflow Information",
  "data": {
    "workflowName": "Sentiment team 2",
    "webhookId": "152a82cd-717b-4e5c-b8b6-d8ef71f82c1c",
    "description": "Analyzes sentiment of conversation messages using Google Gemini",
    "endpoints": {
      "analyze": "POST /api/sentiment/analyze",
      "trigger": "POST /api/sentiment/trigger",
      "health": "GET /api/sentiment/health",
      "info": "GET /api/sentiment/info"
    }
  }
}
```

### GET /api/sentiment/health
Check the health status of the n8n service.

**Response (Healthy):**
```json
{
  "success": true,
  "status": "healthy",
  "message": "n8n instance is accessible",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/sentiment/analyze
Analyze sentiment for a specific conversation or content.

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "conversationId": 1220,
  "content": "Optional text content to analyze directly"
}
```

**Parameters:**
- `conversationId` (optional): The conversation ID to analyze
- `content` (optional): Direct text content to analyze

Note: Either `conversationId` or `content` is required.

**Response (Success):**
```json
{
  "success": true,
  "message": "Sentiment analysis completed successfully",
  "data": {
    // n8n workflow response data
    "sentiment": "positive",
    "confidence": 0.95,
    "analysis": "..."
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "n8n workflow execution failed",
  "error": "Error details from n8n",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/sentiment/trigger
Trigger the n8n workflow with custom data.

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "conversationId": 1220,
  "customField": "any custom data",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Response:** Same as `/analyze` endpoint.

### POST /api/sentiment/analyze-between
Analyze sentiment for the last 50 messages between two phone numbers.

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "from": "+919712323801",
  "to": "+919428123696"
}
```

**Parameters:**
- `from` (required): The first phone number (with or without + prefix)
- `to` (required): The second phone number (with or without + prefix)

**Response (Success):**
```json
{
  "success": true,
  "message": "Sentiment analysis completed for 50 messages between +919712323801 and +919428123696",
  "data": {
    "sentimentResult": {
      // n8n workflow response data
      "sentiment": "positive",
      "confidence": 0.95,
      "analysis": "..."
    },
    "messageCount": 50,
    "phoneNumbers": {
      "from": "+919712323801",
      "to": "+919428123696"
    },
    "analysisTimestamp": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Response (No Messages Found):**
```json
{
  "success": false,
  "message": "No messages found between these phone numbers",
  "data": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Usage Examples

### 1. Analyze Sentiment for a Conversation

```bash
curl -X POST http://localhost:5000/api/sentiment/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "conversationId": 1220
  }'
```

### 2. Analyze Sentiment for Direct Content

```bash
curl -X POST http://localhost:5000/api/sentiment/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "content": "I love this product! It works perfectly."
  }'
```

### 3. Check n8n Service Health

```bash
curl -X GET http://localhost:5000/api/sentiment/health
```

### 4. Get Workflow Information

```bash
curl -X GET http://localhost:5000/api/sentiment/info
```

### 5. Analyze Sentiment Between Two Phone Numbers

```bash
curl -X POST http://localhost:5000/api/sentiment/analyze-between \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "from": "+919712323801",
    "to": "+919428123696"
  }'
```

## Error Handling

The API provides detailed error responses for different scenarios:

- **400 Bad Request**: Missing required parameters
- **401 Unauthorized**: Invalid or missing JWT token
- **500 Internal Server Error**: Server or n8n workflow errors
- **503 Service Unavailable**: n8n instance not accessible

## Security

- All sentiment analysis endpoints (except `/info` and `/health`) require JWT authentication
- Ensure your n8n instance is properly secured
- Use HTTPS in production environments
- Validate and sanitize input data before processing

## Integration with WhatsApp Messages

The sentiment analysis can be integrated with your WhatsApp message processing:

### Analyze Individual Messages
```javascript
// Example: Analyze sentiment when receiving WhatsApp messages
const sentimentResult = await fetch('/api/sentiment/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    content: whatsappMessage.body
  })
});

const sentiment = await sentimentResult.json();
console.log('Message sentiment:', sentiment.data);
```

### Analyze Conversation Between Two Numbers
```javascript
// Example: Analyze sentiment for conversation between two phone numbers
const analyzeConversation = async (fromNumber, toNumber, userToken) => {
  try {
    const response = await fetch('/api/sentiment/analyze-between', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        from: fromNumber,
        to: toNumber
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log(`Analyzed ${result.data.messageCount} messages`);
      console.log('Sentiment result:', result.data.sentimentResult);
      return result.data;
    } else {
      console.error('Analysis failed:', result.message);
      return null;
    }
  } catch (error) {
    console.error('Error analyzing conversation:', error);
    return null;
  }
};

// Usage
const sentimentData = await analyzeConversation('+919712323801', '+919428123696', userToken);
```

## Troubleshooting

### Common Issues

1. **Connection Refused Error**
   - Check if n8n instance is running
   - Verify `N8N_BASE_URL` environment variable
   - Ensure network connectivity to n8n instance

2. **Workflow Not Found**
   - Verify the webhook ID matches your n8n workflow
   - Ensure the workflow is active in n8n
   - Check webhook path configuration

3. **Authentication Errors**
   - Ensure valid JWT token is provided
   - Check token expiration
   - Verify user permissions

### Debug Mode

Enable detailed logging by setting the log level:

```env
LOG_LEVEL=debug
```

This will provide detailed request/response logs for n8n communication.

## Production Considerations

1. **n8n Instance**: Use a dedicated n8n instance for production
2. **Environment Variables**: Use secure environment variable management
3. **Rate Limiting**: Consider implementing rate limiting for sentiment analysis endpoints
4. **Monitoring**: Monitor n8n workflow execution and API response times
5. **Caching**: Consider caching sentiment analysis results for similar content

## Support

For issues related to:
- API integration: Check the application logs and error responses
- n8n workflow: Check the n8n workflow execution logs
- Google Gemini: Verify API credentials and quotas in the n8n workflow 