// logger.js
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }), // Automatically capture and format the stack information of Error objects
    format.json() 
  ),
  transports: [
    // Output the error log to a separate file.
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Output all logs (info, warn, error) to a merge file.
    new transports.File({ filename: 'logs/combined.log' }),
  ],
});

// If it's not a production environment, also output to the console with color.
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple()
    ),
  }));
}

module.exports = logger;