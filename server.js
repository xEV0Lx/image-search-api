require('dotenv').config();
const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express5'); 
const jwt = require('jsonwebtoken');
const logger = require('./logger');
const { typeDefs, resolvers } = require('./schema');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_static_secret_key';

// ==========================================
// INITIALIZE APOLLO GRAPHQL SERVER
// ==========================================
async function startServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [{
      async didEncounterErrors(requestContext) {
        for (const error of requestContext.errors) {
          logger.error('GraphQL Error Encountered', {
            message: error.message,
            code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
            path: error.path,
            query: requestContext.request.query, // Record the current GraphQL query statement
            variables: requestContext.request.variables, // Record the parameters passed
            stack: error.extensions?.exception?.stacktrace || error.stack,
            context: {
              user: requestContext.contextValue?.user ? requestContext.contextValue.user.username : 'Anonymous'
            }
          });
        }
      }
    }]
  });

  // Start the server
  await server.start();

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) return { user: null };

        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          return { user: decoded };
        } catch (error) {
          return { user: null };
        }
      },
    })
  );

  app.listen(PORT, () => {
    console.log(`GraphQL 伺服器已啟動在 http://localhost:${PORT}/graphql`);
  });
}

startServer();
