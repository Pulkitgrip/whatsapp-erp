const winston = require('winston');
const { WhatsAppSession } = require('../models/whatsappModels');
const multiUserWhatsAppService = require('./whatsappMultiUserService');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class SessionCleanupService {
  constructor() {
    this.cleanupInterval = parseInt(process.env.SESSION_CLEANUP_INTERVAL) || 300000; // 5 minutes
    this.staleConnectionTimeout = parseInt(process.env.STALE_CONNECTION_TIMEOUT) || 1800000; // 30 minutes
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      logger.warn('Session cleanup service is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting session cleanup service with ${this.cleanupInterval}ms interval`);
    
    this.intervalId = setInterval(() => {
      this.performCleanup().catch(error => {
        logger.error('Error during session cleanup:', error);
      });
    }, this.cleanupInterval);
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('Session cleanup service stopped');
  }

  async performCleanup() {
    try {
      logger.info('Starting session cleanup...');
      
      // Get all sessions marked as connected in database
      const dbSessions = await WhatsAppSession.findAll({
        where: { isConnected: true }
      });

      // Get currently active connections from memory
      const activeConnections = multiUserWhatsAppService.getActiveConnections();
      const activeUserIds = new Set(activeConnections.map(conn => conn.userId));

      let cleanedSessions = 0;
      let staleSessions = 0;

      for (const session of dbSessions) {
        const userId = session.userId;
        const isActiveInMemory = activeUserIds.has(userId);
        const isStale = this.isSessionStale(session);

        // Check if session is marked as connected in DB but not active in memory
        if (!isActiveInMemory) {
          logger.info(`Cleaning up disconnected session for user ${userId}`);
          await session.update({
            isConnected: false,
            connectionState: 'close',
            qrCode: null
          });
          cleanedSessions++;
        }
        // Check if session is stale (connected for too long without activity)
        else if (isStale) {
          logger.info(`Cleaning up stale session for user ${userId}`);
          await multiUserWhatsAppService.disconnectUser(userId);
          staleSessions++;
        }
      }

      // Clean up memory connections that don't exist in database
      for (const connection of activeConnections) {
        const dbSession = dbSessions.find(s => s.userId === connection.userId);
        if (!dbSession) {
          logger.info(`Cleaning up orphaned memory connection for user ${connection.userId}`);
          await multiUserWhatsAppService.disconnectUser(connection.userId);
        }
      }

      if (cleanedSessions > 0 || staleSessions > 0) {
        logger.info(`Session cleanup completed: ${cleanedSessions} disconnected, ${staleSessions} stale sessions cleaned`);
      }

    } catch (error) {
      logger.error('Error during session cleanup:', error);
    }
  }

  isSessionStale(session) {
    if (!session.lastConnectedAt) {
      return false;
    }

    const now = new Date();
    const lastConnected = new Date(session.lastConnectedAt);
    const timeDiff = now.getTime() - lastConnected.getTime();

    return timeDiff > this.staleConnectionTimeout;
  }

  // Clean up sessions for a specific user
  async cleanupUserSession(userId) {
    try {
      logger.info(`Cleaning up session for user ${userId}`);
      
      const session = await WhatsAppSession.findOne({ where: { userId } });
      if (session) {
        await session.update({
          isConnected: false,
          connectionState: 'close',
          qrCode: null
        });
      }

      // Also cleanup from memory
      await multiUserWhatsAppService.clearUserAuthState(userId);
      
      logger.info(`Session cleaned up for user ${userId}`);
    } catch (error) {
      logger.error(`Error cleaning up session for user ${userId}:`, error);
    }
  }

  // Get cleanup statistics
  async getCleanupStats() {
    try {
      const totalSessions = await WhatsAppSession.count();
      const connectedSessions = await WhatsAppSession.count({ where: { isConnected: true } });
      const activeMemoryConnections = multiUserWhatsAppService.getActiveConnections().length;
      
      const staleSessions = await WhatsAppSession.count({
        where: {
          isConnected: true,
          lastConnectedAt: {
            [require('sequelize').Op.lt]: new Date(Date.now() - this.staleConnectionTimeout)
          }
        }
      });

      return {
        total: totalSessions,
        connected: connectedSessions,
        activeInMemory: activeMemoryConnections,
        stale: staleSessions,
        cleanupInterval: this.cleanupInterval,
        staleTimeout: this.staleConnectionTimeout,
        isRunning: this.isRunning
      };
    } catch (error) {
      logger.error('Error getting cleanup stats:', error);
      return null;
    }
  }
}

// Export singleton instance
const sessionCleanupService = new SessionCleanupService();
module.exports = sessionCleanupService; 